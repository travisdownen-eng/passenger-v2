export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      medications: {
        Row: {
          active: boolean
          created_at: string
          dosage: string | null
          frequency: string | null
          high_risk: boolean
          id: string
          medication_name: string
          notes: string | null
          patient_id: string
          route: string | null
          source: Database["public"]["Enums"]["medication_source"]
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          dosage?: string | null
          frequency?: string | null
          high_risk?: boolean
          id?: string
          medication_name: string
          notes?: string | null
          patient_id: string
          route?: string | null
          source?: Database["public"]["Enums"]["medication_source"]
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          dosage?: string | null
          frequency?: string | null
          high_risk?: boolean
          id?: string
          medication_name?: string
          notes?: string | null
          patient_id?: string
          route?: string | null
          source?: Database["public"]["Enums"]["medication_source"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "medications_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patients: {
        Row: {
          address: string | null
          admit_date: string | null
          allergies: string[] | null
          code_status: string | null
          created_at: string
          discharge_date: string | null
          dob: string | null
          episode_end_date: string | null
          episode_start_date: string | null
          first_name: string
          gender: string | null
          home_health_reason: string | null
          hospitalization_reason: string | null
          id: string
          last_name: string
          mrn: string | null
          past_medical_history: string[] | null
          patient_goals: string | null
          patient_order: string | null
          phone: string | null
          physician_name: string | null
          physician_phone: string | null
          precautions: string[] | null
          primary_diagnosis: string | null
          referral_date: string | null
          status: Database["public"]["Enums"]["patient_status"]
          surgery_date: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          admit_date?: string | null
          allergies?: string[] | null
          code_status?: string | null
          created_at?: string
          discharge_date?: string | null
          dob?: string | null
          episode_end_date?: string | null
          episode_start_date?: string | null
          first_name: string
          gender?: string | null
          home_health_reason?: string | null
          hospitalization_reason?: string | null
          id?: string
          last_name: string
          mrn?: string | null
          past_medical_history?: string[] | null
          patient_goals?: string | null
          patient_order?: string | null
          phone?: string | null
          physician_name?: string | null
          physician_phone?: string | null
          precautions?: string[] | null
          primary_diagnosis?: string | null
          referral_date?: string | null
          status?: Database["public"]["Enums"]["patient_status"]
          surgery_date?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          admit_date?: string | null
          allergies?: string[] | null
          code_status?: string | null
          created_at?: string
          discharge_date?: string | null
          dob?: string | null
          episode_end_date?: string | null
          episode_start_date?: string | null
          first_name?: string
          gender?: string | null
          home_health_reason?: string | null
          hospitalization_reason?: string | null
          id?: string
          last_name?: string
          mrn?: string | null
          past_medical_history?: string[] | null
          patient_goals?: string | null
          patient_order?: string | null
          phone?: string | null
          physician_name?: string | null
          physician_phone?: string | null
          precautions?: string[] | null
          primary_diagnosis?: string | null
          referral_date?: string | null
          status?: Database["public"]["Enums"]["patient_status"]
          surgery_date?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      reconciliation_sessions: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          patient_id: string
          status: Database["public"]["Enums"]["reconciliation_status"]
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          patient_id: string
          status?: Database["public"]["Enums"]["reconciliation_status"]
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          patient_id?: string
          status?: Database["public"]["Enums"]["reconciliation_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reconciliation_sessions_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_documents: {
        Row: {
          created_at: string
          extracted_text: string | null
          filename: string
          id: string
          patient_id: string
          summary_json: Json | null
          upload_date: string
        }
        Insert: {
          created_at?: string
          extracted_text?: string | null
          filename: string
          id?: string
          patient_id: string
          summary_json?: Json | null
          upload_date?: string
        }
        Update: {
          created_at?: string
          extracted_text?: string | null
          filename?: string
          id?: string
          patient_id?: string
          summary_json?: Json | null
          upload_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_documents_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_statuses: {
        Row: {
          created_at: string
          id: string
          patient_id: string
          ready_to_sync_at: string | null
          reviewed_at: string | null
          source_id: string | null
          source_table: string | null
          state: Database["public"]["Enums"]["workflow_state"]
          synced_at: string | null
          updated_at: string
          workflow_type: Database["public"]["Enums"]["workflow_type"]
        }
        Insert: {
          created_at?: string
          id?: string
          patient_id: string
          ready_to_sync_at?: string | null
          reviewed_at?: string | null
          source_id?: string | null
          source_table?: string | null
          state?: Database["public"]["Enums"]["workflow_state"]
          synced_at?: string | null
          updated_at?: string
          workflow_type: Database["public"]["Enums"]["workflow_type"]
        }
        Update: {
          created_at?: string
          id?: string
          patient_id?: string
          ready_to_sync_at?: string | null
          reviewed_at?: string | null
          source_id?: string | null
          source_table?: string | null
          state?: Database["public"]["Enums"]["workflow_state"]
          synced_at?: string | null
          updated_at?: string
          workflow_type?: Database["public"]["Enums"]["workflow_type"]
        }
        Relationships: [
          {
            foreignKeyName: "workflow_statuses_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      visits: {
        Row: {
          anticipate_discharge: string | null
          created_at: string
          generated_documentation: Json | null
          id: string
          narrative: string | null
          patient_id: string
          reassess_satisfies: string | null
          status: string
          synced_from_hchb: boolean
          updated_at: string
          visit_date: string
          visit_type: string
        }
        Insert: {
          anticipate_discharge?: string | null
          created_at?: string
          generated_documentation?: Json | null
          id?: string
          narrative?: string | null
          patient_id: string
          reassess_satisfies?: string | null
          status?: string
          synced_from_hchb?: boolean
          updated_at?: string
          visit_date?: string
          visit_type?: string
        }
        Update: {
          anticipate_discharge?: string | null
          created_at?: string
          generated_documentation?: Json | null
          id?: string
          narrative?: string | null
          patient_id?: string
          reassess_satisfies?: string | null
          status?: string
          synced_from_hchb?: boolean
          updated_at?: string
          visit_date?: string
          visit_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "visits_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      medication_source:
        | "referral"
        | "hospital"
        | "patient_reported"
        | "provider"
        | "reconciled"
      patient_status: "pending_review" | "active" | "discharged" | "on_hold"
      reconciliation_status: "not_started" | "in_progress" | "completed"
      workflow_state: "not_started" | "needs_review" | "ready_to_sync" | "synced"
      workflow_type: "referral" | "medication" | "narrative" | "call"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      medication_source: [
        "referral",
        "hospital",
        "patient_reported",
        "provider",
        "reconciled",
      ],
      patient_status: ["pending_review", "active", "discharged", "on_hold"],
      reconciliation_status: ["not_started", "in_progress", "completed"],
      workflow_state: ["not_started", "needs_review", "ready_to_sync", "synced"],
      workflow_type: ["referral", "medication", "narrative", "call"],
    },
  },
} as const
