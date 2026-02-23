const TV_SESSION_ID = process.env.TV_SESSION_ID;
const PINE_IDS = process.env.PINE_IDS?.split(",") || [];

const TV_URLS = {
  username_hint: "https://www.tradingview.com/username_hint/",
  list_users: "https://www.tradingview.com/pine_perm/list_users/",
  modify_access:
    "https://www.tradingview.com/pine_perm/modify_user_expiration/",
  add_access: "https://www.tradingview.com/pine_perm/add/",
  remove_access: "https://www.tradingview.com/pine_perm/remove/",
};

interface ValidationResponse {
  validuser: boolean;
  verifiedUserName: string;
}

interface AccessResponse {
  pine_id: string;
  username: string;
  hasAccess: boolean;
  noExpiration: boolean;
  currentExpiration?: string;
  expiration?: string;
  status?: string;
}

function getSessionId(): string {
  if (!TV_SESSION_ID) {
    throw new Error(
      "TV_SESSION_ID not configured. Get it from TradingView browser cookies.",
    );
  }
  return TV_SESSION_ID;
}

function calculateExpiration(
  currentExpiration: string,
  extensionType: string,
  extensionLength: number,
): string {
  const expiration = new Date(currentExpiration);

  switch (extensionType) {
    case "Y":
      expiration.setFullYear(expiration.getFullYear() + extensionLength);
      break;
    case "M":
      expiration.setMonth(expiration.getMonth() + extensionLength);
      break;
    case "W":
      expiration.setDate(expiration.getDate() + extensionLength * 7);
      break;
    case "D":
      expiration.setDate(expiration.getDate() + extensionLength);
      break;
  }

  return expiration.toISOString();
}

export async function validateTradingViewUsername(
  username: string,
): Promise<ValidationResponse> {
  const response = await fetch(
    `${TV_URLS.username_hint}?s=${encodeURIComponent(username)}`,
  );

  if (!response.ok) {
    throw new Error(`TradingView API error: ${response.status}`);
  }

  const users = await response.json();
  let validUser = false;
  let verifiedUserName = "";

  for (const user of users) {
    if (user.username.toLowerCase() === username.toLowerCase()) {
      validUser = true;
      verifiedUserName = user.username;
      break;
    }
  }

  return { validuser: validUser, verifiedUserName };
}

async function getAccessDetails(
  username: string,
  pineId: string,
): Promise<AccessResponse> {
  const sessionId = getSessionId();

  const formData = new URLSearchParams();
  formData.append("pine_id", pineId);
  formData.append("username", username);

  const response = await fetch(
    `${TV_URLS.list_users}?limit=10&order_by=-created`,
    {
      method: "POST",
      headers: {
        origin: "https://www.tradingview.com",
        "Content-Type": "application/x-www-form-urlencoded",
        Cookie: `sessionid=${sessionId}`,
      },
      body: formData.toString(),
    },
  );

  if (!response.ok) {
    const text = await response.text();
    console.error("TradingView API error:", text);
    throw new Error(`TradingView API error: ${response.status}`);
  }

  const data = await response.json();
  const users = data.results || [];

  let hasAccess = false;
  let noExpiration = false;
  let expiration = new Date().toISOString();

  for (const user of users) {
    if (user.username.toLowerCase() === username.toLowerCase()) {
      hasAccess = true;
      if (user.expiration) {
        expiration = user.expiration;
      } else {
        noExpiration = true;
      }
      break;
    }
  }

  return {
    pine_id: pineId,
    username,
    hasAccess,
    noExpiration,
    currentExpiration: expiration,
  };
}

export async function checkAccess(username: string): Promise<AccessResponse[]> {
  if (PINE_IDS.length === 0) {
    throw new Error("No Pine IDs configured");
  }

  const results: AccessResponse[] = [];
  for (const pineId of PINE_IDS) {
    const details = await getAccessDetails(username, pineId);
    results.push(details);
  }

  return results;
}

export async function grantAccess(
  username: string,
  duration: string = "1M",
): Promise<AccessResponse[]> {
  if (PINE_IDS.length === 0) {
    throw new Error("No Pine IDs configured");
  }

  const sessionId = getSessionId();
  const results: AccessResponse[] = [];

  // Parse duration (e.g., "1M" = 1 month, "7D" = 7 days)
  const extensionLength = parseInt(duration.slice(0, -1)) || 1;
  const extensionType = duration.slice(-1).toUpperCase();

  for (const pineId of PINE_IDS) {
    const accessDetails = await getAccessDetails(username, pineId);

    if (accessDetails.noExpiration) {
      // Already has lifetime access
      results.push({ ...accessDetails, status: "Not Applied" });
      continue;
    }

    const newExpiration = calculateExpiration(
      accessDetails.currentExpiration || new Date().toISOString(),
      extensionType,
      extensionLength,
    );

    const endpoint = accessDetails.hasAccess
      ? TV_URLS.modify_access
      : TV_URLS.add_access;

    const formData = new FormData();
    formData.append("pine_id", pineId);
    formData.append("username_recip", username);
    formData.append("expiration", newExpiration);

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        origin: "https://www.tradingview.com",
        Cookie: `sessionid=${sessionId}`,
      },
      body: formData,
    });

    const status =
      response.status === 200 || response.status === 201
        ? "Success"
        : "Failure";

    results.push({
      ...accessDetails,
      expiration: newExpiration,
      status,
    });
  }

  return results;
}

export async function revokeAccess(
  username: string,
): Promise<AccessResponse[]> {
  if (PINE_IDS.length === 0) {
    throw new Error("No Pine IDs configured");
  }

  const sessionId = getSessionId();
  const results: AccessResponse[] = [];

  for (const pineId of PINE_IDS) {
    const accessDetails = await getAccessDetails(username, pineId);

    const formData = new FormData();
    formData.append("pine_id", pineId);
    formData.append("username_recip", username);

    const response = await fetch(TV_URLS.remove_access, {
      method: "POST",
      headers: {
        origin: "https://www.tradingview.com",
        Cookie: `sessionid=${sessionId}`,
      },
      body: formData,
    });

    const status =
      response.status === 200 || response.status === 201
        ? "Success"
        : "Failure";

    results.push({
      ...accessDetails,
      status,
    });
  }

  return results;
}
