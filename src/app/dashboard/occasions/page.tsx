"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useCsrf } from "@/hooks/useCsrf";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import type { ApiResponse } from "@/types";
import type { Occasion } from "@/server/services/occasion.service";
import styles from "./page.module.css";

/**
 * /dashboard/occasions — save birthdays/anniversaries and get an SMS reminder
 * 7 days before each one (issue #341). Reminders can be toggled per occasion.
 */
export default function OccasionsPage() {
  const { csrfFetch } = useCsrf();
  const [occasions, setOccasions] = useState<Occasion[]>([]);
  const [contactName, setContactName] = useState("");
  const [label, setLabel] = useState("Birthday");
  const [occasionDate, setOccasionDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/v1/occasions")
      .then((res) => res.json())
      .then((json: ApiResponse<Occasion[]>) => json.success && setOccasions(json.data))
      .catch(() => setError("Could not load your occasions"));
  }, []);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await csrfFetch("/api/v1/occasions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactName, label, occasionDate }),
      });
      const json: ApiResponse<Occasion> = await res.json();
      if (!json.success) throw new Error(json.error);
      setOccasions((list) => [...list, json.data]);
      setContactName("");
      setOccasionDate("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save occasion");
    } finally {
      setSaving(false);
    }
  }

  async function toggleReminders(occasion: Occasion) {
    const res = await csrfFetch(`/api/v1/occasions/${occasion.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ remindersEnabled: !occasion.remindersEnabled }),
    });
    const json: ApiResponse<Occasion> = await res.json();
    if (json.success) {
      setOccasions((list) => list.map((o) => (o.id === occasion.id ? json.data : o)));
    }
  }

  async function remove(id: string) {
    const res = await csrfFetch(`/api/v1/occasions/${id}`, { method: "DELETE" });
    if (res.ok) setOccasions((list) => list.filter((o) => o.id !== id));
  }

  return (
    <main className={styles.page}>
      <h1>Occasions</h1>
      <p>We&rsquo;ll text you 7 days before each occasion so you never miss a gift.</p>

      <form className={styles.form} onSubmit={handleAdd} noValidate>
        <Input
          label="Contact name"
          value={contactName}
          maxLength={60}
          onChange={(e) => setContactName(e.target.value)}
          required
        />
        <Input
          label="Occasion"
          value={label}
          maxLength={60}
          onChange={(e) => setLabel(e.target.value)}
          required
        />
        <Input
          label="Date"
          type="date"
          value={occasionDate}
          onChange={(e) => setOccasionDate(e.target.value)}
          required
        />
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
        <Button type="submit" loading={saving} disabled={!contactName || !occasionDate}>
          Save occasion
        </Button>
      </form>

      <ul className={styles.list}>
        {occasions.map((o) => (
          <li key={o.id} className={styles.item}>
            <div>
              <strong>{o.contactName}</strong> &middot; {o.label} &middot; {o.occasionDate.slice(5)}
            </div>
            <div className={styles.actions}>
              <label>
                <input
                  type="checkbox"
                  checked={o.remindersEnabled}
                  onChange={() => toggleReminders(o)}
                />{" "}
                Remind me
              </label>
              <Link href={`/send?recipientName=${encodeURIComponent(o.contactName)}`}>
                Send gift
              </Link>
              <button type="button" className={styles.remove} onClick={() => remove(o.id)}>
                Remove
              </button>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
