"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

const REASONS = [
  "Scam or fraud",
  "Dealer, not a private seller",
  "Incorrect information",
  "Already sold",
  "Other",
] as const;

export function ReportButton({ listingId, signedIn }: { listingId: string; signedIn: boolean }) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  const [label, setLabel] = useState("Report listing");
  const [reason, setReason] = useState<(typeof REASONS)[number]>(REASONS[0]);
  const [details, setDetails] = useState("");
  const [error, setError] = useState<string | null>(null);

  function openReport() {
    if (!signedIn) {
      router.push("/login");
      return;
    }
    setError(null);
    dialogRef.current?.showModal();
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId, reason, details: details.trim() || undefined }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(body.error || "Could not submit report.");
        return;
      }
      setLabel("Reported");
      dialogRef.current?.close();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={openReport}
        disabled={busy || label === "Reported"}
        className="rounded-full border border-line-strong bg-white px-4 py-2 text-sm font-medium disabled:opacity-50"
      >
        {label}
      </button>
      <dialog
        ref={dialogRef}
        aria-labelledby="report-listing-title"
        className="w-[min(100%,28rem)] rounded-2xl border border-line bg-white p-0 text-ink backdrop:bg-black/50"
      >
        <form onSubmit={submit} className="p-5">
          <h2 id="report-listing-title" className="text-lg font-semibold">Report listing</h2>
          <p className="mt-1 text-sm text-muted">Tell us what is wrong with this listing.</p>
          <label className="mt-4 block text-sm font-medium">
            Reason
            <select
              name="reason"
              value={reason}
              onChange={(event) => setReason(event.target.value as (typeof REASONS)[number])}
              className="input mt-1"
            >
              {REASONS.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </label>
          <label className="mt-3 block text-sm font-medium">
            Details <span className="font-normal text-muted">(optional)</span>
            <textarea
              name="details"
              value={details}
              onChange={(event) => setDetails(event.target.value)}
              maxLength={1000}
              rows={4}
              className="input mt-1"
            />
          </label>
          {error && <p className="mt-3 rounded-lg bg-danger-soft p-3 text-sm text-danger" role="alert">{error}</p>}
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="rounded-full border border-line-strong px-4 py-2 text-sm font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {busy ? "Sending…" : "Submit report"}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
