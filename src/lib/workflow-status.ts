import type { WorkflowState, WorkflowType } from "./types";

export const WORKFLOW_TYPES: WorkflowType[] = ["referral", "medication", "narrative", "call"];

export const WORKFLOW_STATES: WorkflowState[] = [
  "not_started",
  "needs_review",
  "ready_to_sync",
  "synced",
];

export const WORKFLOW_TYPE_LABEL: Record<WorkflowType, string> = {
  referral: "Referral",
  medication: "Medication",
  narrative: "Narrative",
  call: "Call",
};

export const WORKFLOW_STATE_LABEL: Record<WorkflowState, string> = {
  not_started: "Not Started",
  needs_review: "Needs Review",
  ready_to_sync: "Ready to Sync",
  synced: "Synced",
};
