import type { ReactNode } from "react";

const tones = {
  neutral: "bg-surface-sunken text-ink-soft",
  primary: "bg-primary-soft text-primary-strong",
  rose: "bg-wildrose-50 text-wildrose-700",
};

export function Chip({ children, tone = "neutral" }: { children: ReactNode; tone?: keyof typeof tones }) {
  return <span className={`inline-flex items-center rounded-full px-3 py-1.5 text-xs font-semibold ${tones[tone]}`}>{children}</span>;
}
