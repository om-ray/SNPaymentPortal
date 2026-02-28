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

    const body = await request.json();
    const { newPriceId } = body;

    if (!newPriceId) {
      return NextResponse.json(
        { error: "New price ID is required" },
        { status: 400 }
      );
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

    // Get active subscription
    const subscriptions = await stripe.subscriptions.list({
      customer: customer.id,
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
    const currentPriceId = subscription.items.data[0]?.price?.id;

    if (currentPriceId === newPriceId) {
      return NextResponse.json(
        { error: "Already on this plan" },
        { status: 400 }
      );
    }

    // Update the subscription to the new plan
    const updatedSubscription = await stripe.subscriptions.update(
      subscription.id,
      {
        items: [
          {
            id: subscription.items.data[0].id,
            price: newPriceId,
          },
        ],
        proration_behavior: "create_prorations",
      }
    );

    // Get the new plan details
    const newPlan = await getPlanByPriceIdAsync(newPriceId);
    
    if (newPlan) {
      // Update customer metadata
      await stripe.customers.update(customer.id, {
        metadata: {
          plan_type: newPlan.planType,
          access_duration_months: newPlan.accessDurationMonths.toString(),
          bonus_months: newPlan.bonusMonths.toString(),
          total_access_months: newPlan.totalAccessMonths.toString(),
          internal_product_id: newPlan.internalProductId,
        },
      });

      // Update TradingView access with new duration
      const tradingViewUsername =
        customer.metadata?.tradingview_username ||
        customer.metadata?.tradingViewUsername;

      if (tradingViewUsername) {
        try {
          const duration = `${newPlan.totalAccessMonths}M`;
          await grantAccess(tradingViewUsername, duration);
          
          await stripe.customers.update(customer.id, {
            metadata: { provisioning_status: "complete" },
          });
        } catch (error) {
          console.error("Failed to update TradingView access:", error);
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: "Plan changed successfully",
      subscription: {
        id: updatedSubscription.id,
        status: updatedSubscription.status,
      },
    });
  } catch (error: any) {
    console.error("Change plan error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to change plan" },
      { status: 500 }
    );
  }
}
