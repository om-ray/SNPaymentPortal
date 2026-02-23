import { NextResponse } from 'next/server'

const TV_SESSION_ID = process.env.TV_SESSION_ID
const NOTIFICATION_WEBHOOK_URL = process.env.NOTIFICATION_WEBHOOK_URL // Discord/Slack webhook
const ADMIN_EMAIL = process.env.ADMIN_EMAIL

export async function GET() {
  if (!TV_SESSION_ID) {
    return NextResponse.json({ 
      healthy: false, 
      error: 'TV_SESSION_ID not configured' 
    }, { status: 500 })
  }

  try {
    // Test the session by making a request to TradingView
    const response = await fetch('https://www.tradingview.com/tvcoins/details/', {
      headers: {
        'Cookie': `sessionid=${TV_SESSION_ID}`,
      },
    })

    const healthy = response.status === 200

    if (!healthy) {
      // Session expired - send notification
      await sendNotification()
      
      return NextResponse.json({
        healthy: false,
        error: 'TradingView session expired. Please refresh TV_SESSION_ID.',
        status: response.status,
      }, { status: 503 })
    }

    return NextResponse.json({
      healthy: true,
      message: 'TradingView session is valid',
    })

  } catch (error) {
    return NextResponse.json({
      healthy: false,
      error: 'Failed to check session',
    }, { status: 500 })
  }
}

async function sendNotification() {
  const message = `⚠️ TradingView Session Expired!\n\nYour TV_SESSION_ID has expired. Please:\n1. Login to TradingView as 'alnim'\n2. Get the sessionid from browser cookies\n3. Update TV_SESSION_ID in Vercel environment variables\n4. Redeploy the app`

  // Discord/Slack webhook notification
  if (NOTIFICATION_WEBHOOK_URL) {
    try {
      await fetch(NOTIFICATION_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: message, // Discord format
          text: message,    // Slack format
        }),
      })
    } catch (e) {
      console.error('Failed to send webhook notification:', e)
    }
  }

  // Log for Vercel
  console.error('🚨 TRADINGVIEW SESSION EXPIRED - Please refresh TV_SESSION_ID')
}
