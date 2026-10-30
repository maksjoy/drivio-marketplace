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

/**
 * `fav` for someone who is already signed in when they open /login: only applied when `next`
 * is that same listing's page (`/listings/<fav>`), so a link cannot save an unrelated car.
 */
export function listingFavoriteFromNext(next: string | string[] | null | undefined, fav: string | string[] | null | undefined): string | null {
  const id = favoriteAfterLogin(fav);
  if (!id) return null;
  const path = safeRedirectPath(firstValue(next), BASE);
  const pathname = path.split(/[?#]/, 1)[0].toLowerCase();
  return pathname === `/listings/${id}` ? id : null;
}

/** /login link for a guest who tapped "Add to favorites": come back here and save the car. */
export function guestFavoriteLoginHref(currentPath: string, listingId: string): string {
  const params = new URLSearchParams({ next: safeRedirectPath(currentPath, BASE) });
  const fav = favoriteAfterLogin(listingId);
  if (fav) params.set("fav", fav);
  return `/login?${params.toString()}`;
}

export type SignedInLoginView =
  | { kind: "redirect"; to: string }
  | { kind: "favorite"; next: string; favoriteId: string };

/** Sec-Fetch-Site values that mean the user navigated within this site or typed/bookmarked the URL. */
const FIRST_PARTY_NAVIGATION = new Set(["same-origin", "none"]);

/**
 * What /login shows someone who is already signed in. Pure decision, no writes: a valid
 * listing `fav` is handed to the client (SignedInLoginRedirect), which does the POST, but only
 * when the request's Sec-Fetch-Site is "same-origin" or "none". A link from another site
 * (cross-site, same-site) or a client that sends no header gets the plain redirect, no favorite.
 */
export function signedInLoginView(
  params: { next?: string | string[]; fav?: string | string[] },
  secFetchSite: string | null | undefined,
): SignedInLoginView {
  const to = signedInLoginRedirect(params.next);
  const favoriteId = listingFavoriteFromNext(params.next, params.fav);
  const firstParty = FIRST_PARTY_NAVIGATION.has(secFetchSite?.trim().toLowerCase() ?? "");
  return favoriteId && firstParty ? { kind: "favorite", next: to, favoriteId } : { kind: "redirect", to };
}
