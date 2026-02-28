import { stripe } from "./stripe";

// Price IDs - the only thing we need to know which prices to fetch
const PRICE_IDS = [
  "price_1T5k6uBczLGFpfEDDgwwszLg", // Annual
  "price_1T5l6iBczLGFpfEDyOCiEAbV", // 6 Months
];

export interface Plan {
  id: string;
  priceId: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  interval: string;
  // From Stripe product metadata
  planType: string;
  accessDurationMonths: number;
  bonusMonths: number;
  totalAccessMonths: number;
  internalProductId: string;
  features: string[];
}

// Cache for fetched plans
let cachedPlans: Plan[] | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function fetchPlansFromStripe(): Promise<Plan[]> {
  // Return cached plans if still valid
  if (cachedPlans && Date.now() - cacheTimestamp < CACHE_TTL) {
    return cachedPlans;
  }

  const plans: Plan[] = [];

  for (const priceId of PRICE_IDS) {
    try {
      const price = await stripe.prices.retrieve(priceId, {
        expand: ["product"],
      });

      const product = price.product as any;
      const metadata = product.metadata || {};

      // Determine interval display
      let interval: string = price.recurring?.interval || "month";
      if (
        price.recurring?.interval === "month" &&
        price.recurring?.interval_count === 6
      ) {
        interval = "6 months";
      } else if (price.recurring?.interval === "year") {
        interval = "year";
      }

      // Get values from Stripe product metadata
      const accessDurationMonths = parseInt(
        metadata.access_duration_months || "0",
      );
      const bonusMonths = parseInt(metadata.bonus_months || "0");
      const features = metadata.features ? JSON.parse(metadata.features) : [];

      plans.push({
        id: metadata.plan_id || priceId,
        priceId,
        name: product.name || "Plan",
        description: product.description || "",
        price: price.unit_amount ? price.unit_amount / 100 : 0,
        currency: price.currency,
        interval,
        planType: metadata.plan_type || "",
        accessDurationMonths,
        bonusMonths,
        totalAccessMonths: accessDurationMonths + bonusMonths,
        internalProductId: metadata.internal_product_id || "",
        features,
      });
    } catch (error) {
      console.error(`Failed to fetch plan ${priceId} from Stripe:`, error);
    }
  }

  // Update cache
  cachedPlans = plans;
  cacheTimestamp = Date.now();

  return plans;
}

export function getPlanByPriceId(priceId: string): Plan | undefined {
  return cachedPlans?.find((plan) => plan.priceId === priceId);
}

export async function getPlanByPriceIdAsync(
  priceId: string,
): Promise<Plan | undefined> {
  const plans = await fetchPlansFromStripe();
  return plans.find((plan) => plan.priceId === priceId);
}

export function getPlanById(id: string): Plan | undefined {
  return cachedPlans?.find((plan) => plan.id === id);
}

export async function getPlanByIdAsync(id: string): Promise<Plan | undefined> {
  const plans = await fetchPlansFromStripe();
  return plans.find((plan) => plan.id === id);
}

export interface CustomerMetadata {
  [key: string]: string;
  product: string;
  plan_type: string;
  access_duration_months: string;
  bonus_months: string;
  total_access_months: string;
  hubspot_contact_id: string;
  hubspot_email: string;
  tradingview_username: string;
  internal_product_id: string;
  provisioning_status: string;
  environment: string;
}

export function createCustomerMetadata(
  plan: Plan,
  tradingViewUsername: string,
  email: string,
  googleId: string,
  provisioningStatus: "incomplete" | "pending" | "complete" = "incomplete",
): CustomerMetadata {
  return {
    product: "sn_vision",
    plan_type: plan.planType,
    access_duration_months: plan.accessDurationMonths.toString(),
    bonus_months: plan.bonusMonths.toString(),
    total_access_months: plan.totalAccessMonths.toString(),
    hubspot_contact_id: "",
    hubspot_email: email,
    tradingview_username: tradingViewUsername,
    internal_product_id: plan.internalProductId,
    provisioning_status: provisioningStatus,
    environment:
      process.env.NODE_ENV === "production" ? "production" : "development",
    googleId,
  };
}
