import { useMemo } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  CalendarClock,
  ListChecks,
  Sparkles,
  ChevronRight,
  Pill,
  PhoneCall,
  FileText,
  ShieldAlert,
} from "lucide-react";
import { generatedNarrativeVisitsQuery, patientsQuery } from "@/lib/queries";
import { buildSchedule, today, toISODate, type Visit } from "@/lib/visits";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import type { Patient } from "@/lib/types";

// Deterministic per-patient workflow synthesis so SSR === client.
function hash(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

type WorkflowStage =
  | "referral_received"
  | "referral_extracted"
  | "meds_uploaded"
  | "recon_complete"
  | "interactions_reviewed"
  | "physician_notified"
  | "physician_responded"
  | "ready_for_ehr";

const STAGE_ORDER: WorkflowStage[] = [
  "referral_received",
  "referral_extracted",
  "meds_uploaded",
  "recon_complete",
  "interactions_reviewed",
  "physician_notified",
  "physician_responded",
  "ready_for_ehr",
];

interface PatientWorkflow {
  patient: Patient;
  stageIndex: number; // how far along (0..STAGE_ORDER.length)
  lastWorkedDays: number; // days since last touched
  todayVisit?: Visit;
  hasMedDiscrepancies: number;
  needsPhysicianNotification: boolean;
  highSeverityInteraction: boolean;
  referralFieldsNeedReview: boolean;
  ordersAwaiting: boolean;
}

function deriveWorkflows(patients: Patient[], visits: Visit[]): PatientWorkflow[] {
  const todayISO = toISODate(today());
  const visitsByPatient = new Map<string, Visit[]>();
  for (const v of visits) {
    const arr = visitsByPatient.get(v.patientId) ?? [];
    arr.push(v);
    visitsByPatient.set(v.patientId, arr);
  }
  return patients.map((p) => {
    const seed = hash(p.id);
    const stageIndex = seed % (STAGE_ORDER.length + 1);
    const lastWorkedDays = (seed >> 4) % 6;
    const pv = visitsByPatient.get(p.id) ?? [];
    const todayVisit = pv.find((v) => v.date === todayISO && v.status === "scheduled");
    return {
      patient: p,
      stageIndex,
      lastWorkedDays,
      todayVisit,
      hasMedDiscrepancies: (seed >> 7) % 4, // 0..3
      needsPhysicianNotification: ((seed >> 11) & 0b11) === 0b10,
      highSeverityInteraction: ((seed >> 13) & 0b111) === 0b001,
      referralFieldsNeedReview: ((seed >> 17) & 0b11) === 0b01,
      ordersAwaiting: ((seed >> 19) & 0b111) === 0b100,
    };
  });
}

interface AssistantQueueItem {
  id: string;
  workflow: PatientWorkflow;
  status: "ready_for_review" | "ready_for_reconciliation" | "pending_sync";
  source: string;
}

function assistantQueueItem(workflow: PatientWorkflow): AssistantQueueItem | null {
  if (workflow.patient.status === "pending_review") {
    return {
      id: `${workflow.patient.id}:referral-extraction`,
      workflow,
      status: "ready_for_review",
      source: "Referral Extraction",
    };
  }
  if (workflow.stageIndex <= 2 || workflow.stageIndex >= STAGE_ORDER.length) return null;
  if (workflow.stageIndex === 3) {
    return {
      id: `${workflow.patient.id}:medication-images`,
      workflow,
      status: "ready_for_reconciliation",
      source: "Medication Images Uploaded",
    };
  }
  if (workflow.stageIndex === 7) {
    return {
      id: `${workflow.patient.id}:passenger-output-sync`,
      workflow,
      status: "pending_sync",
      source: "Passenger Output",
    };
  }
  return {
    id: `${workflow.patient.id}:passenger-output-review`,
    workflow,
    status: "ready_for_review",
    source: "Passenger Output",
  };
}

function assistantQueuePriority(item: AssistantQueueItem): number {
  if (item.status === "pending_sync") return 0;
  if (item.status === "ready_for_reconciliation") return 1;
  return 2;
}

export function WorkQueueDashboard() {
  const { data: patients } = useSuspenseQuery(patientsQuery());
  const { data: generatedNarrativeVisits } = useSuspenseQuery(generatedNarrativeVisitsQuery());
  const visits = useMemo(() => buildSchedule(patients), [patients]);
  const workflows = useMemo(() => deriveWorkflows(patients, visits), [patients, visits]);

  const todaysVisits = useMemo(() => {
    const todayISO = toISODate(today());
    return visits
      .filter((v) => v.date === todayISO && v.status === "scheduled")
      .sort(
        (a, b) =>
          (a.time ?? "").localeCompare(b.time ?? "") ||
          a.date.localeCompare(b.date) ||
          a.patientName.localeCompare(b.patientName),
      );
  }, [visits]);

  const assistantQueue = [
    ...workflows.map(assistantQueueItem).filter((item): item is AssistantQueueItem => item != null),
    ...generatedNarrativeVisits.flatMap((visit) => {
      const workflow = workflows.find((w) => w.patient.id === visit.patient_id);
      if (!workflow) return [];
      return [
        {
          id: `${visit.id}:narrative-documentation`,
          workflow,
          status: "ready_for_review" as const,
          source: "Narrative Documentation",
        },
      ];
    }),
  ]
    .sort(
      (a, b) =>
        assistantQueuePriority(a) - assistantQueuePriority(b) ||
        a.workflow.lastWorkedDays - b.workflow.lastWorkedDays,
    )
    .slice(0, 8);

  const aiTasks = {
    discrepancies: workflows.reduce((n, w) => n + w.hasMedDiscrepancies, 0),
    notifications: workflows.filter((w) => w.needsPhysicianNotification).length,
    interactions: workflows.filter((w) => w.highSeverityInteraction).length,
    referralReview: workflows.filter((w) => w.referralFieldsNeedReview).length,
    ordersAwaiting: workflows.filter((w) => w.ordersAwaiting).length,
  };

  return (
    <div className="h-full min-h-0 overflow-y-auto">
      <div className="p-4 sm:p-6 lg:p-8 max-w-[1200px] w-full mx-auto space-y-5">
        <header>
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
            Clinician work assistant
          </div>
          <h1 className="text-2xl font-display font-semibold tracking-tight mt-1">Today's Work</h1>
          <p className="text-sm text-muted-foreground mt-1">
            What still needs to be completed across your caseload.
          </p>
        </header>

        <AssistantQueueSection items={assistantQueue} />
        <TodaySection visits={todaysVisits} workflows={workflows} />
        <AITasksSection tasks={aiTasks} />
      </div>
    </div>
  );
}

function Section({
  title,
  icon: Icon,
  count,
  tone = "default",
  children,
  hint,
}: {
  title: string;
  icon: typeof ListChecks;
  count?: number;
  tone?: "default" | "primary" | "warning" | "success";
  children: React.ReactNode;
  hint?: string;
}) {
  const toneCls = {
    default: "bg-muted/30",
    primary: "bg-primary/10",
    warning: "bg-warning/10",
    success: "bg-success/10",
  }[tone];
  return (
    <section className="surface-card overflow-hidden">
      <div
        className={cn(
          "flex items-center justify-between gap-3 px-4 py-2.5 border-b border-border",
          toneCls,
        )}
      >
        <div className="flex items-center gap-2">
          <Icon className="size-4 text-muted-foreground" />
          <h2 className="font-display font-semibold text-[13px] uppercase tracking-wide">
            {title}
          </h2>
          {count != null && (
            <span className="text-[11px] px-1.5 py-0.5 rounded bg-background border border-border text-foreground font-semibold">
              {count}
            </span>
          )}
        </div>
        {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
      </div>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="px-4 py-6 text-center text-sm text-muted-foreground">{children}</div>;
}

function PatientName({ id, name }: { id: string; name: string }) {
  return (
    <Link
      to="/patients/$id"
      params={{ id }}
      className="font-medium text-foreground hover:text-primary"
    >
      {name}
    </Link>
  );
}

function visitTypeLabel(t: Visit["visitType"]): string {
  return {
    SOC: "Start of Care",
    ROC: "Resumption of Care",
    Recert: "Recertification",
    Reassessment: "Reassessment",
    Subsequent: "Subsequent Visit",
    Discharge: "Agency Discharge",
    DisciplineDischarge: "Discipline Discharge",
    PRN: "PRN Visit",
  }[t];
}

function TodaySection({ visits, workflows }: { visits: Visit[]; workflows: PatientWorkflow[] }) {
  const wfById = new Map(workflows.map((w) => [w.patient.id, w]));
  return (
    <Section title="Today's Schedule" icon={CalendarClock} count={visits.length} tone="primary">
      {visits.length === 0 ? (
        <Empty>No visits scheduled today.</Empty>
      ) : (
        <ul className="divide-y divide-border">
          {visits.map((v) => {
            const wf = wfById.get(v.patientId);
            const dueLabel = computeDueLabel(v);
            return (
              <li key={v.id} className="px-4 py-3 flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <PatientName id={v.patientId} name={v.patientName} />
                  <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5">
                    <span className="font-medium text-foreground/80">
                      {visitTypeLabel(v.visitType)}
                    </span>
                    {dueLabel && <span>· {dueLabel}</span>}
                    {wf && wf.stageIndex > 1 && wf.stageIndex < STAGE_ORDER.length && (
                      <span>· Passenger output available</span>
                    )}
                  </div>
                </div>
                <Link
                  to="/patients/$id"
                  params={{ id: v.patientId }}
                  className="text-xs font-medium text-primary hover:underline whitespace-nowrap"
                >
                  Open <ChevronRight className="inline size-3" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
}

function computeDueLabel(v: Visit): string | null {
  if (v.visitType === "SOC") return `Due by ${formatDate(v.date)}`;
  if (v.visitType === "Recert" || v.visitType === "Reassessment") {
    if (v.oasisDueDate) return `OASIS due ${formatDate(v.oasisDueDate)}`;
    return `Window through ${formatDate(v.date)}`;
  }
  return null;
}

function AssistantQueueSection({ items }: { items: AssistantQueueItem[] }) {
  return (
    <Section
      title="Pending Sync / Ready for Review"
      icon={ListChecks}
      count={items.length}
      tone="warning"
      hint="Passenger-prepared output"
    >
      {items.length === 0 ? (
        <Empty>No Passenger output ready for review or sync.</Empty>
      ) : (
        <ul className="divide-y divide-border">
          {items.map((item) => (
            <AssistantQueueRow key={item.id} item={item} />
          ))}
        </ul>
      )}
    </Section>
  );
}

function AssistantQueueRow({ item }: { item: AssistantQueueItem }) {
  const { workflow: wf } = item;
  const name = `${wf.patient.first_name} ${wf.patient.last_name}`;
  const lastWorked =
    wf.lastWorkedDays === 0
      ? "Today"
      : wf.lastWorkedDays === 1
        ? "Yesterday"
        : `${wf.lastWorkedDays} days ago`;
  const statusLabel = {
    ready_for_review: "Ready for Review",
    ready_for_reconciliation: "Ready for Reconciliation",
    pending_sync: "Pending Sync",
  }[item.status];

  return (
    <li className="px-4 py-3 flex items-center gap-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <PatientName id={wf.patient.id} name={name} />
          <span className="text-[11px] px-1.5 py-0.5 rounded bg-warning/15 text-warning-foreground border border-warning/30 font-medium">
            {statusLabel}
          </span>
        </div>
        <div className="text-[11px] text-muted-foreground mt-1">
          {item.source} · Last updated:{" "}
          <span className="text-foreground font-medium">{lastWorked}</span>
        </div>
      </div>
      <Link
        to="/patients/$id"
        params={{ id: wf.patient.id }}
        className="text-xs font-medium text-primary hover:underline whitespace-nowrap shrink-0"
      >
        Open <ChevronRight className="inline size-3" />
      </Link>
    </li>
  );
}

function AITasksSection({
  tasks,
}: {
  tasks: {
    discrepancies: number;
    notifications: number;
    interactions: number;
    referralReview: number;
    ordersAwaiting: number;
  };
}) {
  const items = [
    {
      icon: Pill,
      label: "Medication Discrepancies",
      count: tasks.discrepancies,
      tone: "warning" as const,
    },
    {
      icon: PhoneCall,
      label: "Physician Notifications Pending",
      count: tasks.notifications,
      tone: "warning" as const,
    },
    {
      icon: ShieldAlert,
      label: "High Severity Interactions",
      count: tasks.interactions,
      tone: "danger" as const,
    },
    {
      icon: FileText,
      label: "Referral Fields Needing Review",
      count: tasks.referralReview,
      tone: "default" as const,
    },
    {
      icon: ListChecks,
      label: "Orders Awaiting Response",
      count: tasks.ordersAwaiting,
      tone: "default" as const,
    },
  ].filter((t) => t.count > 0);
  const total = items.reduce((n, t) => n + t.count, 0);

  return (
    <Section title="AI Tasks" icon={Sparkles} count={total}>
      {items.length === 0 ? (
        <Empty>No outstanding AI tasks.</Empty>
      ) : (
        <ul className="divide-y divide-border">
          {items.map((t) => {
            const Icon = t.icon;
            const toneCls =
              t.tone === "danger"
                ? "text-destructive bg-destructive/10 border-destructive/30"
                : t.tone === "warning"
                  ? "text-warning-foreground bg-warning/15 border-warning/30"
                  : "text-foreground bg-muted border-border";
            return (
              <li key={t.label} className="px-4 py-2.5 flex items-center gap-3">
                <Icon className="size-4 text-muted-foreground shrink-0" />
                <span className="text-sm flex-1 min-w-0 truncate">{t.label}</span>
                <span
                  className={cn(
                    "text-[11px] font-semibold px-2 py-0.5 rounded border whitespace-nowrap",
                    toneCls,
                  )}
                >
                  {t.count}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
}
