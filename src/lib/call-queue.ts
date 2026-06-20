// Physician notification / call agent store (localStorage-backed mock).
// Compiles call items from medication discrepancies, interactions, high-risk
// concerns, patient-reported symptoms, and clinician-added concerns.

import type { Discrepancy, Interaction, MedEntry } from "./med-reconciliation";

export type CallIssueType =
  | "med_discrepancy"
  | "high_severity_interaction"
  | "patient_symptoms"
  | "high_risk_med"
  | "clinician_concern";

export type CallPriority = "routine" | "important" | "urgent";

export type CallStatus =
  | "needs_call"
  | "call_attempted"
  | "message_left"
  | "spoke_with_office"
  | "awaiting_orders"
  | "resolved";

export interface CallItem {
  id: string;
  type: CallIssueType;
  subject: string; // medication or clinical issue involved
  summary: string;
  reason: string;
  priority: CallPriority;
  status: CallStatus;
  createdAt: string;
  // Call documentation
  spokeWith?: string;
  outcome?: string;
  notes?: string;
  documentation?: string;
  attemptedAt?: string;
}

export interface CallAgentState {
  items: CallItem[];
  script?: string;
  scriptGeneratedAt?: string;
}

const KEY = (id: string) => `call-queue-v1:${id}`;

export const ISSUE_LABEL: Record<CallIssueType, string> = {
  med_discrepancy: "Medication discrepancy",
  high_severity_interaction: "High-severity interaction",
  patient_symptoms: "Patient experiencing symptoms",
  high_risk_med: "High-risk medication concern",
  clinician_concern: "Clinician concern",
};

export const PRIORITY_LABEL: Record<CallPriority, string> = {
  routine: "Routine",
  important: "Important",
  urgent: "Urgent",
};

export const STATUS_LABEL: Record<CallStatus, string> = {
  needs_call: "Needs Call",
  call_attempted: "Call Attempted",
  message_left: "Message Left",
  spoke_with_office: "Spoke With Office",
  awaiting_orders: "Awaiting Orders",
  resolved: "Resolved",
};

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export function loadCallQueue(patientId: string): CallAgentState {
  if (typeof window === "undefined") return { items: [] };
  try {
    const raw = localStorage.getItem(KEY(patientId));
    if (raw) return JSON.parse(raw) as CallAgentState;
  } catch {
    /* ignore */
  }
  return { items: [] };
}

export function saveCallQueue(patientId: string, state: CallAgentState) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY(patientId), JSON.stringify(state));
}

export function addCallItem(patientId: string, item: Omit<CallItem, "id" | "createdAt" | "status"> & { status?: CallStatus }): CallItem {
  const state = loadCallQueue(patientId);
  // Dedupe by subject + type to avoid double-queuing same issue
  const existing = state.items.find(
    (i) => i.type === item.type && i.subject === item.subject && i.status !== "resolved",
  );
  if (existing) return existing;
  const created: CallItem = {
    id: `call-${uid()}`,
    createdAt: new Date().toISOString(),
    status: item.status ?? "needs_call",
    ...item,
  };
  state.items = [...state.items, created];
  saveCallQueue(patientId, state);
  return created;
}

export function fromDiscrepancy(d: Discrepancy): Omit<CallItem, "id" | "createdAt" | "status"> {
  const typeLabel = {
    taking_not_on_referral: "Patient taking medication not on referral",
    not_taking_on_referral: "Referral medication patient is not taking",
    taking_differently: "Dose/frequency discrepancy",
  }[d.type];
  const summary = [
    d.referral && `Referral lists: ${d.referral}.`,
    d.patient && `Patient reports: ${d.patient}.`,
    d.notes && `Notes: ${d.notes}`,
  ]
    .filter(Boolean)
    .join(" ");
  return {
    type: "med_discrepancy",
    subject: d.medication,
    summary: summary || typeLabel,
    reason: `${typeLabel} requires physician clarification.`,
    priority: d.type === "taking_differently" ? "important" : "routine",
  };
}

