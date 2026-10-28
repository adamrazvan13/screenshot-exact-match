import { CheckCircle2, AlertTriangle, XOctagon } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { RuleStatus } from "@/lib/signright/types";

const STYLE: Record<RuleStatus, string> = {
  PASS: "bg-pass-soft text-pass border-pass/30",
  REVIEW: "bg-review-soft text-review border-review/40",
  CONFLICT: "bg-conflict-soft text-conflict border-conflict/30",
};
const ICON = { PASS: CheckCircle2, REVIEW: AlertTriangle, CONFLICT: XOctagon };

export function StatusBadge({ status }: { status: RuleStatus }) {
  const I = ICON[status];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold tracking-wide ${STYLE[status]}`}>
      <I className="h-3.5 w-3.5" />
      {status}
    </span>
  );
}

type Variant = "primary" | "accent" | "outline" | "ghost";
const BTN: Record<Variant, string> = {
  primary: "bg-primary text-primary-foreground hover:bg-primary/90",
  accent: "bg-accent text-accent-foreground hover:brightness-95 font-semibold",
  outline: "border border-input bg-card hover:bg-muted",
  ghost: "hover:bg-muted text-muted-foreground",
};

export function Btn({ variant = "outline", className = "", ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      {...p}
      className={`inline-flex items-center justify-center gap-2 rounded-md px-3.5 py-2 text-sm transition-all disabled:cursor-not-allowed disabled:opacity-50 ${BTN[variant]} ${className}`}
    />
  );
}

export function Card({ title, children, actions, className = "" }: { title?: string; children: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <section className={`card-surface p-5 ${className}`}>
      {(title || actions) && (
        <div className="mb-4 flex items-center justify-between gap-2">
          {title && <h2 className="text-base font-semibold">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

export function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
}
