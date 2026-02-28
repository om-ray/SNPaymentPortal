import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  getOrCreateCustomer,
  createCheckoutSession,
  stripe,
} from "@/lib/stripe";
import { getPlanByIdAsync, createCustomerMetadata } from "@/lib/plans";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { planId } = body;

    if (!planId) {
      return NextResponse.json(
        { error: "Plan ID is required" },
        { status: 400 },
      );
    }

    const plan = await getPlanByIdAsync(planId);

    if (!plan) {
      return NextResponse.json(
        { error: "Invalid plan selected" },
        { status: 400 },
      );
    }

    const googleId = (session.user as any).googleId || "";
    const customer = await getOrCreateCustomer(session.user.email, googleId);

    if (
      !customer.metadata?.tradingview_username &&
      !customer.metadata?.tradingViewUsername
    ) {
      return NextResponse.json(
        { error: "Please set your TradingView username first" },
        { status: 400 },
      );
    }

    const tradingViewUsername =
      customer.metadata?.tradingview_username ||
      customer.metadata?.tradingViewUsername ||
      "";

    // Update customer metadata with plan info
    const metadata = createCustomerMetadata(
      plan,
      tradingViewUsername,
      session.user.email,
      googleId,
      "incomplete",
    );

    await stripe.customers.update(customer.id, {
      metadata: metadata,
    });

    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";

    const checkoutSession = await createCheckoutSession(
      customer.id,
      plan.priceId,
      `${baseUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
      `${baseUrl}/checkout`,
    );

    return NextResponse.json({ url: checkoutSession.url });
  } catch (error) {
    console.error("Checkout session error:", error);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 },
    );
  }
}