export function fromInteraction(i: Interaction): Omit<CallItem, "id" | "createdAt" | "status"> {
  return {
    type: "high_severity_interaction",
    subject: `${i.med_a} + ${i.med_b}`,
    summary: `Patient is taking ${i.med_a} and ${i.med_b}.`,
    reason: `${i.concern} Monitor: ${i.monitor}.`,
    priority: i.severity === "major" ? "urgent" : i.severity === "moderate" ? "important" : "routine",
  };
}

export function fromHighRisk(med: MedEntry, cat: string): Omit<CallItem, "id" | "createdAt" | "status"> {
  return {
    type: "high_risk_med",
    subject: `${med.name} ${med.dose}`.trim(),
    summary: `${med.name} ${med.dose} (${cat}) identified on medication list.`,
    reason: `Verify dosing, education, and monitoring requirements for high-risk class: ${cat}.`,
    priority: "important",
  };
}

/* ---------- Call script + documentation generators ---------- */

export interface ScriptContext {
  patientName: string;
  patientDob: string;
  physicianName?: string | null;
}

export function generateCallScript(ctx: ScriptContext, items: CallItem[]): string {
  const active = items.filter((i) => i.status !== "resolved");
  if (active.length === 0) return "No active items in the call queue.";
  const greeting = `Hello, this is the home health clinician calling${ctx.physicianName ? ` for ${ctx.physicianName}` : ""} regarding ${ctx.patientName}, DOB ${ctx.patientDob}.`;

  const grouped: Record<CallIssueType, CallItem[]> = {
    med_discrepancy: [],
    high_severity_interaction: [],
    patient_symptoms: [],
    high_risk_med: [],
    clinician_concern: [],
  };
  active.forEach((i) => grouped[i.type].push(i));

  const sections: string[] = [];
  const orderedTypes: CallIssueType[] = [
    "high_severity_interaction",
    "med_discrepancy",
    "patient_symptoms",
    "high_risk_med",
    "clinician_concern",
  ];
  for (const t of orderedTypes) {
    const list = grouped[t];
    if (!list.length) continue;
    const lead = {
      med_discrepancy: "I am calling to report medication discrepancies.",
      high_severity_interaction: "I am calling to report a high-severity medication interaction.",
      patient_symptoms: "I am calling to report symptoms the patient is experiencing.",
      high_risk_med: "I am also calling regarding a high-risk medication.",
      clinician_concern: "I have additional clinician concerns to discuss.",
    }[t];
    sections.push(lead);
    for (const it of list) {
      sections.push(`  • ${it.subject}: ${it.summary}`);
    }
  }
  sections.push("Please advise on appropriate orders or clarification. Thank you.");
  return [greeting, ...sections].join("\n");
}

function nowStamp() {
  const d = new Date();
  const date = d.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" });
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${date} at ${time}`;
}

export function generateDocumentation(
  status: CallStatus,
  items: CallItem[],
  spokeWith?: string,
): string {
  const stamp = nowStamp();
  const issueList = items
    .filter((i) => i.status !== "resolved")
    .map((i) => ISSUE_LABEL[i.type].toLowerCase())
    .filter((v, idx, arr) => arr.indexOf(v) === idx)
    .join(" and ");
  const issuesText = issueList || "items in call queue";
  switch (status) {
    case "message_left":
      return `Physician office notified by voicemail on ${stamp} regarding ${issuesText}. Awaiting return call/orders.`;
    case "call_attempted":
      return `Call attempted to physician office on ${stamp} regarding ${issuesText}. No answer; will reattempt.`;
    case "spoke_with_office":
      return `Physician office notified on ${stamp}. Spoke with ${spokeWith || "office staff"} regarding ${issuesText}. Awaiting clarification/orders.`;
    case "awaiting_orders":
      return `Physician office notified on ${stamp}${spokeWith ? `; spoke with ${spokeWith}` : ""}. Awaiting orders for ${issuesText}.`;
    case "resolved":
      return `Physician notified on ${stamp}${spokeWith ? `. Spoke with ${spokeWith}` : ""}. ${issuesText.charAt(0).toUpperCase() + issuesText.slice(1)} reviewed and new order received/confirmed.`;
    default:
      return `Call queue updated on ${stamp}.`;
  }
}
