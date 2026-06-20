// Mock medication reconciliation data store (localStorage-backed).
// No real OCR / interactions checking — pure mock for clinician workflow demo.

export type MedRoute = "PO" | "SC" | "IM" | "IV" | "Topical" | "Inhaled" | "PR" | "SL" | "Other";

export interface MedEntry {
  id: string;
  name: string;
  dose: string;
  frequency: string;
  route: MedRoute | string;
  start_date?: string;
  end_date?: string;
  prn?: boolean;
  prn_reason?: string;
  is_new?: boolean;
  is_changed?: boolean;
  reason?: string;
  classification?: string;
  source: "referral" | "patient" | "bottle_photo" | "list_photo" | "camera" | "manual";
  notes?: string;
}

export type DiscrepancyType =
  | "taking_not_on_referral"
  | "not_taking_on_referral"
  | "taking_differently";

export interface Discrepancy {
  id: string;
  type: DiscrepancyType;
  medication: string;
  referral?: string;
  patient?: string;
  notes: string;
}

export interface Interaction {
  id: string;
  med_a: string;
  med_b: string;
  severity: "minor" | "moderate" | "major";
  concern: string;
  monitor: string;
  education?: string;
}

export interface InteractionDoc {
  patient_assessed: "yes" | "no" | "";
  symptoms_state: "none" | "present" | "";
  symptoms_reported: string;
  educated: "yes" | "no" | "";
  additional_education: string;
  notify_needed: "yes" | "no" | "";
  physician_summary: string;
  summary_generated_at?: string;
}

export interface HighRiskEducation {
  educated: "yes" | "no" | "";
}

export type HighRiskCategory =
  | "Anticoagulant"
  | "Antiplatelet"
  | "Insulin"
  | "Hypoglycemic"
  | "Opioid"
  | "Antibiotic"
  | "Antipsychotic";

export interface EducationDoc {
  medication_education: string;
  interaction_education: string;
  compliance_concerns: string;
  patient_questions: string;
}

export type NotifyStatus = "needs" | "notified" | "resolved";
export type NotifyPriority = "low" | "medium" | "high";

export interface PhysicianNotification {
  id: string;
  issue: string;
  reason: string;
  priority: NotifyPriority;
  status: NotifyStatus;
  source: "discrepancy" | "interaction" | "high_risk" | "manual";
}

export interface ReconState {
  referral: MedEntry[];
  patient: MedEntry[];
  discrepancies: Discrepancy[];
  interactions: Interaction[];
  interaction_docs: Record<string, InteractionDoc>;
  highrisk_education: Record<string, HighRiskEducation>;
  education: EducationDoc;
  notifications: PhysicianNotification[];
}

const KEY = (id: string) => `recon-v2:${id}`;

const HIGH_RISK_RULES: Array<{ match: RegExp; cat: HighRiskCategory }> = [
  { match: /warfarin|coumadin|apixaban|eliquis|rivaroxaban|xarelto|heparin|enoxaparin|lovenox/i, cat: "Anticoagulant" },
  { match: /aspirin|clopidogrel|plavix|ticagrelor|brilinta/i, cat: "Antiplatelet" },
  { match: /insulin|lantus|humalog|novolog|tresiba/i, cat: "Insulin" },
  { match: /metformin|glipizide|glyburide|glimepiride/i, cat: "Hypoglycemic" },
  { match: /oxycodone|hydrocodone|morphine|fentanyl|tramadol|percocet|norco|dilaudid/i, cat: "Opioid" },
  { match: /amoxicillin|azithromycin|ciprofloxacin|levofloxacin|doxycycline|cephalexin|augmentin/i, cat: "Antibiotic" },
  { match: /haloperidol|risperidone|olanzapine|quetiapine|seroquel|abilify|aripiprazole/i, cat: "Antipsychotic" },
];

