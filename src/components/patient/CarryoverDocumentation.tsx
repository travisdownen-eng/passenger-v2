import type { Patient } from "@/lib/types";

export function CarryoverDocumentation({ patient }: { patient: Patient }) {
  void patient;

  return (
    <section className="surface-card p-4">
      <header>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground">
          Carryover Documentation
        </h2>
        <p className="text-xs text-muted-foreground mt-1 max-w-xl">
          Applicable carryover documentation items will appear here automatically when identified
          from synced patient information, prior documentation, referral extraction, or future
          EHR synchronization.
        </p>
      </header>
    </section>
  );
}
