export const CAPTCHA_REQUIRED_MESSAGE = "Complete the security check and try again.";

const SITE_KEY_ENV = "NEXT_PUBLIC_TURNSTILE_SITE_KEY";

// Dynamic lookup so Next does not inline an empty key at build time. The login
// page reads this on the server and passes it to the widget.
export function turnstileSiteKey(): string {
  const value = process.env[SITE_KEY_ENV];
  return typeof value === "string" ? value.trim() : "";
}

export function captchaRequired(): boolean {
  return turnstileSiteKey().length > 0;
}

export function isCaptchaFailure(error: { message?: string; code?: string | null } | null | undefined): boolean {
  const text = `${error?.message ?? ""} ${error?.code ?? ""}`.toLowerCase();
  return text.includes("captcha");
}
