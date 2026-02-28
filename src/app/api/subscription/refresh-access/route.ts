import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { stripe } from "@/lib/stripe";
import { grantAccess } from "@/lib/tradingview";
import { getPlanByPriceIdAsync } from "@/lib/plans";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Find the customer
    const customers = await stripe.customers.list({
      email: session.user.email,
      limit: 1,
    });

    if (customers.data.length === 0) {
      return NextResponse.json(
        { error: "Customer not found" },
        { status: 404 }
      );
    }

    const customer = customers.data[0];
    const tradingViewUsername =
      customer.metadata?.tradingview_username ||
      customer.metadata?.tradingViewUsername;

    if (!tradingViewUsername) {
      return NextResponse.json(
        { error: "No TradingView username found", needsOnboarding: true },
        { status: 400 }
      );
    }

    // Check for active subscription
    const subscriptions = await stripe.subscriptions.list({
      customer: customer.id,
      status: "active",
      limit: 1,
    });

    if (subscriptions.data.length === 0) {
      return NextResponse.json(
        { 
          error: "No active subscription found",
          shouldHaveAccess: false,
          provisioningStatus: customer.metadata?.provisioning_status || "none"
        },
        { status: 400 }
      );
    }

    const subscription = subscriptions.data[0];
    const priceId = subscription.items.data[0]?.price?.id;

    // Get plan details
    let totalAccessMonths = 6; // default
    if (priceId) {
      const plan = await getPlanByPriceIdAsync(priceId);
      if (plan) {
        totalAccessMonths = plan.totalAccessMonths;
      }
    }

    // Check current provisioning status
    const currentStatus = customer.metadata?.provisioning_status;

    // If already complete, just return success
    if (currentStatus === "complete") {
      return NextResponse.json({
        success: true,
        message: "Access already granted",
        alreadyProvisioned: true,
        provisioningStatus: "complete",
      });
    }

    // Try to grant access
    try {
      // Update status to pending
      await stripe.customers.update(customer.id, {
        metadata: { provisioning_status: "pending" },
      });

      const duration = `${totalAccessMonths}M`;
      await grantAccess(tradingViewUsername, duration);

      // Update status to complete
      await stripe.customers.update(customer.id, {
        metadata: { provisioning_status: "complete" },
      });

      return NextResponse.json({
        success: true,
        message: `Access granted to ${tradingViewUsername} for ${duration}`,
        provisioningStatus: "complete",
      });
    } catch (accessError: any) {
      console.error("Failed to grant access:", accessError);

      // Update status to indicate failure
      await stripe.customers.update(customer.id, {
        metadata: {
          provisioning_status: "failed",
          last_error: accessError?.message || "Unknown error",
        },
      });

      return NextResponse.json(
        {
          error: "Failed to grant access. Please try again later.",
          provisioningStatus: "failed",
          details: accessError?.message,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Refresh access error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
