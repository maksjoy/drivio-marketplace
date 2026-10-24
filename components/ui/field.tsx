import type { ReactNode } from "react";

export function Field({
  label,
  hint,
  htmlFor,
  children,
  className,
}: {
  label: string;
  hint?: string;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}) {
  const classes = `block text-sm font-medium text-ink ${className ?? ""}`;
  const hintId = htmlFor && hint ? `${htmlFor}-hint` : undefined;
  const hintText = hint ? (
    <span id={hintId} className="mt-1 block text-xs font-normal text-muted">{hint}</span>
  ) : null;

  if (htmlFor) {
    return (
      <div className={classes}>
        <label htmlFor={htmlFor} className="mb-1.5 block">{label}</label>
        {children}
        {hintText}
      </div>
    );
  }

  return (
    <label className={classes}>
      <span className="mb-1.5 block">{label}</span>
      {children}
      {hintText}
    </label>
  );
}
