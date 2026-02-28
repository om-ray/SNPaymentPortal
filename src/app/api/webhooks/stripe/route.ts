import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { grantAccess } from "@/lib/tradingview";
import { getPlanByPriceIdAsync } from "@/lib/plans";
import { triggerSessionRefresh } from "@/lib/github";
import Stripe from "stripe";

// Helper to get TradingView username from customer metadata (supports both old and new format)
function getTradingViewUsername(metadata: Stripe.Metadata): string | null {
  return (
    metadata?.tradingview_username || metadata?.tradingViewUsername || null
  );
}

// Helper to calculate access duration string based on plan
function getAccessDuration(totalAccessMonths: number): string {
  return `${totalAccessMonths}M`;
}

// Update customer provisioning status
async function updateProvisioningStatus(
  customerId: string,
  status: "incomplete" | "pending" | "complete",
) {
  await stripe.customers.update(customerId, {
    metadata: { provisioning_status: status },
  });
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        if (
          session.mode === "subscription" &&
          session.customer &&
          session.subscription
        ) {
          const customer = await stripe.customers.retrieve(
            session.customer as string,
          );

          if (customer && !customer.deleted) {
            const tradingViewUsername = getTradingViewUsername(
              customer.metadata,
            );

            // Get the subscription to find the price ID
            const subscription = await stripe.subscriptions.retrieve(
              session.subscription as string,
            );
            const priceId = subscription.items.data[0]?.price?.id;

            // Fetch plan data from Stripe
            let totalAccessMonths = 6; // default
            if (priceId) {
              const plan = await getPlanByPriceIdAsync(priceId);
              if (plan) {
                totalAccessMonths = plan.totalAccessMonths;

                // Update customer metadata with plan info from Stripe
                await stripe.customers.update(customer.id, {
                  metadata: {
                    plan_type: plan.planType,
                    access_duration_months:
                      plan.accessDurationMonths.toString(),
                    bonus_months: plan.bonusMonths.toString(),
                    total_access_months: plan.totalAccessMonths.toString(),
                    internal_product_id: plan.internalProductId,
                  },
                });
                console.log(
                  `Updated customer metadata with plan: ${plan.planType}`,
                );
              }
            }

            if (tradingViewUsername) {
              try {
                // Update status to pending before granting access
                await updateProvisioningStatus(customer.id, "pending");

                const duration = getAccessDuration(totalAccessMonths);
                await grantAccess(tradingViewUsername, duration);

                // Update status to complete after successful grant
                await updateProvisioningStatus(customer.id, "complete");
                console.log(
                  `Granted TradingView access to ${tradingViewUsername} for ${duration}`,
                );
              } catch (error: any) {
                console.error("Failed to grant TradingView access:", error);

                // Check if it's a session/auth error
                const isSessionError =
                  error?.message?.includes("session") ||
                  error?.message?.includes("401") ||
                  error?.message?.includes("403") ||
                  error?.message?.includes("unauthorized");

                if (isSessionError) {
                  console.log("Session error detected, triggering refresh...");
                  // Trigger GitHub Action to refresh session and retry
                  await triggerSessionRefresh(customer.id);

                  // Update status to indicate retry is pending
                  await stripe.customers.update(customer.id, {
                    metadata: {
                      provisioning_status: "retry_pending",
                      last_error: error?.message || "Session error",
                    },
                  });
                }
              }
            }
          }
        }
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;

        // Only process renewal invoices (not the first invoice which is handled by checkout.session.completed)
        if (
          invoice.subscription &&
          invoice.customer &&
          invoice.billing_reason === "subscription_cycle"
        ) {
          const customer = await stripe.customers.retrieve(
            invoice.customer as string,
          );

          if (customer && !customer.deleted) {
            const tradingViewUsername = getTradingViewUsername(
              customer.metadata,
            );

            // Get the subscription to find the price ID
            const subscription = await stripe.subscriptions.retrieve(
              invoice.subscription as string,
            );
            const priceId = subscription.items.data[0]?.price?.id;

            // Fetch plan data from Stripe
            let totalAccessMonths = 6; // default
            if (priceId) {
              const plan = await getPlanByPriceIdAsync(priceId);
              if (plan) {
                totalAccessMonths = plan.totalAccessMonths;
              }
            }

            if (tradingViewUsername) {
              try {
                await updateProvisioningStatus(customer.id, "pending");

                const duration = getAccessDuration(totalAccessMonths);
                await grantAccess(tradingViewUsername, duration);

                await updateProvisioningStatus(customer.id, "complete");
                console.log(
                  `Extended TradingView access for ${tradingViewUsername} for ${duration}`,
                );
              } catch (error: any) {
                console.error("Failed to extend TradingView access:", error);

                // Check if it's a session/auth error
                const isSessionError =
                  error?.message?.includes("session") ||
                  error?.message?.includes("401") ||
                  error?.message?.includes("403") ||
                  error?.message?.includes("unauthorized");

                if (isSessionError) {
                  console.log("Session error detected, triggering refresh...");
                  await triggerSessionRefresh(customer.id);

                  await stripe.customers.update(customer.id, {
                    metadata: {
                      provisioning_status: "retry_pending",
                      last_error: error?.message || "Session error",
                    },
                  });
                }
              }
            }
          }
        }
        break;
      }

      case "customer.subscription.deleted": {
        // Subscription fully deleted - access already expired naturally, no action needed
        // The user's TradingView access was granted for the subscription period,
        // so it will expire on its own based on the duration granted
        const subscription = event.data.object as Stripe.Subscription;
        console.log(
          `Subscription ${subscription.id} deleted - access will expire naturally`,
        );
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;

        // Handle plan changes - if the price changed, update metadata
        if (subscription.customer) {
          const priceId = subscription.items.data[0]?.price?.id;
          if (priceId) {
            const planConfig = await getPlanByPriceIdAsync(priceId);
            if (planConfig) {
              const totalAccessMonths =
                planConfig.accessDurationMonths + planConfig.bonusMonths;
              await stripe.customers.update(subscription.customer as string, {
                metadata: {
                  plan_type: planConfig.planType,
                  access_duration_months:
                    planConfig.accessDurationMonths.toString(),
                  bonus_months: planConfig.bonusMonths.toString(),
                  total_access_months: totalAccessMonths.toString(),
                  internal_product_id: planConfig.internalProductId,
                },
              });
              console.log(
                `Updated customer metadata for plan change to ${planConfig.planType}`,
              );
            }
          }
        }

        // Note: We do NOT revoke access on cancellation - access continues until expiration
        if (subscription.cancel_at_period_end) {
          console.log(
            `Subscription ${subscription.id} set to cancel at period end - access will continue until then`,
          );
        }
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook processing error:", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 },
    );
  }
}
