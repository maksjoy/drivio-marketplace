import type { ReactNode } from "react";

export function fieldErrorId(htmlFor: string) {
  return `${htmlFor}-error`;
}

export function Field({
  label,
  hint,
  htmlFor,
  error,
  children,
  className,
}: {
  label: string;
  hint?: string;
  htmlFor?: string;
  /** Field-level error; rendered under the control with id `${htmlFor}-error` for aria-describedby. */
  error?: string | null;
  children: ReactNode;
  className?: string;
}) {
  const classes = `block text-sm font-medium text-ink ${className ?? ""}`;
  const hintId = htmlFor && hint ? `${htmlFor}-hint` : undefined;
  const hintText = hint ? (
    <span id={hintId} className="mt-1 block text-xs font-normal text-muted">{hint}</span>
  ) : null;
  const errorText = error ? (
    <span id={htmlFor ? fieldErrorId(htmlFor) : undefined} className="mt-1 flex items-start gap-1 text-xs font-medium text-danger">
      <svg aria-hidden="true" viewBox="0 0 20 20" className="mt-px h-3.5 w-3.5 flex-none" fill="currentColor"><path d="M10 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm-.9 4h1.8v5.2H9.1V6Zm0 6.8h1.8v1.8H9.1v-1.8Z" /></svg>
      <span>{error}</span>
    </span>
  ) : null;

  if (htmlFor) {
    return (
      <div className={classes}>
        <label htmlFor={htmlFor} className="mb-1.5 block">{label}</label>
        {children}
        {errorText}
        {hintText}
      </div>
    );
  }

  return (
    <label className={classes}>
      <span className="mb-1.5 block">{label}</span>
      {children}
      {errorText}
      {hintText}
    </label>
  );
}
