import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-10-16",
  typescript: true,
});

export async function getOrCreateCustomer(
  email: string,
  googleId: string,
): Promise<Stripe.Customer> {
  const existingCustomers = await stripe.customers.list({
    email: email,
    limit: 1,
  });

  if (existingCustomers.data.length > 0) {
    const customer = existingCustomers.data[0];
    if (!customer.metadata.googleId) {
      await stripe.customers.update(customer.id, {
        metadata: { googleId },
      });
    }
    return customer;
  }

  const newCustomer = await stripe.customers.create({
    email: email,
    metadata: { googleId },
  });

  return newCustomer;
}

export async function getCustomerByEmail(
  email: string,
): Promise<Stripe.Customer | null> {
  const customers = await stripe.customers.list({
    email: email,
    limit: 1,
  });

  return customers.data.length > 0 ? customers.data[0] : null;
}

export async function getActiveSubscription(
  customerId: string,
): Promise<Stripe.Subscription | null> {
  const subscriptions = await stripe.subscriptions.list({
    customer: customerId,
    status: "active",
    limit: 1,
  });

  if (subscriptions.data.length > 0) {
    return subscriptions.data[0];
  }

  const trialingSubscriptions = await stripe.subscriptions.list({
    customer: customerId,
    status: "trialing",
    limit: 1,
  });

  return trialingSubscriptions.data.length > 0
    ? trialingSubscriptions.data[0]
    : null;
}

export async function updateCustomerTradingViewUsername(
  customerId: string,
  tradingViewUsername: string,
): Promise<Stripe.Customer> {
  return await stripe.customers.update(customerId, {
    metadata: {
      tradingview_username: tradingViewUsername,
      // Keep old format for backwards compatibility
      tradingViewUsername,
    },
  });
}

export async function createCheckoutSession(
  customerId: string,
  priceId: string,
  successUrl: string,
  cancelUrl: string,
): Promise<Stripe.Checkout.Session> {
  return await stripe.checkout.sessions.create({
    customer: customerId,
    payment_method_types: ["card"],
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    mode: "subscription",
    success_url: successUrl,
    cancel_url: cancelUrl,
  });
}

export async function cancelSubscription(
  subscriptionId: string,
): Promise<Stripe.Subscription> {
  return await stripe.subscriptions.update(subscriptionId, {
    cancel_at_period_end: true,
  });
}

export async function createBillingPortalSession(
  customerId: string,
  returnUrl: string,
): Promise<Stripe.BillingPortal.Session> {
  return await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });
}
