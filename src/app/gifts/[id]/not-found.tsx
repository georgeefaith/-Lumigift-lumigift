import Link from "next/link";

const mainStyle = { maxWidth: 480, margin: "4rem auto", padding: "0 clamp(1rem, 4vw, 1.5rem)" };

export default function GiftNotFound() {
  return (
    <main style={mainStyle}>
      <div role="alert">
        <h1>Gift not found</h1>
        <p>This gift link is invalid or has expired. Check the link you were sent.</p>
      </div>
      <Link href="/claim" className="btn btn--primary">
        Find your gift
      </Link>
    </main>
  );
}
