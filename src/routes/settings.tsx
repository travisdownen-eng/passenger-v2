import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/PageHeader";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Settings · Passenger" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <AppShell>
      <div className="p-6 lg:p-8 max-w-[1400px] w-full mx-auto space-y-6">
        <PageHeader
          title="Settings"
          subtitle="Account, preferences, and agency configuration"
        />

        <section className="surface-card p-5 space-y-3">
          <div>
            <h2 className="font-display font-semibold text-sm">Clinician</h2>
            <p className="text-xs text-muted-foreground">Signed in as the active field clinician.</p>
          </div>
          <Field label="Name" value="Maria Alvarez, RN" />
          <Field label="Agency" value="Cedar Ridge Home Health" />
          <Field label="Discipline" value="Registered Nurse" />
        </section>

        <section className="surface-card p-5 space-y-3">
          <h2 className="font-display font-semibold text-sm">Preferences</h2>
          <Field label="Time zone" value="America/Los_Angeles" />
          <Field label="Default visit duration" value="45 minutes" />
          <Field label="Auto-sync on connect" value="Enabled" />
        </section>

        <section className="surface-card p-5 text-sm text-muted-foreground">
          Additional settings — notifications, OASIS preferences, integrations — coming soon.
        </section>
      </div>
    </AppShell>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm border-b border-border last:border-0 py-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