export function highRiskCategory(name: string): HighRiskCategory | null {
  for (const r of HIGH_RISK_RULES) if (r.match.test(name)) return r.cat;
  return null;
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

const DEFAULT_REFERRAL: MedEntry[] = [
  { id: uid(), name: "Lasix", dose: "20 mg", frequency: "daily", route: "PO", reason: "Edema/CHF", classification: "Loop diuretic", source: "referral" },
  { id: uid(), name: "Metformin", dose: "500 mg", frequency: "BID", route: "PO", reason: "Type 2 diabetes", classification: "Biguanide", source: "referral" },
  { id: uid(), name: "Lisinopril", dose: "10 mg", frequency: "daily", route: "PO", reason: "Hypertension", classification: "ACE inhibitor", source: "referral" },
  { id: uid(), name: "Eliquis", dose: "5 mg", frequency: "BID", route: "PO", reason: "Atrial fibrillation", classification: "Anticoagulant", source: "referral" },
  { id: uid(), name: "Aspirin", dose: "81 mg", frequency: "daily", route: "PO", reason: "Cardioprotection", classification: "Antiplatelet", source: "referral" },
];

const DEFAULT_EDU: EducationDoc = {
  medication_education: "",
  interaction_education: "",
  compliance_concerns: "",
  patient_questions: "",
};

export function emptyHighRiskEducation(): HighRiskEducation {
  return { educated: "" };
}

export function emptyInteractionDoc(_i?: Interaction): InteractionDoc {
  return {
    patient_assessed: "",
    symptoms_state: "",
    symptoms_reported: "",
    educated: "",
    additional_education: "",
    notify_needed: "",
    physician_summary: "",
  };
}

export function loadRecon(patientId: string): ReconState {
  if (typeof window === "undefined") return blank();
  try {
    const raw = localStorage.getItem(KEY(patientId));
    if (raw) {
      const s = JSON.parse(raw) as ReconState;
      s.interaction_docs ??= {};
      s.highrisk_education ??= {};
      return s;
    }
  } catch {
    /* ignore */
  }
  const fresh: ReconState = {
    referral: DEFAULT_REFERRAL,
    patient: [],
    discrepancies: [],
    interactions: [],
    interaction_docs: {},
    highrisk_education: {},
    education: { ...DEFAULT_EDU },
    notifications: [],
  };
  saveRecon(patientId, fresh);
  return fresh;
}

export function saveRecon(patientId: string, state: ReconState) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY(patientId), JSON.stringify(state));
}

function blank(): ReconState {
  return {
    referral: [],
    patient: [],
    discrepancies: [],
    interactions: [],
    interaction_docs: {},
    highrisk_education: {},
    education: { ...DEFAULT_EDU },
    notifications: [],
  };
}

export function newMed(partial: Partial<MedEntry> = {}): MedEntry {
  return {
    id: uid(),
    name: "",
    dose: "",
    frequency: "",
    route: "PO",
    source: "manual",
    ...partial,
  };
}

// Mock AI extraction — returns fabricated medications based on upload type.
export function mockExtract(kind: "camera" | "list_photo" | "bottle_photo"): MedEntry[] {
  const pools: Record<typeof kind, MedEntry[]> = {
    list_photo: [
      { id: uid(), name: "Lasix", dose: "40 mg", frequency: "daily", route: "PO", source: "list_photo" },
      { id: uid(), name: "Lisinopril", dose: "10 mg", frequency: "daily", route: "PO", source: "list_photo" },
      { id: uid(), name: "Lisinopril", dose: "20 mg", frequency: "daily", route: "PO", source: "list_photo" },
      { id: uid(), name: "Eliquis", dose: "5 mg", frequency: "BID", route: "PO", source: "list_photo" },
      { id: uid(), name: "Tylenol", dose: "500 mg", frequency: "Q6H PRN", route: "PO", prn: true, prn_reason: "pain", source: "list_photo" },
    ],
    bottle_photo: [
      { id: uid(), name: "Lasix", dose: "40 mg", frequency: "daily", route: "PO", source: "bottle_photo" },
    ],
    camera: [
      { id: uid(), name: "Lasix", dose: "40 mg", frequency: "daily", route: "PO", source: "camera" },
      { id: uid(), name: "Lisinopril", dose: "20 mg", frequency: "daily", route: "PO", source: "camera" },
      { id: uid(), name: "Eliquis", dose: "5 mg", frequency: "BID", route: "PO", source: "camera" },
      { id: uid(), name: "Tylenol", dose: "500 mg", frequency: "Q6H PRN", route: "PO", prn: true, prn_reason: "pain", source: "camera" },
    ],
  };
  return pools[kind];
}

