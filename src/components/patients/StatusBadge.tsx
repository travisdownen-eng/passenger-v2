import { cn } from "@/lib/utils";
import type { PatientStatus, ReconciliationStatus } from "@/lib/types";

const patientStyles: Record<PatientStatus, string> = {
  active: "bg-success/15 text-success border-success/30",
  pending_review: "bg-warning/20 text-warning-foreground border-warning/40",
  discharged: "bg-muted text-muted-foreground border-border",
  on_hold: "bg-destructive/15 text-destructive border-destructive/30",
};

const patientLabel: Record<PatientStatus, string> = {
  active: "Active",
  pending_review: "Pending Review",
  discharged: "Discharged",
  on_hold: "On Hold",
};

export function PatientStatusBadge({ status }: { status: PatientStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-xs font-medium",
        patientStyles[status],
      )}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {patientLabel[status]}
    </span>
  );
}

const reconStyles: Record<ReconciliationStatus, string> = {
  not_started: "bg-muted text-muted-foreground border-border",
  in_progress: "bg-info/15 text-info border-info/30",
  completed: "bg-success/15 text-success border-success/30",
};

const reconLabel: Record<ReconciliationStatus, string> = {
  not_started: "Not Started",
  in_progress: "In Progress",
  completed: "Completed",
};

export function ReconciliationStatusBadge({ status }: { status: ReconciliationStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-medium",
        reconStyles[status],
      )}
    >
      {reconLabel[status]}
    </span>
  );
}
