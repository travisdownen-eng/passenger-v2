import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MOCK_REFERRAL_PATIENTS, defaultBoxes, saveBoxes } from "@/lib/referral-extraction";
import type { Patient } from "@/lib/types";

interface SyncState {
  lastSyncAt: Date;
  newVisits: number;
  pendingUploads: number;
  syncing: boolean;
}

interface SyncContextValue extends SyncState {
  syncNow: () => Promise<void>;
}

const SyncContext = createContext<SyncContextValue | null>(null);

const INITIAL: SyncState = {
  lastSyncAt: new Date("2026-06-11T15:45:00Z"),
  newVisits: 3,
  pendingUploads: 2,
  syncing: false,
};

export function SyncProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SyncState>(INITIAL);
  const [hydrated, setHydrated] = useState(false);
  const [mockIndex, setMockIndex] = useState(0);
  const queryClient = useQueryClient();

  useEffect(() => setHydrated(true), []);

  const syncNow = useCallback(async () => {
    setState((s) => ({ ...s, syncing: true }));

    await new Promise((r) => setTimeout(r, 400));
    toast.info("Pulling new referrals from EHR…");

    // Pick the next mock referral and create a new patient row.
    const mock = MOCK_REFERRAL_PATIENTS[mockIndex % MOCK_REFERRAL_PATIENTS.length];
    setMockIndex((i) => i + 1);

    const { data, error } = await supabase
      .from("patients")
      .insert({
        first_name: mock.first_name,
        last_name: mock.last_name,
        dob: mock.dob,
        gender: mock.gender,
        code_status: mock.code_status,
        address: mock.address,
        phone: mock.phone,
        primary_diagnosis: mock.primary_diagnosis,
        hospitalization_reason: mock.hospitalization_reason,
        home_health_reason: mock.home_health_reason,
        past_medical_history: mock.past_medical_history,
        precautions: mock.precautions,
        allergies: mock.allergies,
        admit_date: mock.admit_date,
        discharge_date: mock.discharge_date,
        surgery_date: (mock as { surgery_date?: string }).surgery_date ?? null,
        physician_name: mock.physician_name,
        physician_phone: mock.physician_phone,
        episode_start_date: mock.episode_start_date,
        episode_end_date: mock.episode_end_date,
        status: "pending_review",
      })
      .select()
      .single();

    if (error) {
      toast.error(`Sync failed: ${error.message}`);
      setState((s) => ({ ...s, syncing: false }));
      return;
    }

    const patient = data as unknown as Patient;
    saveBoxes(patient.id, defaultBoxes(patient));

    await queryClient.invalidateQueries({ queryKey: ["patients"] });

    await new Promise((r) => setTimeout(r, 350));
    toast.success(`New referral received: ${mock.first_name} ${mock.last_name}`);
    await new Promise((r) => setTimeout(r, 250));
    toast.success("Referral intelligence extracted — open snapshot to review");

    setState({
      lastSyncAt: new Date(),
      newVisits: 0,
      pendingUploads: 0,
      syncing: false,
    });
  }, [mockIndex, queryClient]);

  return (
    <SyncContext.Provider value={{ ...state, syncNow }}>
      <span style={{ display: "none" }}>{hydrated ? "h" : "s"}</span>
      {children}
    </SyncContext.Provider>
  );
}

export function useSync(): SyncContextValue {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error("useSync must be used inside SyncProvider");
  return ctx;
}

export function formatSyncTimestamp(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(d.getUTCMonth() + 1)}/${pad(d.getUTCDate())}/${d.getUTCFullYear()} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}
