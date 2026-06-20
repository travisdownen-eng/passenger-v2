import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import { patientQuery, patientVisitsQuery } from "@/lib/queries";
import { formatDateMMDDYYYY, fullName } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/patients/$id")({
  loader: ({ context, params }) =>
    Promise.all([
      context.queryClient.ensureQueryData(patientQuery(params.id)),
      context.queryClient.ensureQueryData(patientVisitsQuery(params.id)),
    ]),
  component: PatientWorkspaceLayout,
});

function PatientWorkspaceLayout() {
  const { id } = Route.useParams();
  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-y-auto">
      <Suspense fallback={<HeaderSkeleton />}>
        <PatientHeader id={id} />
      </Suspense>
      <Outlet />
    </div>
  );
}

function PatientHeader({ id }: { id: string }) {
  const { data: patient } = useSuspenseQuery(patientQuery(id));
  const { data: visits } = useSuspenseQuery(patientVisitsQuery(id));
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (!patient) {
    return (
      <div className="p-8">
        <Link to="/patients" className="text-sm text-primary hover:underline">
          ← Back to patients
        </Link>
        <p className="mt-4 text-muted-foreground">Patient not found.</p>
      </div>
    );
  }

  const visitType = visits[0]?.visit_type ?? null;
  const isSubsequentVisit = visitType === "Subsequent";

  const tabs = isSubsequentVisit
    ? [
        { to: `/patients/${id}`, label: "Chart Assistant", exact: true },
        { to: `/patients/${id}/narrative`, label: "Narrative Assistant" },
        { to: `/patients/${id}/reconcile`, label: "Medication Assistant" },
        { to: `/patients/${id}/calls`, label: "Call Assistant" },
        { to: `/patients/${id}/upload`, label: "Upload Documents" },
      ]
    : [
        { to: `/patients/${id}`, label: "Chart Assistant", exact: true },
        { to: `/patients/${id}/reconcile`, label: "Medication Assistant" },
        { to: `/patients/${id}/narrative`, label: "Narrative Assistant" },
        { to: `/patients/${id}/calls`, label: "Call Assistant" },
        { to: `/patients/${id}/upload`, label: "Upload Documents" },
      ];
  const episode =
    patient.episode_start_date && patient.episode_end_date
      ? `${formatDateMMDDYYYY(patient.episode_start_date)} – ${formatDateMMDDYYYY(patient.episode_end_date)}`
      : null;

  return (
    <>
      <div className="bg-surface px-6 lg:px-8 pt-3 pb-2">
        <Link
          to="/patients"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" /> All patients
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
          <h1 className="text-lg font-display font-semibold tracking-tight">
            {fullName(patient)}
          </h1>
          {visitType && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-primary text-primary-foreground text-xs font-bold uppercase tracking-wider">
              {visitType}
            </span>
          )}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-0.5 text-xs">
          {patient.dob && (
            <span>
              <span className="text-muted-foreground uppercase tracking-wide">DOB:</span>{' '}
              <span className="font-medium text-foreground">{formatDateMMDDYYYY(patient.dob)}</span>
            </span>
          )}
          {patient.physician_name && (
            <span>
              <span className="text-muted-foreground uppercase tracking-wide">Physician:</span>{' '}
              <span className="font-medium text-foreground">{patient.physician_name}</span>
            </span>
          )}
          {patient.physician_phone && (
            <span>
              <span className="text-muted-foreground uppercase tracking-wide">Phone:</span>{' '}
              <span className="font-medium text-foreground">{patient.physician_phone}</span>
            </span>
          )}
          {episode && (
            <span>
              <span className="text-muted-foreground uppercase tracking-wide">Episode:</span>{' '}
              <span className="font-medium text-foreground">{episode}</span>
            </span>
          )}
        </div>
      </div>
      <nav className="sticky top-0 z-10 flex gap-1 bg-surface/95 backdrop-blur-sm border-b border-border px-6 lg:px-8 py-2">
        {tabs.map((t) => {
          const active = t.exact ? pathname === t.to : pathname.startsWith(t.to);
          return (
            <Link
              key={t.to}
              to={t.to}
              className={cn(
                "px-3 py-1.5 text-sm font-medium border-b-2 transition-colors",
                active
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}

function HeaderSkeleton() {
  return (
    <div className="animate-pulse contents">
      <div className="bg-surface px-6 lg:px-8 pt-3 pb-2">
        <div className="h-3 w-24 bg-muted rounded mb-2" />
        <div className="h-5 w-48 bg-muted rounded mb-1" />
        <div className="h-3 w-72 bg-muted rounded" />
      </div>
      <div className="sticky top-0 z-10 bg-surface/95 border-b border-border px-6 lg:px-8 py-2">
        <div className="h-7 w-80 bg-muted rounded" />
      </div>
    </div>
  );
}
