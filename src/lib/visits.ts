import type { Patient } from "./types";

export type VisitType =
  | "SOC"
  | "ROC"
  | "Recert"
  | "Reassessment"
  | "Subsequent"
  | "Discharge"
  | "DisciplineDischarge"
  | "PRN";
export type Discipline = "RN" | "PT" | "OT" | "SLP" | "MSW";
export type VisitStatus =
  | "scheduled"
  | "needs_scheduling"
  | "completed"
  | "documentation_overdue"
  | "missed";
export type VisitPriority = "low" | "normal" | "high";

export interface Visit {
  id: string;
  patientId: string;
  patientName: string;
  visitType: VisitType;
  /** ISO date (UTC) of service / target date. */
  date: string;
  /** "HH:mm" 24h or null when unscheduled. */
  time: string | null;
  status: VisitStatus;
  priority: VisitPriority;
  clinician: string;
  discipline: Discipline;
  address: string;
  /** Date the visit was assigned/plotted. */
  assignedDate: string;
  /** Set when status === 'documentation_overdue'. */
  daysOverdue?: number;
  /** OASIS document due date for SOC/Recert/Reassessment. */
  oasisDueDate?: string;
}

const CLINICIANS = [
  "M. Alvarez, RN",
  "T. Patel, PT",
  "J. Chen, RN",
  "S. Okafor, OT",
  "R. Nguyen, RN",
];
const STREETS = [
  "412 Maple Ave",
  "88 Oakridge Ln",
  "1207 Birchwood Dr",
  "55 Hillcrest Ct",
  "2310 Riverbend Rd",
  "76 Cedar Hollow",
];

/** Stable seeded RNG so SSR === client. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

function hash(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Today, anchored to UTC midnight so SSR and client agree. */
export function today(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setUTCDate(r.getUTCDate() + n);
  return r;
}

