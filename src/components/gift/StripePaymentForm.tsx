"use client";

import { useState, type FormEvent } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { Button } from "@/components/ui/Button";
import styles from "./GiftWizard.module.css";

// Loaded once per page — loadStripe caches the Stripe.js script.
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "");

interface Props {
  clientSecret: string;
  giftId: string;
}

function CheckoutForm({ giftId }: { giftId: string }) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setSubmitting(true);
    setError(null);
    const { error: stripeError } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/gifts/${giftId}/payment?provider=stripe&reference=lumigift_${giftId}`,
      },
    });
    // confirmPayment only resolves here on error — success redirects to return_url.
    if (stripeError) setError(stripeError.message ?? "Payment failed");
    setSubmitting(false);
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <PaymentElement />
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <div className={styles.nav}>
        <Button type="submit" loading={submitting} disabled={!stripe}>
          Pay now
        </Button>
      </div>
    </form>
  );
}

/** Embedded Stripe Payment Element for international (USD) payments. */
export function StripePaymentForm({ clientSecret, giftId }: Props) {
  return (
    <Elements stripe={stripePromise} options={{ clientSecret }}>
      <CheckoutForm giftId={giftId} />
    </Elements>
  );
}
