import type { ReactNode } from "react";

const variants = {
  info: "border-primary/30 bg-primary-soft text-ink",
  success: "border-success/30 bg-success-soft text-success",
  danger: "border-danger/30 bg-danger-soft text-danger",
} as const;

export function Notice({
  variant = "info",
  children,
  className,
}: {
  variant?: keyof typeof variants;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      role="status"
      className={["rounded-card border px-4 py-3 text-sm leading-6", variants[variant], className].filter(Boolean).join(" ")}
    >
      {children}
    </div>
  );
}