export function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function formatDayLong(d: Date): string {
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function formatDayShort(d: Date): string {
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function formatTime(time: string | null): string {
  if (!time) return "—";
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hh = ((h + 11) % 12) + 1;
  return `${hh}:${m.toString().padStart(2, "0")} ${period}`;
}

const VISIT_TYPES: VisitType[] = [
  "SOC",
  "ROC",
  "Recert",
  "Reassessment",
  "Subsequent",
  "Subsequent",
  "Subsequent",
  "Discharge",
  "DisciplineDischarge",
  "PRN",
];

export function disciplineOf(clinician: string): Discipline {
  const m = clinician.match(/,\s*(RN|PT|OT|SLP|MSW)/);
  return (m?.[1] as Discipline) ?? "RN";
}

/**
 * Deterministically generate a schedule from patients. Pure function of input
 * patient list + a fixed "today" → identical SSR and client output.
 */
export function buildSchedule(patients: Patient[]): Visit[] {
  const t = today();
  const visits: Visit[] = [];

  patients.forEach((p, pi) => {
    const seed = hash(p.id);
    const r = rng(seed);
    const name = `${p.first_name} ${p.last_name}`;

    // 1–2 overdue documentation entries for ~40% of patients
    if (r() < 0.5) {
      const daysOverdue = 1 + Math.floor(r() * 7); // 1..7
      visits.push({
        id: `${p.id}-od-${daysOverdue}`,
        patientId: p.id,
        patientName: name,
        visitType: r() < 0.4 ? "SOC" : "Subsequent",
        date: toISODate(addDays(t, -daysOverdue)),
        time: "10:00",
        status: "documentation_overdue",
        priority: daysOverdue >= 6 ? "high" : daysOverdue >= 3 ? "normal" : "low",
        clinician: CLINICIANS[seed % CLINICIANS.length],
        discipline: disciplineOf(CLINICIANS[seed % CLINICIANS.length]),
        address: STREETS[(seed >> 3) % STREETS.length],
        assignedDate: toISODate(addDays(t, -daysOverdue - 1)),
        daysOverdue,
      });
    }

    // Visits needing scheduling (no time set), within next 10 days
    if (r() < 0.55) {
      const targetIn = 1 + Math.floor(r() * 10);
      const nsVt: VisitType = r() < 0.3 ? "Reassessment" : "Subsequent";
      visits.push({
        id: `${p.id}-ns`,
        patientId: p.id,
        patientName: name,
        visitType: nsVt,
        date: toISODate(addDays(t, targetIn)),
        time: null,
        status: "needs_scheduling",
        priority: targetIn <= 2 ? "high" : targetIn <= 5 ? "normal" : "low",
        clinician: CLINICIANS[(seed + 1) % CLINICIANS.length],
        discipline: disciplineOf(CLINICIANS[(seed + 1) % CLINICIANS.length]),
        address: STREETS[(seed >> 2) % STREETS.length],
        assignedDate: toISODate(addDays(t, -Math.floor(r() * 4))),
        oasisDueDate: nsVt === "Reassessment" ? toISODate(addDays(t, targetIn + 5)) : undefined,
      });
    }

    // Today's visits — ensure a few patients have one today
    if (pi < 4 || r() < 0.25) {
      const hr = 8 + (pi % 8); // spread across day
      const todayVt = VISIT_TYPES[seed % VISIT_TYPES.length];
      visits.push({
        id: `${p.id}-today`,
        patientId: p.id,
        patientName: name,
        visitType: todayVt,
        date: toISODate(t),
        time: `${hr.toString().padStart(2, "0")}:${pi % 2 === 0 ? "00" : "30"}`,
        status: "scheduled",
        priority: "normal",
        clinician: CLINICIANS[(seed + 2) % CLINICIANS.length],
        discipline: disciplineOf(CLINICIANS[(seed + 2) % CLINICIANS.length]),
        address: STREETS[(seed + pi) % STREETS.length],
        assignedDate: toISODate(addDays(t, -3 - Math.floor(r() * 5))),
        oasisDueDate:
          todayVt === "SOC" ||
          todayVt === "ROC" ||
          todayVt === "Recert" ||
          todayVt === "Reassessment"
            ? toISODate(addDays(t, 5))
            : undefined,
      });
    }

    // 14-day upcoming schedule — 1-3 visits each
    const count = 1 + Math.floor(r() * 3);
    for (let i = 0; i < count; i++) {
      const dayOffset = 1 + Math.floor(r() * 14);
      const hr = 8 + Math.floor(r() * 9);
      const vt = VISIT_TYPES[Math.floor(r() * VISIT_TYPES.length)];
      const assignedOffset = Math.floor(r() * 10) - 6; // recent assignments
      visits.push({
        id: `${p.id}-up-${i}`,
        patientId: p.id,
        patientName: name,
        visitType: vt,
        date: toISODate(addDays(t, dayOffset)),
        time: `${hr.toString().padStart(2, "0")}:${i % 2 === 0 ? "15" : "45"}`,
        status: "scheduled",
        priority: "normal",
        clinician: CLINICIANS[(seed + i + 3) % CLINICIANS.length],
        discipline: disciplineOf(CLINICIANS[(seed + i + 3) % CLINICIANS.length]),
        address: STREETS[(seed + i) % STREETS.length],
        assignedDate: toISODate(addDays(t, assignedOffset)),
        oasisDueDate:
          vt === "SOC" || vt === "ROC" || vt === "Recert" || vt === "Reassessment"
            ? toISODate(addDays(t, dayOffset + 5))
            : undefined,
      });
    }
  });

  return visits;
}

export interface CriticalEvent {
  id: string;
  patientId: string;
  patientName: string;
  kind: "recert_due" | "reassessment_due" | "planned_discharge" | "missed_makeup" | "oasis_due";
  date: string;
  detail: string;
}

export function buildCriticalEvents(patients: Patient[], visits: Visit[]): CriticalEvent[] {
  const t = today();
  const horizon = addDays(t, 14);
  const events: CriticalEvent[] = [];

  // OASIS / Recert / Reassessment from upcoming visits
  for (const v of visits) {
    const d = new Date(v.date);
    if (d < t || d > horizon) continue;
    if (v.visitType === "Recert") {
      events.push({
        id: `${v.id}-recert`,
        patientId: v.patientId,
        patientName: v.patientName,
        kind: "recert_due",
        date: v.date,
        detail: "Recertification visit due",
      });
    }
    if (v.visitType === "Reassessment") {
      events.push({
        id: `${v.id}-reass`,
        patientId: v.patientId,
        patientName: v.patientName,
        kind: "reassessment_due",
        date: v.date,
        detail: "Reassessment due",
      });
    }
    if (v.oasisDueDate) {
      const od = new Date(v.oasisDueDate);
      if (od >= t && od <= horizon) {
        events.push({
          id: `${v.id}-oasis`,
          patientId: v.patientId,
          patientName: v.patientName,
          kind: "oasis_due",
          date: v.oasisDueDate,
          detail: `OASIS for ${v.visitType}`,
        });
      }
    }
  }

  // Planned discharges + missed-visit makeup from patient seed
  patients.forEach((p) => {
    const seed = hash(p.id);
    const r = rng(seed ^ 0x9e3779b9);
    if (r() < 0.25) {
      const offset = 2 + Math.floor(r() * 12);
      events.push({
        id: `${p.id}-disch`,
        patientId: p.id,
        patientName: `${p.first_name} ${p.last_name}`,
        kind: "planned_discharge",
        date: toISODate(addDays(t, offset)),
        detail: "Planned discharge",
      });
    }
    if (r() < 0.2) {
      const offset = 1 + Math.floor(r() * 7);
      events.push({
        id: `${p.id}-makeup`,
        patientId: p.id,
        patientName: `${p.first_name} ${p.last_name}`,
        kind: "missed_makeup",
        date: toISODate(addDays(t, offset)),
        detail: "Missed visit makeup deadline",
      });
    }
  });

  events.sort((a, b) => a.date.localeCompare(b.date));
  return events;
}

export function isRecentlyAdded(v: Visit): boolean {
  const t = today();
  const assigned = new Date(v.assignedDate);
  const diff = Math.floor((t.getTime() - assigned.getTime()) / 86400000);
  return diff >= 0 && diff <= 7;
}
