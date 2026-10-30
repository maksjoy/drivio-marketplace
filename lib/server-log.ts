import * as Sentry from "@sentry/nextjs";

function errorFields(error: unknown) {
  if (!error || typeof error !== "object") return { message: String(error ?? "Unknown server error") };
  const record = error as Record<string, unknown>;
  return {
    message: typeof record.message === "string" ? record.message : "Unknown server error",
    code: typeof record.code === "string" || typeof record.code === "number" ? record.code : undefined,
    details: typeof record.details === "string" ? record.details : undefined,
    hint: typeof record.hint === "string" ? record.hint : undefined,
  };
}

export function logServerError(context: string, error: unknown) {
  const fields = errorFields(error);
  console.error(context, fields);
  const exception = error instanceof Error ? error : new Error(fields.message || context);
  Sentry.captureException(exception, { tags: { context }, extra: fields });
}

export function isUniqueViolation(error: { message?: string; code?: string } | null | undefined) {
  if (!error) return false;
  const code = String(error.code || "");
  const message = (error.message || "").toLowerCase();
  return code === "23505" || message.includes("duplicate key") || message.includes("duplicate");
}
