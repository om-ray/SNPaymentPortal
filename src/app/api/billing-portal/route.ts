import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getOrCreateCustomer, createBillingPortalSession } from '@/lib/stripe'

export async function POST() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const googleId = (session.user as any).googleId || ''
    const customer = await getOrCreateCustomer(session.user.email, googleId)

    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'

    const portalSession = await createBillingPortalSession(
      customer.id,
      `${baseUrl}/dashboard`
    )

    return NextResponse.json({ url: portalSession.url })
  } catch (error) {
    console.error('Billing portal error:', error)
    return NextResponse.json(
      { error: 'Failed to create billing portal session' },
      { status: 500 }
    )
  }
}
