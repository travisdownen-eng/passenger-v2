// Patient-centered physician call record (localStorage mock).
// One record per patient. Items are derived from the patient's reconciliation
// state (discrepancies + interactions flagged for notification) plus any
// manually-added clinician concerns. Call logs are aggregated per call attempt.

import { loadRecon, fmt, type Discrepancy, type Interaction } from "./med-reconciliation";

export type PatientCallStatus =
  | "not_started"
  | "ai_calling"
  | "voicemail_left"
  | "awaiting_response"
  | "completed"
  | "resolved";

export const PATIENT_CALL_STATUS_LABEL: Record<PatientCallStatus, string> = {
  not_started: "Not Started",
  ai_calling: "AI Calling",
  voicemail_left: "Voicemail Left",
  awaiting_response: "Awaiting Response",
  completed: "Completed",
  resolved: "Resolved",
};

export interface ManualConcern {
  id: string;
  text: string;
  createdAt: string;
}

export interface CallLogEntry {
  id: string;
  date: string; // ISO
  spokeWith: string;
  outcome: string;
  itemSummaries: string[]; // snapshot of items discussed
  status: PatientCallStatus;
}

export interface PatientCallRecord {
  status: PatientCallStatus;
  manualConcerns: ManualConcern[];
  resolvedKeys: string[]; // derived item keys that have been resolved
  resolvedManualIds: string[];
  callLogs: CallLogEntry[];
}

const KEY = (id: string) => `patient-call-record-v1:${id}`;

export type DerivedItemKind = "discrepancy" | "interaction" | "manual";

export interface DerivedCallItem {
  key: string;
  kind: DerivedItemKind;
  title: string;
  detail: string;
  resolved: boolean;
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export function emptyRecord(): PatientCallRecord {
  return {
    status: "not_started",
    manualConcerns: [],
    resolvedKeys: [],
    resolvedManualIds: [],
    callLogs: [],
  };
}

export function loadRecord(patientId: string): PatientCallRecord {
  if (typeof window === "undefined") return emptyRecord();
  try {
    const raw = localStorage.getItem(KEY(patientId));
    if (raw) {
      const r = JSON.parse(raw) as PatientCallRecord;
      r.manualConcerns ??= [];
      r.resolvedKeys ??= [];
      r.resolvedManualIds ??= [];
      r.callLogs ??= [];
      r.status ??= "not_started";
      return r;
    }
  } catch {
    /* ignore */
  }
  return emptyRecord();
}

export function saveRecord(patientId: string, record: PatientCallRecord) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY(patientId), JSON.stringify(record));
}

export function discrepancyKey(d: Discrepancy): string {
  return `disc:${d.type}:${d.medication.trim().toLowerCase()}`;
}

export function interactionKey(i: Interaction): string {
  return `intx:${i.id}`;
}

export function discrepancyTitle(d: Discrepancy): string {
  const phrase = {
    taking_not_on_referral: "not listed on referral",
    not_taking_on_referral: "on referral, patient not taking",
    taking_differently: "taking differently than referral",
  }[d.type];
  return `${d.medication}: ${phrase}`;
}

export function discrepancyDetail(d: Discrepancy): string {
  const parts: string[] = [];
  if (d.referral) parts.push(`Referral: ${d.referral}`);
  if (d.patient) parts.push(`Patient: ${d.patient}`);
  if (d.notes) parts.push(`Notes: ${d.notes}`);
  return parts.join(" • ");
}

export function interactionTitle(i: Interaction): string {
  return `${i.med_a} + ${i.med_b}`;
}

export function interactionDetail(i: Interaction): string {
  return `${i.concern} Monitor: ${i.monitor}`;
}

export interface DerivedItems {
  discrepancies: DerivedCallItem[];
  interactions: DerivedCallItem[];
  manual: DerivedCallItem[];
}

