const HUBSPOT_ACCESS_TOKEN = process.env.HUBSPOT_ACCESS_TOKEN!;
const HUBSPOT_API_BASE = "https://api.hubapi.com";

export interface HubSpotContactProperties {
  email: string;
  firstname?: string;
  lastname?: string;
  sn_vision_subscription_status?: "active" | "expired" | "revoked";
  sn_vision_plan_type?: "annual" | "6_months" | "promotion";
  sn_vision_start_date?: string;
  sn_vision_end_date?: string;
  sn_vision_bonus_months?: "0" | "1" | "2" | "3";
  tradingview_username?: string;
  tradingview_access_granted?: "true" | "false";
  tradingview_access_granted_date?: string;
  tradingview_access_revoked_date?: string;
  sn_vision_purchase_price?: number;
  sn_vision_renewal_date?: string;
  sn_vision_renewal_status?: "active" | "canceled" | "pending";
  sn_vision_last_payment?: string;
  sn_vision_ltv?: number;
}

export interface HubSpotContact {
  id: string;
  properties: HubSpotContactProperties;
}

async function hubspotFetch(endpoint: string, options: RequestInit = {}) {
  const res = await fetch(`${HUBSPOT_API_BASE}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${HUBSPOT_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(`HubSpot API error: ${error.message || res.statusText}`);
  }

  return res.json();
}

export async function getContactByEmail(
  email: string,
): Promise<HubSpotContact | null> {
  try {
    const data = await hubspotFetch(
      `/crm/v3/objects/contacts/${email}?idProperty=email&properties=email,firstname,lastname,sn_vision_subscription_status,sn_vision_plan_type,sn_vision_start_date,sn_vision_end_date,sn_vision_bonus_months,tradingview_username,tradingview_access_granted,tradingview_access_granted_date,tradingview_access_revoked_date,sn_vision_purchase_price,sn_vision_renewal_date,sn_vision_renewal_status,sn_vision_last_payment,sn_vision_ltv`,
    );
    return {
      id: data.id,
      properties: data.properties,
    };
  } catch (error: any) {
    if (
      error.message.includes("404") ||
      error.message.toLowerCase().includes("not found")
    ) {
      return null;
    }
    throw error;
  }
}

export async function createContact(
  properties: HubSpotContactProperties,
): Promise<HubSpotContact> {
  const data = await hubspotFetch("/crm/v3/objects/contacts", {
    method: "POST",
    body: JSON.stringify({ properties }),
  });

  return {
    id: data.id,
    properties: data.properties,
  };
}

export async function updateContact(
  contactId: string,
  properties: Partial<HubSpotContactProperties>,
): Promise<HubSpotContact> {
  const data = await hubspotFetch(`/crm/v3/objects/contacts/${contactId}`, {
    method: "PATCH",
    body: JSON.stringify({ properties }),
  });

  return {
    id: data.id,
    properties: data.properties,
  };
}

export async function getOrCreateContact(
  email: string,
  defaultProperties?: Partial<HubSpotContactProperties>,
): Promise<{ contact: HubSpotContact; created: boolean }> {
  const existing = await getContactByEmail(email);

  if (existing) {
    return { contact: existing, created: false };
  }

  const contact = await createContact({
    email,
    ...defaultProperties,
  });

  return { contact, created: true };
}

export async function syncSubscriptionToHubSpot(
  email: string,
  subscriptionData: {
    planType: "annual" | "6_months" | "promotion";
    startDate: Date;
    endDate: Date;
    purchasePrice: number;
    bonusMonths?: number;
    tradingviewUsername?: string;
  },
): Promise<HubSpotContact> {
  const { contact } = await getOrCreateContact(email);

  const properties: Partial<HubSpotContactProperties> = {
    sn_vision_subscription_status: "active",
    sn_vision_plan_type: subscriptionData.planType,
    sn_vision_start_date: subscriptionData.startDate
      .toISOString()
      .split("T")[0],
    sn_vision_end_date: subscriptionData.endDate.toISOString().split("T")[0],
    sn_vision_purchase_price: subscriptionData.purchasePrice,
    sn_vision_last_payment: new Date().toISOString(),
    sn_vision_renewal_status: "active",
  };

  if (subscriptionData.bonusMonths !== undefined) {
    properties.sn_vision_bonus_months = String(subscriptionData.bonusMonths) as
      | "0"
      | "1"
      | "2"
      | "3";
  }

  if (subscriptionData.tradingviewUsername) {
    properties.tradingview_username = subscriptionData.tradingviewUsername;
  }

  const currentLtv = Number(contact.properties.sn_vision_ltv) || 0;
  properties.sn_vision_ltv = currentLtv + subscriptionData.purchasePrice;

  return updateContact(contact.id, properties);
}

export async function markTradingViewAccessGranted(
  email: string,
  tradingviewUsername: string,
): Promise<HubSpotContact> {
  const { contact } = await getOrCreateContact(email);

  return updateContact(contact.id, {
    tradingview_username: tradingviewUsername,
    tradingview_access_granted: "true",
    tradingview_access_granted_date: new Date().toISOString(),
  });
}

export async function revokeTradingViewAccess(
  email: string,
): Promise<HubSpotContact> {
  const { contact } = await getOrCreateContact(email);

  return updateContact(contact.id, {
    tradingview_access_granted: "false",
    tradingview_access_revoked_date: new Date().toISOString(),
    sn_vision_subscription_status: "revoked",
  });
}

export async function expireSubscription(
  email: string,
): Promise<HubSpotContact> {
  const { contact } = await getOrCreateContact(email);

  return updateContact(contact.id, {
    sn_vision_subscription_status: "expired",
    tradingview_access_granted: "false",
    tradingview_access_revoked_date: new Date().toISOString(),
  });
}
