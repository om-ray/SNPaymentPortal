import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  getOrCreateCustomer,
  getActiveSubscription,
  stripe,
} from "@/lib/stripe";
import { getPlanByPriceIdAsync, fetchPlansFromStripe, Plan } from "@/lib/plans";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const googleId = (session.user as any).googleId || "";
    const customer = await getOrCreateCustomer(session.user.email, googleId);

    // Support both old and new metadata format
    const tradingViewUsername =
      customer.metadata?.tradingview_username ||
      customer.metadata?.tradingViewUsername ||
      null;
    const subscription = await getActiveSubscription(customer.id);

    let subscriptionDetails = null;
    let currentPlan: Plan | undefined = undefined;

    if (subscription) {
      const priceId = subscription.items.data[0]?.price.id;
      const price = await stripe.prices.retrieve(priceId, {
        expand: ["product"],
      });

      const product = price.product as any;
      currentPlan = await getPlanByPriceIdAsync(priceId);

      let paymentMethod = null;
      if (subscription.default_payment_method) {
        const pm = await stripe.paymentMethods.retrieve(
          subscription.default_payment_method as string,
        );
        if (pm.card) {
          paymentMethod = {
            brand: pm.card.brand,
            last4: pm.card.last4,
            expMonth: pm.card.exp_month,
            expYear: pm.card.exp_year,
          };
        }
      }

      // Determine interval display from Stripe price
      let intervalDisplay: string = price.recurring?.interval || "month";
      if (price.recurring?.interval === "year") {
        intervalDisplay = "year";
      } else if (price.recurring?.interval_count === 6) {
        intervalDisplay = "6 months";
      }

      // Calculate totalAccessMonths from config or metadata
      const totalAccessMonths = currentPlan
        ? currentPlan.accessDurationMonths + currentPlan.bonusMonths
        : parseInt(customer.metadata?.total_access_months || "6");

      subscriptionDetails = {
        id: subscription.id,
        status: subscription.status,
        planName: product.name || "SN Vision",
        planType:
          currentPlan?.planType || customer.metadata?.plan_type || "unknown",
        priceAmount: price.unit_amount ? price.unit_amount / 100 : 0,
        currency: price.currency,
        interval: intervalDisplay,
        currentPeriodEnd: new Date(
          subscription.current_period_end * 1000,
        ).toISOString(),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        paymentMethod,
        totalAccessMonths,
        bonusMonths:
          currentPlan?.bonusMonths ||
          parseInt(customer.metadata?.bonus_months || "0"),
      };
    }

    // Fetch plans from Stripe for available plans list
    const plans = await fetchPlansFromStripe();

    return NextResponse.json({
      customerId: customer.id,
      tradingViewUsername,
      hasActiveSubscription: !!subscription,
      subscription: subscriptionDetails,
      currentPlan: currentPlan
        ? {
            id: currentPlan.id,
            planType: currentPlan.planType,
          }
        : null,
      availablePlans: plans.map((p) => ({
        id: p.id,
        name: p.name,
        planType: p.planType,
        price: p.price,
        currency: p.currency,
        interval: p.interval,
      })),
      provisioningStatus: customer.metadata?.provisioning_status || "unknown",
    });
  } catch (error) {
    console.error("Subscription status error:", error);
    return NextResponse.json(
      { error: "Failed to fetch subscription status" },
      { status: 500 },
    );
  }
}
