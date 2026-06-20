import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type {
  Medication,
  Patient,
  ReconciliationSession,
  ReferralDocument,
  Visit,
} from "./types";

export const patientsQuery = () =>
  queryOptions({
    queryKey: ["patients"],
    queryFn: async (): Promise<Patient[]> => {
      const { data, error } = await supabase
        .from("patients")
        .select("*")
        .order("last_name", { ascending: true })
        .order("first_name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as Patient[];
    },
  });

export const patientQuery = (id: string) =>
  queryOptions({
    queryKey: ["patient", id],
    queryFn: async (): Promise<Patient | null> => {
      const { data, error } = await supabase
        .from("patients")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as unknown as Patient | null;
    },
  });

export const patientMedicationsQuery = (id: string) =>
  queryOptions({
    queryKey: ["medications", id],
    queryFn: async (): Promise<Medication[]> => {
      const { data, error } = await supabase
        .from("medications")
        .select("*")
        .eq("patient_id", id)
        .order("medication_name");
      if (error) throw error;
      return (data ?? []) as unknown as Medication[];
    },
  });

export const patientReferralsQuery = (id: string) =>
  queryOptions({
    queryKey: ["referrals", id],
    queryFn: async (): Promise<ReferralDocument[]> => {
      const { data, error } = await supabase
        .from("referral_documents")
        .select("*")
        .eq("patient_id", id)
        .order("upload_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as ReferralDocument[];
    },
  });

export const patientReconciliationQuery = (id: string) =>
  queryOptions({
    queryKey: ["reconciliation", id],
    queryFn: async (): Promise<ReconciliationSession | null> => {
      const { data, error } = await supabase
        .from("reconciliation_sessions")
        .select("*")
        .eq("patient_id", id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as unknown as ReconciliationSession | null;
    },
  });

export const patientVisitsQuery = (id: string) =>
  queryOptions({
    queryKey: ["visits", id],
    queryFn: async (): Promise<Visit[]> => {
      const { data, error } = await supabase
        .from("visits")
        .select("*")
        .eq("patient_id", id)
        .order("visit_date", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Visit[];
    },
  });
