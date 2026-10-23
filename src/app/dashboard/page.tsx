"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { GiftCard } from "@/components/gift/GiftCard";
import { GiftCardSkeleton } from "@/components/gift/GiftCardSkeleton";
import styles from "./page.module.css";
import type { ApiResponse } from "@/types";
import type { GiftAnalytics, GiftPage } from "@/server/services/gift.service";
import { formatNGN } from "@/lib/currency";

const PAGE_SIZE = 10;
const DATE_FORMATTER = new Intl.DateTimeFormat(undefined, {
  year: "numeric",
  month: "short",
  day: "numeric",
});

async function fetchGiftsCursor(cursor: string | null, pageSize: number): Promise<GiftPage> {
  const params = new URLSearchParams({ pageSize: String(pageSize) });
  if (cursor) params.set("cursor", cursor);
  const res = await fetch(`/api/v1/gifts?${params.toString()}`);
  const json: ApiResponse<GiftPage> = await res.json();
  if (!json.success) throw new Error(json.error);
  return json.data;
}

async function fetchGiftAnalytics(): Promise<GiftAnalytics> {
  const res = await fetch("/api/v1/gifts/analytics");
  const json: ApiResponse<GiftAnalytics> = await res.json();
  if (!json.success) throw new Error(json.error);
  return json.data;
}

function formatDuration(milliseconds: number | null): string {
  if (milliseconds === null) return "Not yet available";
  const hours = Math.round(milliseconds / (60 * 60 * 1000));
  if (hours < 24) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}

function formatDate(value: Date | string): string {
  return DATE_FORMATTER.format(new Date(value));
}

function statusLabel(status: GiftAnalytics["gifts"][number]["status"]): string {
  if (status === "claimed") return "Claimed";
  if (status === "expired") return "Expired";
  if (status === "unlocked") return "Ready to claim";
  if (status === "funded" || status === "locked") return "Awaiting unlock";
  return status;
}

