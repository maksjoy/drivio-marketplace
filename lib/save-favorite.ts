// The one place a "favorite after sign-in" is written. Runs in the browser only, as a same-origin
// POST /api/favorites (Origin/Sec-Fetch-Site checked by the CSRF middleware; the insert ignores
// duplicates, so repeating it is harmless). Never called while rendering on the server.
export async function saveFavoriteAfterLogin(listingId: string): Promise<boolean> {
  try {
    const response = await fetch("/api/favorites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listingId }),
    });
    return response.ok;
  } catch {
    return false;
  }
}
