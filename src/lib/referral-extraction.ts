import type { Patient } from "./types";

export type ExtractionStatus = "ready" | "needs_review" | "reviewed";
export type Confidence = "high" | "medium" | "low";
export type SectionKey =
  | "client_demographics"
  | "financial"
  | "start_of_care"
  | "inpatient_stay"
  | "health_history"
  | "cardiovascular"
  | "respiratory"
  | "urinary"
  | "gastrointestinal"
  | "skin_wounds"
  | "allergies";

export interface ExtractionBox {
  key: string;
  section: SectionKey;
  title: string;
  text: string;
  confidence: Confidence;
  status: ExtractionStatus;
  /** Optional fixed list of allowed values (renders as a select when editing). */
  options?: string[];
  /** Highlight this card as a clinically important category. */
  highlight?: boolean;
}

export const SECTIONS: Array<{ key: SectionKey; title: string }> = [
  { key: "client_demographics", title: "Client Demographics" },
  { key: "financial", title: "Financial" },
  { key: "start_of_care", title: "Start of Care / Referral" },
  { key: "inpatient_stay", title: "Recent Inpatient Stay" },
  { key: "health_history", title: "Health History" },
  { key: "cardiovascular", title: "Cardiovascular" },
  { key: "respiratory", title: "Respiratory" },
  { key: "urinary", title: "Urinary" },
  { key: "gastrointestinal", title: "Gastrointestinal" },
  { key: "skin_wounds", title: "Skin / Wounds" },
  { key: "allergies", title: "Allergies" },
];

export const FACILITY_TYPES = [
  "Long-Term Nursing Facility",
  "Skilled Nursing Facility",
  "Short-Stay Acute Hospital",
  "Long-Term Care Hospital",
  "Inpatient Rehabilitation Facility",
  "Psychiatric Hospital or Unit",
  "Other",
];

const STORAGE_PREFIX = "passenger.referral.";

function key(patientId: string) {
  return `${STORAGE_PREFIX}${patientId}`;
}

