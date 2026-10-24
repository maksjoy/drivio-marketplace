type DbError = { code?: string; message?: string } | null | undefined;

/** Never return database text. Check-constraint names stay in the server log. */
export function listingWriteError(error: DbError, fallback = "We could not save the listing.") {
  const code = error?.code ?? "";
  const raw = error?.message ?? "";
  if (code === "23514" || /check constraint/i.test(raw)) {
    return { status: 400, message: "Check the listing details." };
  }
  if (/listing limit reached/i.test(raw)) {
    return { status: 429, message: "You've reached the limit of 3 active or pending listings." };
  }
  if (/wait before creating another listing/i.test(raw)) {
    return { status: 429, message: "Please wait before creating another listing." };
  }
  if (/daily listing creation limit/i.test(raw)) {
    return { status: 429, message: "Daily listing creation limit reached." };
  }
  if (/blocked/i.test(raw)) {
    return { status: 403, message: "Your account cannot publish listings." };
  }
  if (/sold listings cannot be edited/i.test(raw)) {
    return { status: 400, message: "Sold listings cannot be edited." };
  }
  if (/return to review/i.test(raw) || /year is not allowed/i.test(raw)) {
    return { status: 400, message: "Check the listing details." };
  }
  return { status: 500, message: fallback };
}
