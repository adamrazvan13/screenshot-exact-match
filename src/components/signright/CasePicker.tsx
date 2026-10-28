import { Link } from "@tanstack/react-router";
import { useCases } from "@/lib/signright/store";
import { Card, StatusBadge } from "./ui";

export function CasePicker({ to }: { to: "/investigation" | "/resolution" }) {
  const cases = useCases();
  return (
    <Card title="Select a case">
      {cases.length === 0 && <p className="text-sm text-muted-foreground">Loading…</p>}
      <div className="divide-y">
        {cases.map((c) => (
          <Link key={c.id} to={to} search={{ id: c.id }} className="flex items-center justify-between py-3 text-sm hover:text-foreground">
            <span className="font-medium">{c.input.company.name}</span>
            <StatusBadge status={c.result.overall} />
          </Link>
        ))}
      </div>
    </Card>
  );
}
