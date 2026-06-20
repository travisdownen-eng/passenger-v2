import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Plus, Upload, Search, FileText } from "lucide-react";
import { Suspense, useMemo, useState } from "react";
import { patientsQuery } from "@/lib/queries";
import { PageHeader } from "@/components/PageHeader";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatDateMMDDYYYY, initials } from "@/lib/format";
import type { Patient } from "@/lib/types";

export const Route = createFileRoute("/patients/")({
  head: () => ({ meta: [{ title: "Patients · Passenger" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(patientsQuery()),
  component: PatientsListPage,
});

function clinicianName(p: Patient): string {
  return `${p.last_name}, ${p.first_name}`;
}

function PatientsListPage() {
  return (
    <div className="p-6 lg:p-8 max-w-[1400px] w-full mx-auto">
      <PageHeader
        title="Patients"
        subtitle="Active caseload and physician contacts"
        actions={
          <>
            <Button asChild variant="outline" size="sm">
              <Link to="/patients/new/upload">
                <Upload className="size-4" /> Upload Referral
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/patients/new/manual">
                <Plus className="size-4" /> New Patient
              </Link>
            </Button>
          </>
        }
      />
      <Suspense fallback={<TableSkeleton />}>
        <PatientsTable />
      </Suspense>
    </div>
  );
}

function PatientsTable() {
  const { data } = useSuspenseQuery(patientsQuery());
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return data;
    return data.filter(
      (p) =>
        clinicianName(p).toLowerCase().includes(s) ||
        (p.primary_diagnosis ?? "").toLowerCase().includes(s) ||
        (p.physician_name ?? "").toLowerCase().includes(s),
    );
  }, [data, q]);

  return (
    <div className="surface-card overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name, diagnosis, or physician"
            className="pl-9 h-9"
          />
        </div>
        <div className="text-xs text-muted-foreground">
          {filtered.length} of {data.length}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground bg-muted/50">
              <th className="px-4 py-2.5 font-medium">Patient</th>
              <th className="px-4 py-2.5 font-medium">Date of Birth</th>
              <th className="px-4 py-2.5 font-medium">Diagnosis</th>
              <th className="px-4 py-2.5 font-medium">Physician</th>
              <th className="px-4 py-2.5 font-medium">Physician Phone</th>
              <th className="px-4 py-2.5 font-medium w-px" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                  <FileText className="size-8 mx-auto mb-2 opacity-40" />
                  No patients match your search.
                </td>
              </tr>
            )}
            {filtered.map((p) => (
              <tr
                key={p.id}
                className="border-t border-border hover:bg-accent/30 transition-colors"
              >
                <td className="px-4 py-3">
                  <Link
                    to="/patients/$id"
                    params={{ id: p.id }}
                    className="flex items-center gap-3 group"
                  >
                    <div className="size-9 rounded-full bg-accent text-accent-foreground flex items-center justify-center text-xs font-semibold shrink-0">
                      {initials(p)}
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium text-foreground group-hover:text-primary truncate">
                        {clinicianName(p)}
                      </div>
                    </div>
                  </Link>
                </td>
                <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                  {formatDateMMDDYYYY(p.dob)}
                </td>
                <td className="px-4 py-3 max-w-xs">
                  <div className="truncate" title={p.primary_diagnosis ?? ""}>
                    {p.primary_diagnosis ?? "—"}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="truncate" title={p.physician_name ?? ""}>
                    {p.physician_name ?? "—"}
                  </div>
                </td>
                <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                  {p.physician_phone ?? "—"}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    to="/patients/$id"
                    params={{ id: p.id }}
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    Open →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="surface-card p-6">
      <div className="animate-pulse space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-12 bg-muted rounded" />
        ))}
      </div>
    </div>
  );
}
