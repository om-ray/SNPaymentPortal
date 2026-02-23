"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertCircle, Check, LogOut } from "lucide-react";

export default function CheckoutPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tradingViewUsername, setTradingViewUsername] = useState<string | null>(
    null,
  );
  const [price, setPrice] = useState<{
    amount: number;
    currency: string;
    interval: string;
  } | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/signin");
      return;
    }

    if (status === "authenticated") {
      checkSubscriptionStatus();
      fetchPrice();
    }
  }, [status, router]);

  const fetchPrice = async () => {
    try {
      const res = await fetch("/api/subscription/price");
      const data = await res.json();
      if (res.ok) {
        setPrice(data);
      }
    } catch (error) {
      console.error("Error fetching price:", error);
    }
  };

  const checkSubscriptionStatus = async () => {
    try {
      const res = await fetch("/api/subscription/status");
      const data = await res.json();

      if (!data.tradingViewUsername) {
        router.push("/onboarding");
        return;
      }

      setTradingViewUsername(data.tradingViewUsername);

      if (data.hasActiveSubscription) {
        router.push("/dashboard");
        return;
      }
    } catch (error) {
      console.error("Error checking status:", error);
    } finally {
      setIsChecking(false);
    }
  };

  const handleCheckout = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/checkout/create-session", {
        method: "POST",
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to create checkout session");
        return;
      }

      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      setError("An error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (status === "loading" || isChecking) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="w-full max-w-md space-y-4">
        {session?.user && (
          <div className="flex items-center justify-between p-3 bg-white rounded-lg shadow-sm">
            <div className="flex items-center gap-3">
              {session.user.image && (
                <img
                  src={session.user.image}
                  alt=""
                  className="w-8 h-8 rounded-full"
                />
              )}
              <div className="text-sm">
                <p className="font-medium">{session.user.name}</p>
                <p className="text-muted-foreground">{session.user.email}</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => signOut({ callbackUrl: "/signin" })}
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        )}

        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold">SN Vision</CardTitle>
            <CardDescription>
              TradingView Indicator Subscription
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="text-center">
              <div className="text-4xl font-bold">
                {price ? (
                  <>
                    {new Intl.NumberFormat("en-US", {
                      style: "currency",
                      currency: price.currency,
                    }).format(price.amount)}
                    <span className="text-lg font-normal text-muted-foreground">
                      /{price.interval}
                    </span>
                  </>
                ) : (
                  <Loader2 className="h-8 w-8 animate-spin mx-auto" />
                )}
              </div>
              {price && (
                <p className="text-sm text-muted-foreground mt-1">
                  Billed {price.interval}ly
                </p>
              )}
            </div>

            <ul className="space-y-3">
              <li className="flex items-center gap-2">
                <Check className="h-5 w-5 text-green-500 flex-shrink-0" />
                <span className="text-sm">
                  Full access to SN Vision indicator
                </span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-5 w-5 text-green-500 flex-shrink-0" />
                <span className="text-sm">All future updates included</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-5 w-5 text-green-500 flex-shrink-0" />
                <span className="text-sm">Cancel anytime</span>
              </li>
            </ul>

            {tradingViewUsername && (
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-xs text-muted-foreground">
                  TradingView Username
                </p>
                <p className="font-medium">{tradingViewUsername}</p>
              </div>
            )}
          </CardContent>
          <CardFooter>
            <Button
              onClick={handleCheckout}
              disabled={isLoading}
              className="w-full h-12 text-base"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Loading...
                </>
              ) : (
                "Subscribe Now"
              )}
            </Button>
          </CardFooter>
        </Card>
      </div>
    </main>
  );
}
