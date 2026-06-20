import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { Sparkles } from "lucide-react";
import {
  patientQuery,
  patientMedicationsQuery,
  patientReferralsQuery,
  patientVisitsQuery,
} from "@/lib/queries";

export const Route = createFileRoute("/patients/$id/")({
  head: () => ({ meta: [{ title: "Chart Assistant · Passenger" }] }),
  loader: ({ context, params }) =>
    Promise.all([
      context.queryClient.ensureQueryData(patientQuery(params.id)),
      context.queryClient.ensureQueryData(patientMedicationsQuery(params.id)),
      context.queryClient.ensureQueryData(patientReferralsQuery(params.id)),
      context.queryClient.ensureQueryData(patientVisitsQuery(params.id)),
    ]),
  component: ChartAssistantPage,
});

function ChartAssistantPage() {
  return (
    <div className="p-5 lg:p-6">
      <Suspense fallback={<div className="text-muted-foreground">Loading chart…</div>}>
        <ChartAssistant />
      </Suspense>
    </div>
  );
}

function ChartAssistant() {
  return (
    <div className="space-y-5">
      <section className="surface-card p-6 lg:p-8">
        <header className="flex items-center gap-2 mb-4">
          <Sparkles className="size-5 text-primary" />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground">
            Chart Summary
          </h2>
        </header>
        <div className="rounded-md bg-muted/40 border border-dashed border-border p-6 min-h-[420px] text-sm leading-relaxed text-muted-foreground italic">
          AI-generated chart summary will appear here.
        </div>
      </section>

      <section className="surface-card p-6 lg:p-8">
        <header className="flex items-center gap-2 mb-4">
          <Sparkles className="size-5 text-primary" />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground">
            Important Findings
          </h2>
        </header>
        <div className="rounded-md bg-muted/40 border border-dashed border-border p-6 min-h-[160px] text-sm leading-relaxed text-muted-foreground italic">
          AI-generated important findings will appear here.
        </div>
      </section>
    </div>
  );
}
