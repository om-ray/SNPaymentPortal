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

interface Plan {
  id: string;
  name: string;
  priceId: string;
  planType: string;
  accessDurationMonths: number;
  bonusMonths: number;
  totalAccessMonths: number;
  price: number;
  currency: string;
  interval: string;
  description: string;
  features: string[];
}

export default function CheckoutPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tradingViewUsername, setTradingViewUsername] = useState<string | null>(
    null,
  );
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/signin");
      return;
    }

    if (status === "authenticated") {
      checkSubscriptionStatus();
      fetchPlans();
    }
  }, [status, router]);

  const fetchPlans = async () => {
    try {
      const res = await fetch("/api/subscription/plans");
      const data = await res.json();
      if (res.ok) {
        setPlans(data.plans);
        // Select the first plan by default
        if (data.plans.length > 0) {
          setSelectedPlan(data.plans[0].id);
        }
      }
    } catch (error) {
      console.error("Error fetching plans:", error);
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
    if (!selectedPlan) {
      setError("Please select a plan");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/checkout/create-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: selectedPlan }),
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

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(amount);
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
            <CardDescription>Choose your subscription plan</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {plans.length === 0 ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : (
              <div className="space-y-3">
                {plans.map((plan) => (
                  <div
                    key={plan.id}
                    onClick={() => setSelectedPlan(plan.id)}
                    className={`relative p-4 rounded-lg border-2 cursor-pointer transition-all ${
                      selectedPlan === plan.id
                        ? "border-primary bg-primary/5"
                        : "border-muted hover:border-muted-foreground/50"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <h3 className="font-semibold">{plan.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {plan.description}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold">
                          {formatCurrency(plan.price, plan.currency)}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {plan.interval}
                        </p>
                      </div>
                    </div>
                    {plan.features && plan.features.length > 0 && (
                      <ul className="mt-3 space-y-1">
                        {plan.features.map((feature, idx) => (
                          <li
                            key={idx}
                            className="flex items-center gap-2 text-sm"
                          >
                            <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                            {feature}
                          </li>
                        ))}
                      </ul>
                    )}
                    {plan.bonusMonths > 0 && (
                      <div className="mt-2 inline-block px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded">
                        +{plan.bonusMonths} bonus months included
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

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
              disabled={isLoading || !selectedPlan}
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
