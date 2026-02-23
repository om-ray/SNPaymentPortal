import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'

export async function GET() {
  try {
    const priceId = process.env.STRIPE_PRICE_ID

    if (!priceId) {
      return NextResponse.json({ error: 'Price not configured' }, { status: 500 })
    }

    const price = await stripe.prices.retrieve(priceId, {
      expand: ['product'],
    })

    const product = price.product as { name: string; description?: string }

    return NextResponse.json({
      priceId: price.id,
      amount: price.unit_amount ? price.unit_amount / 100 : 0,
      currency: price.currency,
      interval: price.recurring?.interval || 'month',
      productName: product.name,
      productDescription: product.description,
    })
  } catch (error) {
    console.error('Error fetching price:', error)
    return NextResponse.json({ error: 'Failed to fetch price' }, { status: 500 })
  }
}
