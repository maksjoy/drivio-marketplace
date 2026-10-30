import { safeRedirectPath } from "./safe-redirect";

// Paths are resolved against a fixed placeholder origin: only same-origin relative paths survive,
// so the real host never matters.
const BASE = "https://alberta-cars.invalid";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function firstValue(value: string | string[] | null | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

/** Where a visitor who is already signed in goes instead of seeing /login. */
export function signedInLoginRedirect(next: string | string[] | null | undefined): string {
  const raw = firstValue(next);
  const path = safeRedirectPath(raw, BASE);
  // safeRedirectPath answers "/" for anything unsafe; only an explicit "/" means home.
  if (path === "/" && raw?.trim() !== "/") return "/account";
  // Never bounce back to the login page itself.
  if (path === "/login" || path.startsWith("/login?") || path.startsWith("/login/")) return "/account";
  return path;
}

/** A listing id carried through sign-in (`?fav=`) to favorite once afterwards, or null. */
export function favoriteAfterLogin(fav: string | string[] | null | undefined): string | null {
  const raw = firstValue(fav);
  return typeof raw === "string" && UUID_RE.test(raw) ? raw.toLowerCase() : null;
}

/** /login link for a guest who tapped "Add to favorites": come back here and save the car. */
export function guestFavoriteLoginHref(currentPath: string, listingId: string): string {
  const params = new URLSearchParams({ next: safeRedirectPath(currentPath, BASE) });
  const fav = favoriteAfterLogin(listingId);
  if (fav) params.set("fav", fav);
  return `/login?${params.toString()}`;
}
