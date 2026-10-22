import { GiftCardSkeleton } from "@/components/gift/GiftCardSkeleton";

const mainStyle = { maxWidth: 480, margin: "4rem auto", padding: "0 clamp(1rem, 4vw, 1.5rem)" };

export default function GiftClaimLoading() {
  return (
    <main style={mainStyle} aria-busy="true">
      <GiftCardSkeleton count={1} />
    </main>
  );
}
