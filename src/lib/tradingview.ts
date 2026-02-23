const TRADINGVIEW_API_URL = process.env.TRADINGVIEW_API_URL
const PINE_IDS = process.env.PINE_IDS?.split(',') || []

interface ValidationResponse {
  validuser: boolean
  verifiedUserName: string
}

interface AccessResponse {
  pine_id: string
  username: string
  hasAccess: boolean
  noExpiration: boolean
  currentExpiration?: string
  expiration?: string
  status?: string
}

export async function validateTradingViewUsername(username: string): Promise<ValidationResponse> {
  if (!TRADINGVIEW_API_URL) {
    throw new Error('TradingView API URL not configured')
  }

  const response = await fetch(`${TRADINGVIEW_API_URL}/validate/${encodeURIComponent(username)}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`TradingView API error: ${response.status}`)
  }

  return response.json()
}

export async function checkAccess(username: string): Promise<AccessResponse[]> {
  if (!TRADINGVIEW_API_URL) {
    throw new Error('TradingView API URL not configured')
  }

  if (PINE_IDS.length === 0) {
    throw new Error('No Pine IDs configured')
  }

  const response = await fetch(`${TRADINGVIEW_API_URL}/access/${encodeURIComponent(username)}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ pine_ids: PINE_IDS }),
  })

  if (!response.ok) {
    throw new Error(`TradingView API error: ${response.status}`)
  }

  return response.json()
}

export async function grantAccess(username: string, duration: string = '1M'): Promise<AccessResponse[]> {
  if (!TRADINGVIEW_API_URL) {
    throw new Error('TradingView API URL not configured')
  }

  if (PINE_IDS.length === 0) {
    throw new Error('No Pine IDs configured')
  }

  const response = await fetch(`${TRADINGVIEW_API_URL}/access/${encodeURIComponent(username)}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      pine_ids: PINE_IDS,
      duration: duration,
    }),
  })

  if (!response.ok) {
    throw new Error(`TradingView API error: ${response.status}`)
  }

  return response.json()
}

export async function revokeAccess(username: string): Promise<AccessResponse[]> {
  if (!TRADINGVIEW_API_URL) {
    throw new Error('TradingView API URL not configured')
  }

  if (PINE_IDS.length === 0) {
    throw new Error('No Pine IDs configured')
  }

  const response = await fetch(`${TRADINGVIEW_API_URL}/access/${encodeURIComponent(username)}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ pine_ids: PINE_IDS }),
  })

  if (!response.ok) {
    throw new Error(`TradingView API error: ${response.status}`)
  }

  return response.json()
}
