import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getOrCreateCustomer, createCheckoutSession } from '@/lib/stripe'

export async function POST() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const priceId = process.env.STRIPE_PRICE_ID

    if (!priceId) {
      return NextResponse.json(
        { error: 'Stripe price not configured' },
        { status: 500 }
      )
    }

    const googleId = (session.user as any).googleId || ''
    const customer = await getOrCreateCustomer(session.user.email, googleId)

    if (!customer.metadata?.tradingViewUsername) {
      return NextResponse.json(
        { error: 'Please set your TradingView username first' },
        { status: 400 }
      )
    }

    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'

    const checkoutSession = await createCheckoutSession(
      customer.id,
      priceId,
      `${baseUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
      `${baseUrl}/checkout`
    )

    return NextResponse.json({ url: checkoutSession.url })
  } catch (error) {
    console.error('Checkout session error:', error)
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    )
  }
}
