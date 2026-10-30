import { notFound } from "next/navigation";

/**
 * Test-only pages that render the sell and edit forms without a Supabase session, so e2e can
 * drive them with page.route mocks and never write to the real database. Off unless the server
 * process is started with E2E_FORM_HARNESS=1 (CI e2e job, local QA), and never on Vercel production.
 * The forms only render client components; every write still needs a real session server-side.
 */
export function requireE2eHarness() {
  if (process.env.E2E_FORM_HARNESS !== "1" || process.env.VERCEL_ENV === "production") notFound();
}

export const E2E_HARNESS_LISTING_ID = "00000000-0000-4000-8000-0000000000e2";
