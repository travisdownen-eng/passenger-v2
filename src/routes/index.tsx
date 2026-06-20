import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { WorkQueueDashboard } from "@/components/schedule/WorkQueueDashboard";
import { patientsQuery } from "@/lib/queries";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [{ title: "Today's Work · Passenger" }],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(patientsQuery()),
  component: WorkQueuePage,
});

function WorkQueuePage() {
  return (
    <AppShell>
      <Suspense fallback={<DashboardSkeleton />}>
        <WorkQueueDashboard />
      </Suspense>
    </AppShell>
  );
}

function DashboardSkeleton() {
  return (
    <div className="p-6 lg:p-8 max-w-[1400px] w-full mx-auto space-y-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="surface-card h-40 animate-pulse bg-muted/50" />
      ))}
    </div>
  );
}