export function deriveItems(patientId: string, record: PatientCallRecord): DerivedItems {
  const recon = loadRecon(patientId);
  const resolved = new Set(record.resolvedKeys);
  const resolvedManual = new Set(record.resolvedManualIds);

  const discrepancies: DerivedCallItem[] = (recon.discrepancies ?? []).map((d) => {
    const key = discrepancyKey(d);
    return {
      key,
      kind: "discrepancy",
      title: discrepancyTitle(d),
      detail: discrepancyDetail(d),
      resolved: resolved.has(key),
    };
  });

  const interactions: DerivedCallItem[] = (recon.interactions ?? [])
    .filter((i) => {
      const doc = recon.interaction_docs?.[i.id];
      return doc?.notify_needed === "yes";
    })
    .map((i) => {
      const key = interactionKey(i);
      return {
        key,
        kind: "interaction",
        title: interactionTitle(i),
        detail: interactionDetail(i),
        resolved: resolved.has(key),
      };
    });

  const manual: DerivedCallItem[] = record.manualConcerns.map((m) => ({
    key: `manual:${m.id}`,
    kind: "manual",
    title: m.text,
    detail: "",
    resolved: resolvedManual.has(m.id),
  }));

  return { discrepancies, interactions, manual };
}

export function allUnresolved(items: DerivedItems): DerivedCallItem[] {
  return [...items.discrepancies, ...items.interactions, ...items.manual].filter((i) => !i.resolved);
}

export function allItems(items: DerivedItems): DerivedCallItem[] {
  return [...items.discrepancies, ...items.interactions, ...items.manual];
}

export function addManualConcern(record: PatientCallRecord, text: string): PatientCallRecord {
  return {
    ...record,
    manualConcerns: [
      ...record.manualConcerns,
      { id: uid(), text: text.trim(), createdAt: new Date().toISOString() },
    ],
  };
}

export function removeManualConcern(record: PatientCallRecord, id: string): PatientCallRecord {
  return {
    ...record,
    manualConcerns: record.manualConcerns.filter((m) => m.id !== id),
    resolvedManualIds: record.resolvedManualIds.filter((x) => x !== id),
  };
}

export function toggleResolved(record: PatientCallRecord, item: DerivedCallItem): PatientCallRecord {
  if (item.kind === "manual") {
    const id = item.key.replace(/^manual:/, "");
    const has = record.resolvedManualIds.includes(id);
    return {
      ...record,
      resolvedManualIds: has
        ? record.resolvedManualIds.filter((x) => x !== id)
        : [...record.resolvedManualIds, id],
    };
  }
  const has = record.resolvedKeys.includes(item.key);
  return {
    ...record,
    resolvedKeys: has
      ? record.resolvedKeys.filter((x) => x !== item.key)
      : [...record.resolvedKeys, item.key],
  };
}

export function appendCallLog(
  record: PatientCallRecord,
  entry: Omit<CallLogEntry, "id" | "date"> & { date?: string },
): PatientCallRecord {
  return {
    ...record,
    callLogs: [
      ...record.callLogs,
      { id: uid(), date: entry.date ?? new Date().toISOString(), ...entry },
    ],
  };
}

export function _uid() {
  return uid();
}

// Used to keep recon in sync — discrepancies/interactions can disappear when
// the underlying meds change. Clean up resolved keys that no longer apply.
export function pruneResolved(patientId: string, record: PatientCallRecord): PatientCallRecord {
  const items = deriveItems(patientId, record);
  const validKeys = new Set([
    ...items.discrepancies.map((d) => d.key),
    ...items.interactions.map((i) => i.key),
  ]);
  const validManual = new Set(record.manualConcerns.map((m) => m.id));
  const cleaned: PatientCallRecord = {
    ...record,
    resolvedKeys: record.resolvedKeys.filter((k) => validKeys.has(k)),
    resolvedManualIds: record.resolvedManualIds.filter((id) => validManual.has(id)),
  };
  return cleaned;
}
