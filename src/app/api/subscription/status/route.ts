import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getOrCreateCustomer, getActiveSubscription, stripe } from '@/lib/stripe'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const googleId = (session.user as any).googleId || ''
    const customer = await getOrCreateCustomer(session.user.email, googleId)

    const tradingViewUsername = customer.metadata?.tradingViewUsername || null
    const subscription = await getActiveSubscription(customer.id)

    let subscriptionDetails = null

    if (subscription) {
      const priceId = subscription.items.data[0]?.price.id
      const price = await stripe.prices.retrieve(priceId, {
        expand: ['product'],
      })

      const product = price.product as any

      let paymentMethod = null
      if (subscription.default_payment_method) {
        const pm = await stripe.paymentMethods.retrieve(
          subscription.default_payment_method as string
        )
        if (pm.card) {
          paymentMethod = {
            brand: pm.card.brand,
            last4: pm.card.last4,
            expMonth: pm.card.exp_month,
            expYear: pm.card.exp_year,
          }
        }
      }

      subscriptionDetails = {
        id: subscription.id,
        status: subscription.status,
        planName: product.name || 'SN Vision',
        priceAmount: price.unit_amount ? price.unit_amount / 100 : 0,
        currency: price.currency,
        interval: price.recurring?.interval || 'month',
        currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        paymentMethod,
      }
    }

    return NextResponse.json({
      customerId: customer.id,
      tradingViewUsername,
      hasActiveSubscription: !!subscription,
      subscription: subscriptionDetails,
    })
  } catch (error) {
    console.error('Subscription status error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch subscription status' },
      { status: 500 }
    )
  }
}
