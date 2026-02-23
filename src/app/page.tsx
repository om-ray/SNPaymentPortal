'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'

export default function Home() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [checking, setChecking] = useState(false)

  useEffect(() => {
    if (status === 'loading') return

    if (!session) {
      router.push('/signin')
      return
    }

    const checkSubscriptionStatus = async () => {
      setChecking(true)
      try {
        const res = await fetch('/api/subscription/status')
        const data = await res.json()

        if (!data.tradingViewUsername) {
          router.push('/onboarding')
        } else if (data.hasActiveSubscription) {
          router.push('/dashboard')
        } else {
          router.push('/checkout')
        }
      } catch (error) {
        console.error('Error checking subscription:', error)
        router.push('/onboarding')
      }
    }

    checkSubscriptionStatus()
  }, [session, status, router])

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="text-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
        <p className="text-muted-foreground">Loading...</p>
      </div>
    </main>
  )
}