export default function DashboardPage() {
  // Stack of cursors visited — index 0 is always null (first page).
  const [cursorStack, setCursorStack] = useState<Array<string | null>>([null]);
  const [stackIndex, setStackIndex] = useState(0);

  const cursor = cursorStack[stackIndex];
  const pageNumber = stackIndex + 1;

  const { data, status, isFetching, isStale, refetch } = useQuery({
    queryKey: ["gifts", "cursor", cursor],
    queryFn: () => fetchGiftsCursor(cursor, PAGE_SIZE),
  });
  const {
    data: analytics,
    status: analyticsStatus,
    refetch: refetchAnalytics,
  } = useQuery({
    queryKey: ["gift-analytics"],
    queryFn: fetchGiftAnalytics,
    refetchInterval: 30_000,
  });

  const canGoNext = Boolean(data?.nextCursor) && !isFetching;
  const canGoPrev = stackIndex > 0 && !isFetching;

  function goNext() {
    if (!data?.nextCursor) return;
    const newStack = [...cursorStack.slice(0, stackIndex + 1), data.nextCursor];
    setCursorStack(newStack);
    setStackIndex((i) => i + 1);
  }

  function goPrev() {
    if (stackIndex === 0) return;
    setStackIndex((i) => i - 1);
  }

  // ── Loading (initial fetch) ──────────────────────────────────────────────
  if (status === "pending") {
    return (
      <div className={styles.page}>
        <div className="container">
          <h1 className={styles.title}>Your Gifts</h1>
          <div className={styles.grid} aria-live="polite" aria-busy="true">
            <GiftCardSkeleton count={PAGE_SIZE} />
          </div>
        </div>
      </div>
    );
  }

  // ── Error / failed fetch ─────────────────────────────────────────────────
  if (status === "error") {
    return (
      <div className={styles.page}>
        <div className="container">
          <h1 className={styles.title}>Your Gifts</h1>
          <div className={styles.errorState} role="alert">
            <p className={styles.errorMessage}>Failed to load your gifts. Please try again.</p>
            <button
              className="btn btn--secondary"
              onClick={() => refetch()}
              aria-label="Retry loading gifts"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  const { gifts, total, nextCursor } = data!;

  return (
    <div className={styles.page}>
      <div className="container">
        <h1 className={styles.title}>Your Gifts</h1>

        <section className={styles.analytics} aria-labelledby="analytics-title">
          <div className={styles.analyticsHeader}>
            <h2 id="analytics-title" className={styles.analyticsTitle}>
              Gift analytics
            </h2>
            <span className={styles.refreshNote}>Updates every 30 seconds</span>
          </div>

          {analyticsStatus === "pending" ? (
            <p className={styles.analyticsMessage} role="status" aria-busy="true">
              Loading gift analytics…
            </p>
          ) : analyticsStatus === "error" ? (
            <div className={styles.analyticsError} role="alert">
              <p>Gift analytics could not be loaded.</p>
              <button className="btn btn--secondary" onClick={() => refetchAnalytics()}>
                Retry
              </button>
            </div>
          ) : analytics ? (
            <>
              <div className={styles.metrics}>
                <div className={styles.metric}>
                  <span className={styles.metricLabel}>Gifts sent</span>
                  <strong className={styles.metricValue}>{analytics.totalGiftsSent}</strong>
                </div>
                <div className={styles.metric}>
                  <span className={styles.metricLabel}>Total value</span>
                  <strong className={styles.metricValue}>
                    {formatNGN(analytics.totalValueNgn)}
                  </strong>
                </div>
                <div className={styles.metric}>
                  <span className={styles.metricLabel}>Claim rate</span>
                  <strong className={styles.metricValue}>{Math.round(analytics.claimRate)}%</strong>
                </div>
                <div className={styles.metric}>
                  <span className={styles.metricLabel}>Avg. time to claim</span>
                  <strong className={styles.metricValue}>
                    {formatDuration(analytics.averageTimeToClaimMs)}
                  </strong>
                </div>
              </div>

              <div className={styles.claimChart}>
                <div className={styles.chartHeading}>
                  <h3>Claimed gifts</h3>
                  <span>
                    {analytics.claimedGiftCount} of {analytics.totalGiftsSent}
                  </span>
                </div>
                <div
                  className={styles.chartTrack}
                  role="img"
                  aria-label={`${analytics.claimedGiftCount} of ${analytics.totalGiftsSent} gifts claimed`}
                >
                  <span
                    className={styles.chartClaimed}
                    style={{ width: `${analytics.claimRate}%` }}
                  />
                </div>
              </div>

              <div className={styles.analyticsListSection}>
                <h3 className={styles.listTitle}>Gift activity</h3>
                {analytics.gifts.length === 0 ? (
                  <p className={styles.analyticsMessage}>Sent gift activity will appear here.</p>
                ) : (
                  <div className={styles.analyticsList}>
                    {analytics.gifts.map((gift) => (
                      <article className={styles.analyticsRow} key={gift.id}>
                        <div className={styles.giftAmount}>
                          <strong>{formatNGN(gift.amountNgn)}</strong>
                          <span>{statusLabel(gift.status)}</span>
                        </div>
                        <div className={styles.giftDate}>
                          <span>Sent</span>
                          <time dateTime={new Date(gift.sentAt).toISOString()}>
                            {formatDate(gift.sentAt)}
                          </time>
                        </div>
                        <div className={styles.giftDate}>
                          <span>Unlocks</span>
                          <time dateTime={new Date(gift.unlockAt).toISOString()}>
                            {formatDate(gift.unlockAt)}
                          </time>
                        </div>
                        <div className={styles.giftDate}>
                          <span>Claimed</span>
                          {gift.claimedAt ? (
                            <time dateTime={new Date(gift.claimedAt).toISOString()}>
                              {formatDate(gift.claimedAt)}
                            </time>
                          ) : (
                            <span className={styles.pendingDate}>Pending</span>
                          )}
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : null}
        </section>

        {/* Stale/background-revalidation banner */}
        {isStale && isFetching && (
          <p className={styles.staleBanner} aria-live="polite" aria-atomic="true">
            Refreshing…
          </p>
        )}

        {gifts.length === 0 && stackIndex === 0 ? (
          // ── Empty state ───────────────────────────────────────────────────
          <div className={styles.empty} role="status" aria-label="No gifts found">
            <div className={styles.emptyIconWrapper} aria-hidden="true">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="40"
                height="40"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="8" width="18" height="4" rx="1" />
                <path d="M12 8v13" />
                <path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7" />
                <path d="M7.5 8a2.5 2.5 0 0 1 0-5A4.8 8 0 0 1 12 8a4.8 8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5" />
              </svg>
            </div>
            <h2 className={styles.emptyTitle}>No gifts yet</h2>
            <p className={styles.emptyDescription}>
              Brighten someone&apos;s day by sending a surprise cash gift!
            </p>
            <Link href="/send" className="btn btn--primary">
              Send your first gift!
            </Link>
          </div>
        ) : (
          <>
            <p className={styles.count}>
              Page {pageNumber} · {total} gift{total !== 1 ? "s" : ""} total
            </p>

            {/* Skeleton replaces grid while fetching next/prev page */}
            <div className={styles.grid} aria-live="polite" aria-busy={isFetching}>
              {isFetching ? (
                <GiftCardSkeleton count={PAGE_SIZE} />
              ) : (
                gifts.map((gift) => <GiftCard key={gift.id} gift={gift} perspective="sender" />)
              )}
            </div>

            <nav className={styles.pagination} aria-label="Gift history pagination">
              <button
                className="btn btn--secondary"
                onClick={goPrev}
                disabled={!canGoPrev}
                aria-label="Previous page"
                aria-disabled={!canGoPrev}
              >
                ← Previous
              </button>

              <span aria-live="polite" aria-atomic="true">
                Page {pageNumber}
              </span>

              <button
                className="btn btn--secondary"
                onClick={goNext}
                disabled={!canGoNext}
                aria-label={nextCursor ? "Next page" : "No more pages"}
                aria-disabled={!canGoNext}
              >
                Next →
              </button>
            </nav>
          </>
        )}
      </div>
    </div>
  );
}
