import type { ReactNode } from "react";

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`block text-sm font-medium text-ink ${className ?? ""}`}>
      <span className="mb-1.5 block">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs font-normal text-muted">{hint}</span> : null}
    </label>
  );
}
