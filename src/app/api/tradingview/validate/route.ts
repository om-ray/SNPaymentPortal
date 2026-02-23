import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { validateTradingViewUsername } from '@/lib/tradingview'
import { getOrCreateCustomer, updateCustomerTradingViewUsername } from '@/lib/stripe'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { username } = await request.json()

    if (!username || typeof username !== 'string') {
      return NextResponse.json({ error: 'Username is required' }, { status: 400 })
    }

    const trimmedUsername = username.trim()

    if (trimmedUsername.length === 0) {
      return NextResponse.json({ error: 'Username cannot be empty' }, { status: 400 })
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(trimmedUsername)) {
      return NextResponse.json(
        { error: 'Username can only contain letters, numbers, underscores, and hyphens' },
        { status: 400 }
      )
    }

    const validation = await validateTradingViewUsername(trimmedUsername)

    if (!validation.validuser) {
      return NextResponse.json(
        { error: 'TradingView username not found. Please check and try again.' },
        { status: 400 }
      )
    }

    const googleId = (session.user as any).googleId || ''
    const customer = await getOrCreateCustomer(session.user.email, googleId)

    await updateCustomerTradingViewUsername(customer.id, validation.verifiedUserName)

    return NextResponse.json({
      success: true,
      verifiedUsername: validation.verifiedUserName,
    })
  } catch (error) {
    console.error('TradingView validation error:', error)
    return NextResponse.json(
      { error: 'Failed to validate username. Please try again.' },
      { status: 500 }
    )
  }
}