function daysBetween(a: string, b: string) {
  const ms = new Date(b).getTime() - new Date(a).getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

export function defaultBoxes(patient: Patient): ExtractionBox[] {
  const today = new Date().toISOString().slice(0, 10);
  const recentInpatient =
    patient.discharge_date && Math.abs(daysBetween(patient.discharge_date, today)) <= 14;

  const socFallback = patient.referral_date
    ? `N/A – Use Referral Date (${patient.referral_date})`
    : "N/A – Use Referral Date";

  const pmh = patient.past_medical_history ?? [];
  const allergies = patient.allergies ?? [];
  const pmhText = pmh.join(", ");
  const findMatches = (patterns: RegExp[]) =>
    pmh.filter((d) => patterns.some((p) => p.test(d))).join(", ");
  const findExcluding = (include: RegExp[], exclude: RegExp[]) =>
    pmh
      .filter((d) => include.some((p) => p.test(d)) && !exclude.some((p) => p.test(d)))
      .join(", ");

  // Highlighted matchers
  const mDiabetes = findMatches([/diabet/i]);
  const mPVD = findMatches([/\bPVD\b/i, /peripheral vascular/i]);
  const mPAD = findMatches([/\bPAD\b/i, /peripheral artery/i]);

  const mCHF = findMatches([/\bCHF\b/i, /heart failure/i]);
  const mPacemaker = findMatches([/pacemaker/i]);
  const mCAD = findMatches([/\bCAD\b/i, /coronary/i]);
  const mAFib = findMatches([/atrial fib/i, /\bAFib\b/i]);
  const mHTN = findMatches([/hypertens/i, /\bHTN\b/i]);
  const cardioInclude = [
    /\bCHF\b/i, /heart failure/i, /pacemaker/i, /\bCAD\b/i, /coronary/i,
    /atrial fib/i, /\bAFib\b/i, /hypertens/i, /\bHTN\b/i,
  ];
  const cardioAll = [/cardio/i, /\bMI\b/i, /myocard/i, /valve/i, /stent/i, /arrhythm/i, ...cardioInclude];
  const mCardioOther = findExcluding(cardioAll, cardioInclude);

  const mCOPD = findMatches([/\bCOPD\b/i]);
  const mAsthma = findMatches([/asthma/i]);
  const mRespFailure = findMatches([/respiratory failure/i]);
  const mO2 = findMatches([/oxygen|\bO2\b/i]);
  const respInclude = [/\bCOPD\b/i, /asthma/i, /respiratory failure/i, /oxygen|\bO2\b/i];
  const respAll = [/respirat/i, /pulmon/i, /\bOSA\b/i, /sleep apnea/i, /pneumon/i, ...respInclude];
  const mRespOther = findExcluding(respAll, respInclude);

  const mCatheter = findMatches([/catheter/i]);
  const mIncontinence = findMatches([/incontinen/i]);
  const mUTI = findMatches([/\bUTI\b/i]);
  const urinaryInclude = [/catheter/i, /incontinen/i, /\bUTI\b/i];
  const urinaryAll = [/urinar/i, /bladder/i, /kidney/i, /renal/i, /\bCKD\b/i, /prostate/i, ...urinaryInclude];
  const mUrinaryOther = findExcluding(urinaryAll, urinaryInclude);

  const mGI = findMatches([
    /\bGERD\b/i, /\bIBS\b/i, /crohn/i, /coliti/i, /hepat/i, /cirrhos/i,
    /ulcer(?!.*(?:foot|leg|pressure|venous|arterial|diabetic|skin))/i, /\bGI\b/i,
    /gastr/i, /diverticul/i, /constipat/i, /diarrhea/i,
  ]);

  const mPressure = findMatches([/pressure (injur|ulcer|sore)/i, /decubitus/i]);
  const mSurgWound = findMatches([/surgical wound/i, /post[- ]?op wound/i, /incision/i]);
  const mVenous = findMatches([/venous ulcer/i, /stasis ulcer/i]);
  const mArterial = findMatches([/arterial ulcer/i, /ischemic ulcer/i]);
  const mDiabUlcer = findMatches([/diabetic ulcer/i, /diabetic foot/i]);
  const mSkinTear = findMatches([/skin tear/i]);
  const skinInclude = [
    /pressure (injur|ulcer|sore)/i, /decubitus/i, /surgical wound/i, /post[- ]?op wound/i,
    /incision/i, /venous ulcer/i, /stasis ulcer/i, /arterial ulcer/i, /ischemic ulcer/i,
    /diabetic ulcer/i, /diabetic foot/i, /skin tear/i,
  ];
  const skinAll = [/wound/i, /ulcer/i, /dermat/i, /cellulit/i, ...skinInclude];
  const mSkinOther = findExcluding(skinAll, skinInclude);

  const allergiesText = allergies.join(", ");

  const seed: Array<Omit<ExtractionBox, "status">> = [
    // Client Demographics
    {
      key: "marital_status",
      section: "client_demographics",
      title: "Marital Status",
      text: "",
      confidence: "low",
      options: ["Single", "Married", "Divorced", "Widowed", "Separated", "Unknown"],
    },
    { key: "religion", section: "client_demographics", title: "Religion", text: "", confidence: "low" },
    { key: "race", section: "client_demographics", title: "Race", text: "", confidence: "low" },
    {
      key: "preferred_language",
      section: "client_demographics",
      title: "Preferred Language",
      text: "",
      confidence: "low",
    },

    // Financial
    { key: "payor_source", section: "financial", title: "Payor Source", text: "", confidence: "low" },

    // Start of Care / Referral
    {
      key: "physician_soc_date",
      section: "start_of_care",
      title: "Physician Ordered SOC Date",
      text: socFallback,
      confidence: "medium",
    },
    {
      key: "referral_date",
      section: "start_of_care",
      title: "Referral Date",
      text: patient.referral_date || "",
      confidence: patient.referral_date ? "high" : "low",
    },

    // Recent Inpatient Stay
    {
      key: "recent_inpatient",
      section: "inpatient_stay",
      title: "Discharged ≤ 14 days",
      text: recentInpatient ? "Yes" : patient.discharge_date ? "No" : "",
      confidence: patient.discharge_date ? "high" : "low",
      options: ["Yes", "No"],
    },
    {
      key: "facility_type",
      section: "inpatient_stay",
      title: "Facility Type",
      text: "",
      confidence: "low",
      options: FACILITY_TYPES,
    },
    {
      key: "facility_discharge_date",
      section: "inpatient_stay",
      title: "Discharge Date",
      text: patient.discharge_date || "",
      confidence: patient.discharge_date ? "high" : "low",
    },

    // Health History
    { key: "pmh_all", section: "health_history", title: "Past Medical History", text: pmhText, confidence: pmhText ? "high" : "low" },
    { key: "hx_diabetes", section: "health_history", title: "Diabetes", text: mDiabetes, confidence: mDiabetes ? "high" : "low", highlight: true },
    { key: "hx_pvd", section: "health_history", title: "Peripheral Vascular Disease (PVD)", text: mPVD, confidence: mPVD ? "high" : "low", highlight: true },
    { key: "hx_pad", section: "health_history", title: "Peripheral Artery Disease (PAD)", text: mPAD, confidence: mPAD ? "high" : "low", highlight: true },
    { key: "vaccines", section: "health_history", title: "Vaccine Information", text: "", confidence: "low" },

    // Cardiovascular
    { key: "cv_chf", section: "cardiovascular", title: "CHF", text: mCHF, confidence: mCHF ? "high" : "low", highlight: true },
    { key: "cv_pacemaker", section: "cardiovascular", title: "Pacemaker", text: mPacemaker, confidence: mPacemaker ? "high" : "low", highlight: true },
    { key: "cv_cad", section: "cardiovascular", title: "CAD", text: mCAD, confidence: mCAD ? "high" : "low", highlight: true },
    { key: "cv_afib", section: "cardiovascular", title: "Atrial Fibrillation", text: mAFib, confidence: mAFib ? "high" : "low", highlight: true },
    { key: "cv_htn", section: "cardiovascular", title: "Hypertension", text: mHTN, confidence: mHTN ? "high" : "low", highlight: true },
    { key: "cv_other", section: "cardiovascular", title: "Other Cardiovascular", text: mCardioOther, confidence: mCardioOther ? "high" : "low" },

    // Respiratory
    { key: "resp_copd", section: "respiratory", title: "COPD", text: mCOPD, confidence: mCOPD ? "high" : "low", highlight: true },
    { key: "resp_asthma", section: "respiratory", title: "Asthma", text: mAsthma, confidence: mAsthma ? "high" : "low", highlight: true },
    { key: "resp_failure", section: "respiratory", title: "Respiratory Failure", text: mRespFailure, confidence: mRespFailure ? "high" : "low", highlight: true },
    { key: "resp_o2", section: "respiratory", title: "Oxygen Use", text: mO2, confidence: mO2 ? "high" : "low", highlight: true },
    { key: "resp_other", section: "respiratory", title: "Other Respiratory", text: mRespOther, confidence: mRespOther ? "high" : "low" },

    // Urinary
    { key: "ur_catheter", section: "urinary", title: "Catheter", text: mCatheter, confidence: mCatheter ? "high" : "low", highlight: true },
    { key: "ur_incontinence", section: "urinary", title: "Urinary Incontinence", text: mIncontinence, confidence: mIncontinence ? "high" : "low", highlight: true },
    { key: "ur_uti", section: "urinary", title: "Recurrent UTI", text: mUTI, confidence: mUTI ? "high" : "low", highlight: true },
    { key: "ur_other", section: "urinary", title: "Other Urinary", text: mUrinaryOther, confidence: mUrinaryOther ? "high" : "low" },

    // GI
    { key: "gi_all", section: "gastrointestinal", title: "GI Diagnoses", text: mGI, confidence: mGI ? "high" : "low" },

    // Skin / Wounds
    { key: "skin_pressure", section: "skin_wounds", title: "Pressure Injuries", text: mPressure, confidence: mPressure ? "high" : "low", highlight: true },
    { key: "skin_surgical", section: "skin_wounds", title: "Surgical Wounds", text: mSurgWound, confidence: mSurgWound ? "high" : "low", highlight: true },
    { key: "skin_venous", section: "skin_wounds", title: "Venous Ulcers", text: mVenous, confidence: mVenous ? "high" : "low", highlight: true },
    { key: "skin_arterial", section: "skin_wounds", title: "Arterial Ulcers", text: mArterial, confidence: mArterial ? "high" : "low", highlight: true },
    { key: "skin_diabetic", section: "skin_wounds", title: "Diabetic Ulcers", text: mDiabUlcer, confidence: mDiabUlcer ? "high" : "low", highlight: true },
    { key: "skin_tears", section: "skin_wounds", title: "Skin Tears", text: mSkinTear, confidence: mSkinTear ? "high" : "low", highlight: true },
    { key: "skin_other", section: "skin_wounds", title: "Other Wounds", text: mSkinOther, confidence: mSkinOther ? "high" : "low" },

    // Allergies (combined)
    {
      key: "allergies_all",
      section: "allergies",
      title: "All Allergies",
      text: allergiesText,
      confidence: allergiesText ? "high" : "low",
    },
  ];

  return seed.map((b) => ({
    ...b,
    status: b.text.trim() && b.confidence !== "low" ? "ready" : "needs_review",
  }));
}

export function loadBoxes(patient: Patient): ExtractionBox[] {
  if (typeof window === "undefined") return defaultBoxes(patient);
  try {
    const raw = window.localStorage.getItem(key(patient.id));
    const defs = defaultBoxes(patient);
    if (!raw) return defs;
    const parsed = JSON.parse(raw) as ExtractionBox[];
    return defs.map((d) => {
      const prior = parsed.find((p) => p.key === d.key);
      if (!prior) return d;
      const status: ExtractionStatus =
        (prior.status as ExtractionStatus | "synced") === "synced"
          ? "reviewed"
          : (prior.status as ExtractionStatus);
      return { ...d, text: prior.text, status };
    });
  } catch {
    return defaultBoxes(patient);
  }
}

export function saveBoxes(patientId: string, boxes: ExtractionBox[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key(patientId), JSON.stringify(boxes));
}

export const MOCK_REFERRAL_PATIENTS = [
  {
    mrn: "MOCK-REF-1001",
    first_name: "Margaret",
    last_name: "Whitaker",
    dob: "1948-03-22",
    gender: "Female",
    code_status: "DNR",
    address: "482 Oak Ridge Dr\nLittleton, CO 80127",
    phone: "(303) 555-0142",
    primary_diagnosis: "CHF Exacerbation, Stage III",
    hospitalization_reason: "Admitted for acute decompensated heart failure with volume overload.",
    home_health_reason:
      "Skilled nursing for cardiac assessment, medication management, and patient education post-discharge.",
    past_medical_history: ["CHF", "Atrial Fibrillation", "Type 2 Diabetes", "CKD Stage 3"],
    precautions: ["Fall risk", "Fluid restriction 1.5L/day", "Daily weights"],
    allergies: ["Sulfa", "Penicillin"],
    admit_date: "2026-06-08",
    discharge_date: "2026-06-14",
    physician_name: "Dr. Ramesh Patel",
    physician_phone: "(303) 555-9821",
    episode_start_date: "2026-06-15",
    episode_end_date: "2026-08-13",
  },
  {
    mrn: "MOCK-REF-1002",
    first_name: "Theodore",
    last_name: "Brennan",
    dob: "1952-11-04",
    gender: "Male",
    code_status: "Full Code",
    address: "1217 Aspen Way\nLakewood, CO 80228",
    phone: "(303) 555-0188",
    primary_diagnosis: "Status Post Right Total Knee Arthroplasty",
    hospitalization_reason: "Elective right TKA with uncomplicated post-op course.",
    home_health_reason: "Skilled PT for gait training, weight-bearing progression, and home safety.",
    past_medical_history: ["Osteoarthritis", "Hypertension", "Hyperlipidemia"],
    precautions: ["Weight bearing as tolerated", "Anticoagulation precautions"],
    allergies: ["NKDA"],
    admit_date: "2026-06-10",
    discharge_date: "2026-06-15",
    surgery_date: "2026-06-10",
    physician_name: "Dr. Lisa Chen",
    physician_phone: "(303) 555-7733",
    episode_start_date: "2026-06-16",
    episode_end_date: "2026-08-14",
  },
  {
    mrn: "MOCK-REF-1003",
    first_name: "Eleanor",
    last_name: "Vasquez",
    dob: "1939-07-18",
    gender: "Female",
    code_status: "DNR/DNI",
    address: "94 Elm Street\nGolden, CO 80401",
    phone: "(303) 555-0166",
    primary_diagnosis: "COPD Exacerbation",
    hospitalization_reason: "Admitted with hypoxic respiratory failure secondary to COPD exacerbation.",
    home_health_reason:
      "Skilled nursing for respiratory assessment, O2 management, and inhaler technique.",
    past_medical_history: ["COPD", "OSA on CPAP", "GERD", "Osteoporosis"],
    precautions: ["O2 2L NC continuous", "Fall risk", "Smoking cessation"],
    allergies: ["Latex", "Codeine"],
    admit_date: "2026-06-09",
    discharge_date: "2026-06-14",
    physician_name: "Dr. Marcus Johnson",
    physician_phone: "(303) 555-4421",
    episode_start_date: "2026-06-15",
    episode_end_date: "2026-08-13",
  },
];