// Compute discrepancies by matching on case-insensitive med name.
export function computeDiscrepancies(
  referral: MedEntry[],
  patient: MedEntry[],
): Discrepancy[] {
  const out: Discrepancy[] = [];
  const norm = (s: string) => s.trim().toLowerCase();
  const refByName = new Map(referral.map((m) => [norm(m.name), m]));
  const patByName = new Map<string, MedEntry>();
  for (const m of patient) patByName.set(norm(m.name), m);

  for (const p of patient) {
    const r = refByName.get(norm(p.name));
    if (!r) {
      out.push({
        id: `disc-tnr-${p.id}`,
        type: "taking_not_on_referral",
        medication: p.name,
        patient: fmt(p),
        notes: "",
      });
    } else if (fmt(r) !== fmt(p)) {
      out.push({
        id: `disc-diff-${p.id}`,
        type: "taking_differently",
        medication: p.name,
        referral: fmt(r),
        patient: fmt(p),
        notes: "",
      });
    }
  }
  for (const r of referral) {
    if (!patByName.has(norm(r.name))) {
      out.push({
        id: `disc-ntr-${r.id}`,
        type: "not_taking_on_referral",
        medication: r.name,
        referral: fmt(r),
        notes: "",
      });
    }
  }
  return out;
}

export function fmt(m: MedEntry): string {
  return [m.name, m.dose, m.frequency, m.route, m.prn ? `PRN${m.prn_reason ? ` (${m.prn_reason})` : ""}` : ""]
    .filter(Boolean)
    .join(" ");
}

// Mock interactions seeded against well-known pairs.
export function computeInteractions(all: MedEntry[]): Interaction[] {
  const has = (re: RegExp) => all.some((m) => re.test(m.name));
  const out: Interaction[] = [];
  if (has(/eliquis|warfarin|apixaban|xarelto/i) && has(/aspirin/i)) {
    out.push({
      id: "int-anticoag-asa",
      med_a: "Eliquis (apixaban)",
      med_b: "Aspirin",
      severity: "major",
      concern: "Increased bleeding risk when combining anticoagulant with antiplatelet.",
      monitor: "Bruising, GI bleeding, hematuria, prolonged bleeding from cuts, nosebleeds, blood in stool/urine.",
      education: "Teach patient to report any unusual bleeding, use a soft toothbrush, avoid contact activities, and notify provider before any procedures or new OTC meds (especially NSAIDs).",
    });
  }
  if (has(/lisinopril/i) && has(/lasix|furosemide/i)) {
    out.push({
      id: "int-ace-loop",
      med_a: "Lisinopril",
      med_b: "Lasix (furosemide)",
      severity: "moderate",
      concern: "Additive hypotension and risk of acute kidney injury.",
      monitor: "Orthostatic dizziness, lightheadedness on standing, decreased urine output, weight changes.",
      education: "Rise slowly from sitting/lying, stay hydrated unless fluid restricted, weigh daily and report >2 lb/day gain, report dizziness or decreased urination.",
    });
  }
  if (has(/metformin/i) && has(/contrast|iodinated/i)) {
    out.push({
      id: "int-metformin-contrast",
      med_a: "Metformin",
      med_b: "Iodinated contrast",
      severity: "moderate",
      concern: "Risk of contrast-induced nephropathy and lactic acidosis.",
      monitor: "Hold metformin 48h post-contrast; recheck renal function.",
      education: "Notify provider before any imaging using IV contrast; do not resume metformin until cleared.",
    });
  }
  return out;
}
