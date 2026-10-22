"use client";

import { Button } from "@/components/ui/Button";

const mainStyle = { maxWidth: 480, margin: "4rem auto", padding: "0 clamp(1rem, 4vw, 1.5rem)" };

export default function GiftClaimError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main style={mainStyle}>
      <div role="alert">
        <h1>We couldn&apos;t load this gift</h1>
        <p>Something went wrong while fetching the gift. Please try again.</p>
      </div>
      <Button onClick={reset}>Retry</Button>
    </main>
  );
}
