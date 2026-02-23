import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getOrCreateCustomer, getActiveSubscription, cancelSubscription } from '@/lib/stripe'

export async function POST() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const googleId = (session.user as any).googleId || ''
    const customer = await getOrCreateCustomer(session.user.email, googleId)

    const subscription = await getActiveSubscription(customer.id)

    if (!subscription) {
      return NextResponse.json(
        { error: 'No active subscription found' },
        { status: 400 }
      )
    }

    const updatedSubscription = await cancelSubscription(subscription.id)

    return NextResponse.json({
      success: true,
      cancelAtPeriodEnd: updatedSubscription.cancel_at_period_end,
      currentPeriodEnd: new Date(updatedSubscription.current_period_end * 1000).toISOString(),
    })
  } catch (error) {
    console.error('Cancel subscription error:', error)
    return NextResponse.json(
      { error: 'Failed to cancel subscription' },
      { status: 500 }
    )
  }
}
