'use client'

import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Loader2, 
  AlertCircle, 
  CreditCard, 
  Calendar, 
  CheckCircle2,
  XCircle,
  LogOut,
  ExternalLink
} from 'lucide-react'

interface SubscriptionData {
  customerId: string
  tradingViewUsername: string | null
  hasActiveSubscription: boolean
  subscription: {
    id: string
    status: string
    planName: string
    priceAmount: number
    currency: string
    interval: string
    currentPeriodEnd: string
    cancelAtPeriodEnd: boolean
    paymentMethod: {
      brand: string
      last4: string
      expMonth: number
      expYear: number
    } | null
  } | null
}

export default function DashboardPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [data, setData] = useState<SubscriptionData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isCanceling, setIsCanceling] = useState(false)
  const [isRedirecting, setIsRedirecting] = useState(false)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/signin')
      return
    }

    if (status === 'authenticated') {
      fetchSubscriptionData()
    }
  }, [status, router])

  const fetchSubscriptionData = async () => {
    try {
      const res = await fetch('/api/subscription/status')
      const json = await res.json()

      if (!res.ok) {
        setError(json.error || 'Failed to fetch subscription data')
        return
      }

      if (!json.tradingViewUsername) {
        router.push('/onboarding')
        return
      }

      if (!json.hasActiveSubscription) {
        router.push('/checkout')
        return
      }

      setData(json)
    } catch (err) {
      setError('Failed to load subscription data')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCancel = async () => {
    setIsCanceling(true)
    setError(null)

    try {
      const res = await fetch('/api/subscription/cancel', {
        method: 'POST',
      })

      const json = await res.json()

      if (!res.ok) {
        setError(json.error || 'Failed to cancel subscription')
        return
      }

      await fetchSubscriptionData()
      setShowCancelConfirm(false)
    } catch (err) {
      setError('Failed to cancel subscription')
    } finally {
      setIsCanceling(false)
    }
  }

  const handleManageBilling = async () => {
    setIsRedirecting(true)
    setError(null)

    try {
      const res = await fetch('/api/billing-portal', {
        method: 'POST',
      })

      const json = await res.json()

      if (!res.ok) {
        setError(json.error || 'Failed to open billing portal')
        setIsRedirecting(false)
        return
      }

      if (json.url) {
        window.location.href = json.url
      }
    } catch (err) {
      setError('Failed to open billing portal')
      setIsRedirecting(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount)
  }

  if (status === 'loading' || isLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-2xl mx-auto space-y-4 py-8">
        {session?.user && (
          <div className="flex items-center justify-between p-4 bg-white rounded-lg shadow-sm">
            <div className="flex items-center gap-3">
              {session.user.image && (
                <img
                  src={session.user.image}
                  alt=""
                  className="w-10 h-10 rounded-full"
                />
              )}
              <div>
                <p className="font-medium">{session.user.name}</p>
                <p className="text-sm text-muted-foreground">{session.user.email}</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => signOut({ callbackUrl: '/signin' })}
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sign out
            </Button>
          </div>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {data?.subscription && (
          <>
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Subscription</CardTitle>
                    <CardDescription>Manage your SN Vision subscription</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    {data.subscription.cancelAtPeriodEnd ? (
                      <span className="flex items-center gap-1 text-sm text-orange-600 bg-orange-50 px-3 py-1 rounded-full">
                        <XCircle className="h-4 w-4" />
                        Canceling
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-sm text-green-600 bg-green-50 px-3 py-1 rounded-full">
                        <CheckCircle2 className="h-4 w-4" />
                        Active
                      </span>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Plan</p>
                    <p className="font-medium">{data.subscription.planName}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Price</p>
                    <p className="font-medium">
                      {formatCurrency(data.subscription.priceAmount, data.subscription.currency)}
                      /{data.subscription.interval}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      {data.subscription.cancelAtPeriodEnd ? 'Access until' : 'Next billing date'}
                    </p>
                    <p className="font-medium">{formatDate(data.subscription.currentPeriodEnd)}</p>
                  </div>
                  {data.subscription.paymentMethod && (
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <CreditCard className="h-4 w-4" />
                        Payment method
                      </p>
                      <p className="font-medium capitalize">
                        {data.subscription.paymentMethod.brand} •••• {data.subscription.paymentMethod.last4}
                      </p>
                    </div>
                  )}
                </div>

                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-xs text-muted-foreground">TradingView Username</p>
                  <p className="font-medium">{data.tradingViewUsername}</p>
                </div>

                {data.subscription.cancelAtPeriodEnd && (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Your subscription will end on {formatDate(data.subscription.currentPeriodEnd)}. 
                      You will lose access to the indicator after this date.
                    </AlertDescription>
                  </Alert>
                )}

                <div className="flex flex-col sm:flex-row gap-3">
                  <Button
                    onClick={handleManageBilling}
                    disabled={isRedirecting}
                    variant="outline"
                    className="flex-1"
                  >
                    {isRedirecting ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <ExternalLink className="mr-2 h-4 w-4" />
                    )}
                    Manage Billing
                  </Button>

                  {!data.subscription.cancelAtPeriodEnd && (
                    <Button
                      onClick={() => setShowCancelConfirm(true)}
                      variant="destructive"
                      className="flex-1"
                    >
                      Cancel Subscription
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {showCancelConfirm && (
              <Card className="border-destructive">
                <CardHeader>
                  <CardTitle className="text-destructive">Confirm Cancellation</CardTitle>
                  <CardDescription>
                    Are you sure you want to cancel your subscription?
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Your subscription will remain active until {formatDate(data.subscription.currentPeriodEnd)}.
                    After that, you will lose access to the SN Vision indicator.
                  </p>
                  <div className="flex gap-3">
                    <Button
                      onClick={() => setShowCancelConfirm(false)}
                      variant="outline"
                      className="flex-1"
                      disabled={isCanceling}
                    >
                      Keep Subscription
                    </Button>
                    <Button
                      onClick={handleCancel}
                      variant="destructive"
                      className="flex-1"
                      disabled={isCanceling}
                    >
                      {isCanceling ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Canceling...
                        </>
                      ) : (
                        'Yes, Cancel'
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </main>
  )
}
