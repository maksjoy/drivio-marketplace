import assert from "node:assert/strict";
import test from "node:test";
import { favoriteAfterLogin, guestFavoriteLoginHref, signedInLoginRedirect } from "../../lib/login-redirect.ts";

const ID = "f37b9630-d284-4f98-a7d3-2b96b374cdfa";

test("signed-in /login goes to a safe next", () => {
  assert.equal(signedInLoginRedirect("/listings/abc?x=1"), "/listings/abc?x=1");
  assert.equal(signedInLoginRedirect(["/sell", "/account"]), "/sell");
  assert.equal(signedInLoginRedirect("/"), "/");
});

test("signed-in /login without a usable next goes to /account", () => {
  for (const next of [undefined, null, "", "https://evil.example/x", "//evil.example", "/\\evil.example", "javascript:alert(1)", "/%5Cevil", "/login", "/login?next=/sell"]) {
    assert.equal(signedInLoginRedirect(next), "/account", String(next));
  }
});

test("fav must be a listing UUID", () => {
  assert.equal(favoriteAfterLogin(ID), ID);
  assert.equal(favoriteAfterLogin(ID.toUpperCase()), ID);
  for (const fav of [undefined, "", "1", `${ID}x`, "../api", [ID + "'"]]) assert.equal(favoriteAfterLogin(fav), null);
});

test("guest favorite link keeps the current path and the listing", () => {
  assert.equal(guestFavoriteLoginHref(`/listings/${ID}`, ID), `/login?next=%2Flistings%2F${ID}&fav=${ID}`);
  assert.equal(guestFavoriteLoginHref("/?make=Honda&sort=price_asc", ID), `/login?next=%2F%3Fmake%3DHonda%26sort%3Dprice_asc&fav=${ID}`);
  assert.equal(guestFavoriteLoginHref("//evil.example", "not-a-uuid"), "/login?next=%2F");
});

test("signed-in /login applies fav only for that same listing's page", async () => {
  const { listingFavoriteFromNext, signedInLoginView } = await import("../../lib/login-redirect.ts");
  assert.equal(listingFavoriteFromNext(`/listings/${ID}`, ID), ID);
  assert.equal(listingFavoriteFromNext(`/listings/${ID}?photo=2`, ID.toUpperCase()), ID);
  for (const [next, fav] of [
    ["/", ID], ["/?sort=price_asc", ID], [`/listings/${ID}`, undefined], [`/listings/${ID}`, "x"],
    ["/listings/00000000-0000-4000-8000-000000000000", ID], [`https://evil.example/listings/${ID}`, ID],
    [`//evil.example/listings/${ID}`, ID], [`/listings/${ID}/../../api/favorites`, ID],
  ]) assert.equal(listingFavoriteFromNext(next, fav), null, `${next} ${fav}`);
  assert.deepEqual(signedInLoginView({ next: `/listings/${ID}`, fav: ID }), { kind: "favorite", next: `/listings/${ID}`, favoriteId: ID });
  assert.deepEqual(signedInLoginView({ next: "/sell", fav: ID }), { kind: "redirect", to: "/sell" });
  assert.deepEqual(signedInLoginView({ next: "https://evil.example", fav: ID }), { kind: "redirect", to: "/account" });
});
