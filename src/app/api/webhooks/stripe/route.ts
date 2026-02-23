import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { grantAccess, revokeAccess } from '@/lib/tradingview'
import Stripe from 'stripe'

export async function POST(request: NextRequest) {
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session

        if (session.mode === 'subscription' && session.customer) {
          const customer = await stripe.customers.retrieve(session.customer as string)

          if (customer && !customer.deleted) {
            const tradingViewUsername = customer.metadata?.tradingViewUsername

            if (tradingViewUsername) {
              try {
                await grantAccess(tradingViewUsername, '1M')
                console.log(`Granted TradingView access to ${tradingViewUsername}`)
              } catch (error) {
                console.error('Failed to grant TradingView access:', error)
              }
            }
          }
        }
        break
      }

      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice

        if (invoice.subscription && invoice.customer) {
          const customer = await stripe.customers.retrieve(invoice.customer as string)

          if (customer && !customer.deleted) {
            const tradingViewUsername = customer.metadata?.tradingViewUsername

            if (tradingViewUsername) {
              try {
                await grantAccess(tradingViewUsername, '1M')
                console.log(`Extended TradingView access for ${tradingViewUsername}`)
              } catch (error) {
                console.error('Failed to extend TradingView access:', error)
              }
            }
          }
        }
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription

        if (subscription.customer) {
          const customer = await stripe.customers.retrieve(subscription.customer as string)

          if (customer && !customer.deleted) {
            const tradingViewUsername = customer.metadata?.tradingViewUsername

            if (tradingViewUsername) {
              try {
                await revokeAccess(tradingViewUsername)
                console.log(`Revoked TradingView access for ${tradingViewUsername}`)
              } catch (error) {
                console.error('Failed to revoke TradingView access:', error)
              }
            }
          }
        }
        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription

        if (subscription.status === 'canceled' || subscription.status === 'unpaid') {
          if (subscription.customer) {
            const customer = await stripe.customers.retrieve(subscription.customer as string)

            if (customer && !customer.deleted) {
              const tradingViewUsername = customer.metadata?.tradingViewUsername

              if (tradingViewUsername) {
                try {
                  await revokeAccess(tradingViewUsername)
                  console.log(`Revoked TradingView access for ${tradingViewUsername} due to ${subscription.status}`)
                } catch (error) {
                  console.error('Failed to revoke TradingView access:', error)
                }
              }
            }
          }
        }
        break
      }

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Webhook processing error:', error)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}
