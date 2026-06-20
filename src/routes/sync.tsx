import { createFileRoute } from "@tanstack/react-router";
import { Download, Upload, RefreshCw, CheckCircle2 } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { useSync, formatSyncTimestamp } from "@/lib/sync";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/sync")({
  head: () => ({ meta: [{ title: "Sync · Passenger" }] }),
  component: SyncPage,
});

function SyncPage() {
  const sync = useSync();
  return (
    <AppShell>
      <div className="p-6 lg:p-8 max-w-[1400px] w-full mx-auto space-y-6">
        <PageHeader
          title="Sync"
          subtitle="Exchange data with the home health server. Works offline between syncs."
        />

        <section className="surface-card p-5">
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Last sync</div>
              <div className="font-mono text-lg mt-0.5">{formatSyncTimestamp(sync.lastSyncAt)}</div>
            </div>
            <button
              onClick={sync.syncNow}
              disabled={sync.syncing}
              className={cn(
                "ml-auto inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium",
                "bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-60",
              )}
            >
              <RefreshCw className={cn("size-4", sync.syncing && "animate-spin")} />
              {sync.syncing ? "Syncing…" : "Sync now"}
            </button>
          </div>
        </section>

        <div className="grid md:grid-cols-2 gap-4">
          <Panel
            icon={Download}
            title="Download"
            subtitle="Incoming from the server"
            items={[
              { label: "New patient assignments", count: Math.max(0, sync.newVisits - 1) },
              { label: "New visits", count: sync.newVisits },
              { label: "Visit changes", count: sync.newVisits > 0 ? 1 : 0 },
              { label: "Updated patient information", count: sync.newVisits > 0 ? 2 : 0 },
            ]}
          />
          <Panel
            icon={Upload}
            title="Upload"
            subtitle="Pending from this device"
            items={[
              { label: "Completed visits", count: sync.pendingUploads },
              { label: "Completed documentation", count: sync.pendingUploads },
              { label: "Medication reconciliation updates", count: sync.pendingUploads > 0 ? 1 : 0 },
              { label: "Physician communication updates", count: 0 },
            ]}
          />
        </div>

        <section className="surface-card p-5 text-sm text-muted-foreground flex items-start gap-3">
          <CheckCircle2 className="size-5 text-success shrink-0 mt-0.5" />
          <div>
            Passenger continues to work offline. Completed visits and documentation queue locally and
            upload on the next successful sync.
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function Panel({
  icon: Icon,
  title,
  subtitle,
  items,
}: {
  icon: typeof Download;
  title: string;
  subtitle: string;
  items: { label: string; count: number }[];
}) {
  return (
    <section className="surface-card overflow-hidden">
      <div className="px-5 py-3 border-b border-border bg-muted/30 flex items-center gap-2">
        <Icon className="size-4 text-muted-foreground" />
        <div>
          <div className="font-display font-semibold text-sm">{title}</div>
          <div className="text-xs text-muted-foreground">{subtitle}</div>
        </div>
      </div>
      <ul className="divide-y divide-border">
        {items.map((it) => (
          <li key={it.label} className="flex items-center justify-between px-5 py-2.5 text-sm">
            <span>{it.label}</span>
            <span
              className={cn(
                "font-semibold tabular-nums",
                it.count > 0 ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {it.count}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
