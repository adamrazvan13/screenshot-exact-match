import { Link, useRouterState } from "@tanstack/react-router";
import { FileSearch, LayoutDashboard, FilePlus2, ClipboardCheck, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";
import { useCases, useSyncStatus, type SyncStatus } from "@/lib/signright/store";

const SYNC_LABEL: Record<SyncStatus, { text: string; dot: string }> = {
  local: { text: "Saved in this browser only", dot: "bg-muted-foreground" },
  syncing: { text: "Saving to database…", dot: "bg-review" },
  synced: { text: "Saved in database", dot: "bg-pass" },
  offline: { text: "Database unreachable — saved locally", dot: "bg-conflict" },
};

export function AppShell({ children }: { children: ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const cases = useCases();
  const sync = SYNC_LABEL[useSyncStatus()];
  const latest = cases[0]?.id;
  const items = [
    { to: "/", label: "Dashboard", icon: LayoutDashboard },
    { to: "/new", label: "New Investigation", icon: FilePlus2 },
    { to: "/investigation", label: "AI Investigation", icon: FileSearch },
    { to: "/resolution", label: "Resolution Center", icon: ClipboardCheck },
  ] as const;

  return (
    <div className="flex min-h-screen w-full">
      <aside className="no-print sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground md:flex">
        <div className="flex items-center gap-2.5 border-b border-sidebar-border px-5 py-5">
          <div className="grid h-9 w-9 place-items-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <div className="font-display text-base font-semibold text-sidebar-accent-foreground">SignRight AI</div>
            <div className="text-[11px] text-sidebar-foreground/70">Corporate operations</div>
          </div>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {items.map((it) => {
            const active = it.to === "/" ? path === "/" : path.startsWith(it.to);
            const search = (it.to === "/investigation" || it.to === "/resolution") && latest ? { id: latest } : undefined;
            return (
              <Link
                key={it.to}
                to={it.to}
                search={search as never}
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "hover:bg-sidebar-accent/60"}`}
              >
                <it.icon className={`h-4 w-4 ${active ? "text-sidebar-primary" : ""}`} />
                {it.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-sidebar-border p-4 text-[11px] leading-relaxed text-sidebar-foreground/60">
          <p className="font-medium text-sidebar-primary">The right person. The right authority. The right documents.</p>
          <p className="mb-2 flex items-center gap-2 text-sidebar-foreground/80">
            <span className={`h-2 w-2 rounded-full ${sync.dot}`} /> {sync.text}
          </p>
          <p className="mt-2">Hackathon prototype · synthetic data only · not affiliated with any bank.</p>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print flex items-center gap-2 overflow-x-auto border-b bg-sidebar px-4 py-3 md:hidden">
          {items.map((it) => (
            <Link key={it.to} to={it.to} search={((it.to === "/investigation" || it.to === "/resolution") && latest ? { id: latest } : undefined) as never} className="whitespace-nowrap rounded px-2 py-1 text-xs text-sidebar-foreground">
              {it.label}
            </Link>
          ))}
        </header>
        <main className="print-full mx-auto w-full max-w-7xl flex-1 p-5 md:p-8">{children}</main>
      </div>
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold md:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="no-print flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
