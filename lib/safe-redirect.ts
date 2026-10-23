const MAX_NEXT_LENGTH = 2048;

// Percent-encoded ASCII controls, DEL, and backslash. Search params are usually
// decoded before we see them; this also rejects values that are still encoded.
const ENCODED_UNSAFE = /%(?:5c|7f|0[0-9a-f]|1[0-9a-f])/i;

function hasControlOrBackslash(value: string) {
  if (value.includes("\\")) return true;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 0x1f || code === 0x7f) return true;
  }
  return false;
}

/**
 * Resolve a post-login `next` value to a same-origin path.
 * Absolute, protocol-relative, backslash, and control-character targets become "/".
 */
export function safeRedirectPath(next: string | null | undefined, origin: string): string {
  if (typeof next !== "string" || next.length === 0 || next.length > MAX_NEXT_LENGTH) return "/";
  if (hasControlOrBackslash(next) || ENCODED_UNSAFE.test(next)) return "/";

  let base: URL;
  let target: URL;
  try {
    base = new URL(origin);
    target = new URL(next, base);
  } catch {
    return "/";
  }

  if (target.origin !== base.origin) return "/";
  if (!target.pathname.startsWith("/") || target.pathname.startsWith("//")) return "/";
  if (hasControlOrBackslash(target.pathname) || hasControlOrBackslash(target.search)) return "/";
  if (ENCODED_UNSAFE.test(target.pathname) || ENCODED_UNSAFE.test(target.search)) return "/";

  return `${target.pathname}${target.search}`;
}
