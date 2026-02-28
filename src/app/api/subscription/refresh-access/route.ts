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
        { status: 404 },
      );
    }

    const customer = customers.data[0];
    const tradingViewUsername =
      customer.metadata?.tradingview_username ||
      customer.metadata?.tradingViewUsername;

    if (!tradingViewUsername) {
      return NextResponse.json(
        { error: "No TradingView username found", needsOnboarding: true },
        { status: 400 },
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
          provisioningStatus: customer.metadata?.provisioning_status || "none",
        },
        { status: 400 },
      );
    }

    const subscription = subscriptions.data[0];
    const price = subscription.items.data[0]?.price;
    const priceId = price?.id;

    // Determine access duration based on plan or subscription interval
    let totalAccessMonths = 6; // default fallback

    if (priceId) {
      const plan = await getPlanByPriceIdAsync(priceId);
      if (plan && plan.totalAccessMonths > 0) {
        totalAccessMonths = plan.totalAccessMonths;
      } else {
        // Fallback: determine from subscription interval
        const interval = price?.recurring?.interval;
        const intervalCount = price?.recurring?.interval_count || 1;

        if (interval === "year") {
          totalAccessMonths = 12 * intervalCount;
        } else if (interval === "month") {
          totalAccessMonths = intervalCount;
        }
      }
    }

    // Ensure minimum of 1 month
    if (totalAccessMonths < 1) {
      totalAccessMonths = 6;
    }

    // Always try to grant/update access - don't skip based on provisioning status
    // This ensures we fix any access issues regardless of what metadata says
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
        { status: 500 },
      );
    }
  } catch (error) {
    console.error("Refresh access error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
