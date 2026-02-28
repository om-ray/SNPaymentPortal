import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { grantAccess } from "@/lib/tradingview";
import { getPlanByPriceIdAsync } from "@/lib/plans";

export async function POST(request: NextRequest) {
  try {
    // Verify authorization
    const authHeader = request.headers.get("authorization");
    const expectedToken = process.env.RETRY_SECRET;

    if (!expectedToken || authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { customerId } = body;

    if (!customerId) {
      return NextResponse.json(
        { error: "Customer ID is required" },
        { status: 400 }
      );
    }

    // Get customer
    const customer = await stripe.customers.retrieve(customerId);

    if (!customer || customer.deleted) {
      return NextResponse.json(
        { error: "Customer not found" },
        { status: 404 }
      );
    }

    // Get TradingView username
    const tradingViewUsername =
      customer.metadata?.tradingview_username ||
      customer.metadata?.tradingViewUsername;

    if (!tradingViewUsername) {
      return NextResponse.json(
        { error: "No TradingView username found for customer" },
        { status: 400 }
      );
    }

    // Get active subscription to determine plan
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 1,
    });

    if (subscriptions.data.length === 0) {
      return NextResponse.json(
        { error: "No active subscription found" },
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

    // Grant access
    const duration = `${totalAccessMonths}M`;
    await grantAccess(tradingViewUsername, duration);

    // Update customer metadata
    await stripe.customers.update(customerId, {
      metadata: {
        provisioning_status: "complete",
      },
    });

    console.log(
      `Retry successful: Granted access to ${tradingViewUsername} for ${duration}`
    );

    return NextResponse.json({
      success: true,
      message: `Access granted to ${tradingViewUsername} for ${duration}`,
    });
  } catch (error) {
    console.error("Retry access error:", error);
    return NextResponse.json(
      { error: "Failed to retry access grant" },
      { status: 500 }
    );
  }
}
