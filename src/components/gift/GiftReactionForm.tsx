"use client";

import { useState, type FormEvent } from "react";
import { useCsrf } from "@/hooks/useCsrf";
import { Button } from "@/components/ui/Button";
import { ALLOWED_REACTIONS } from "@/types/schemas";
import type { GiftReactionSummary } from "@/types";
import styles from "./GiftReactionForm.module.css";

interface Props {
  giftId: string;
  existing?: GiftReactionSummary;
}

/** Lets a recipient send one immutable emoji reaction + optional thank-you note. */
export function GiftReactionForm({ giftId, existing }: Props) {
  const { csrfFetch } = useCsrf();
  const [emoji, setEmoji] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState<GiftReactionSummary | undefined>(existing);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (sent) {
    return (
      <p className={styles.sent} role="status">
        You reacted <span aria-hidden="true">{sent.emoji}</span>
        {sent.message && <> &mdash; &ldquo;{sent.message}&rdquo;</>}
      </p>
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!emoji) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await csrfFetch(`/api/v1/gifts/${giftId}/reaction`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emoji, ...(message.trim() ? { message: message.trim() } : {}) }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setSent(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send your reaction");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <fieldset className={styles.emojis}>
        <legend>Say thanks to the sender</legend>
        {ALLOWED_REACTIONS.map((r) => (
          <button
            key={r}
            type="button"
            className={styles.emoji}
            aria-pressed={emoji === r}
            onClick={() => setEmoji(r)}
          >
            {r}
          </button>
        ))}
      </fieldset>
      <label className={styles.label}>
        Thank-you note (optional)
        <textarea
          className={styles.textarea}
          maxLength={280}
          rows={3}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
      </label>
      <p className={styles.hint}>Reactions can&rsquo;t be edited after sending.</p>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <Button type="submit" loading={submitting} disabled={!emoji}>
        Send reaction
      </Button>
    </form>
  );
}
