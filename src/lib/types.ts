export type PatientStatus = "pending_review" | "active" | "discharged" | "on_hold";
export type ReconciliationStatus = "not_started" | "in_progress" | "completed";
export type MedicationSource =
  | "referral"
  | "hospital"
  | "patient_reported"
  | "provider"
  | "reconciled";

export type VisitType =
  | "SOC"
  | "Evaluation"
  | "Subsequent"
  | "Reassessment"
  | "Recert"
  | "ROC"
  | "AgencyDischarge"
  | "DisciplineDischarge";

export interface Visit {
  id: string;
  patient_id: string;
  visit_type: VisitType;
  visit_date: string;
  status: string;
  narrative: string | null;
  generated_documentation: Array<{ label: string; content: string }> | null;
  reassess_satisfies: string | null;
  anticipate_discharge: string | null;
  synced_from_hchb: boolean;
  created_at: string;
  updated_at: string;
}

export interface Patient {
  id: string;
  first_name: string;
  last_name: string;
  dob: string | null;
  mrn: string | null;
  referral_date: string | null;
  status: PatientStatus;
  hospitalization_reason: string | null;
  home_health_reason: string | null;
  admit_date: string | null;
  discharge_date: string | null;
  surgery_date: string | null;
  precautions: string[] | null;
  allergies: string[] | null;
  past_medical_history: string[] | null;
  primary_diagnosis: string | null;
  physician_name: string | null;
  physician_phone: string | null;
  patient_order: string | null;
  address: string | null;
  phone: string | null;
  gender: string | null;
  code_status: string | null;
  episode_start_date: string | null;
  episode_end_date: string | null;
  patient_goals: string | null;
  created_at: string;
  updated_at: string;
}

export interface Medication {
  id: string;
  patient_id: string;
  medication_name: string;
  dosage: string | null;
  frequency: string | null;
  route: string | null;
  source: MedicationSource;
  high_risk: boolean;
  active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReferralDocument {
  id: string;
  patient_id: string;
  filename: string;
  upload_date: string;
  extracted_text: string | null;
  summary_json: Record<string, unknown> | null;
  created_at: string;
}

export interface ReconciliationSession {
  id: string;
  patient_id: string;
  status: ReconciliationStatus;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}
