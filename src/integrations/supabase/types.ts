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
      app_secrets: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value: string
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: string
        }
        Relationships: []
      }
      appointments: {
        Row: {
          appointment_date: string
          cancel_reason: string | null
          chief_complaint: string | null
          created_at: string
          id: string
          patient_email: string | null
          patient_id: string | null
          patient_name: string
          patient_phone: string | null
          reschedule_date: string | null
          reschedule_time_slot: string | null
          status: string
          time_slot: string
          updated_at: string
        }
        Insert: {
          appointment_date: string
          cancel_reason?: string | null
          chief_complaint?: string | null
          created_at?: string
          id?: string
          patient_email?: string | null
          patient_id?: string | null
          patient_name: string
          patient_phone?: string | null
          reschedule_date?: string | null
          reschedule_time_slot?: string | null
          status?: string
          time_slot: string
          updated_at?: string
        }
        Update: {
          appointment_date?: string
          cancel_reason?: string | null
          chief_complaint?: string | null
          created_at?: string
          id?: string
          patient_email?: string | null
          patient_id?: string | null
          patient_name?: string
          patient_phone?: string | null
          reschedule_date?: string | null
          reschedule_time_slot?: string | null
          status?: string
          time_slot?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      device_push_tokens: {
        Row: {
          created_at: string
          id: string
          platform: string
          token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          platform: string
          token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          platform?: string
          token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      doctor_settings: {
        Row: {
          chambers: Json | null
          created_at: string
          degrees: string
          degrees_bn: string | null
          email: string
          id: string
          institution: string | null
          institution_bn: string | null
          letterhead_url: string | null
          mobile: string
          name: string
          name_bn: string | null
          online_consultation: Json | null
          signature_data_url: string | null
          specialization: string | null
          specialization_bn: string | null
          title: string | null
          title_bn: string | null
          updated_at: string
          user_id: string
          website: string | null
        }
        Insert: {
          chambers?: Json | null
          created_at?: string
          degrees?: string
          degrees_bn?: string | null
          email?: string
          id?: string
          institution?: string | null
          institution_bn?: string | null
          letterhead_url?: string | null
          mobile?: string
          name?: string
          name_bn?: string | null
          online_consultation?: Json | null
          signature_data_url?: string | null
          specialization?: string | null
          specialization_bn?: string | null
          title?: string | null
          title_bn?: string | null
          updated_at?: string
          user_id: string
          website?: string | null
        }
        Update: {
          chambers?: Json | null
          created_at?: string
          degrees?: string
          degrees_bn?: string | null
          email?: string
          id?: string
          institution?: string | null
          institution_bn?: string | null
          letterhead_url?: string | null
          mobile?: string
          name?: string
          name_bn?: string | null
          online_consultation?: Json | null
          signature_data_url?: string | null
          specialization?: string | null
          specialization_bn?: string | null
          title?: string | null
          title_bn?: string | null
          updated_at?: string
          user_id?: string
          website?: string | null
        }
        Relationships: []
      }
      patient_reports: {
        Row: {
          category: string
          created_at: string
          file_name: string
          file_path: string
          file_type: string | null
          id: string
          patient_id: string
          uploaded_by: string | null
        }
        Insert: {
          category?: string
          created_at?: string
          file_name: string
          file_path: string
          file_type?: string | null
          id?: string
          patient_id: string
          uploaded_by?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          file_name?: string
          file_path?: string
          file_type?: string | null
          id?: string
          patient_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patient_reports_patient_id_fkey"
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
          age: number
          allergies: string[] | null
          avatar_url: string | null
          chief_complaint: string | null
          created_at: string
          date_of_birth: string | null
          drug_history: string | null
          gender: string
          height_cm: number | null
          height_feet: number | null
          height_inches: number | null
          history_of_present_illness: string | null
          id: string
          immunization_history: string | null
          marital_status: string
          medical_conditions: string[] | null
          name: string
          ob_gyn_history: string | null
          occupation: string | null
          past_illness_history: string | null
          personal_history: string | null
          phone: string | null
          physical_activity: string | null
          pregnancy_status: string | null
          previous_childbirths: number | null
          profile_locked: boolean | null
          socio_economic_status: string | null
          treatment_history: string | null
          updated_at: string
          user_id: string | null
          weight: number | null
        }
        Insert: {
          address?: string | null
          age: number
          allergies?: string[] | null
          avatar_url?: string | null
          chief_complaint?: string | null
          created_at?: string
          date_of_birth?: string | null
          drug_history?: string | null
          gender?: string
          height_cm?: number | null
          height_feet?: number | null
          height_inches?: number | null
          history_of_present_illness?: string | null
          id?: string
          immunization_history?: string | null
          marital_status?: string
          medical_conditions?: string[] | null
          name: string
          ob_gyn_history?: string | null
          occupation?: string | null
          past_illness_history?: string | null
          personal_history?: string | null
          phone?: string | null
          physical_activity?: string | null
          pregnancy_status?: string | null
          previous_childbirths?: number | null
          profile_locked?: boolean | null
          socio_economic_status?: string | null
          treatment_history?: string | null
          updated_at?: string
          user_id?: string | null
          weight?: number | null
        }
        Update: {
          address?: string | null
          age?: number
          allergies?: string[] | null
          avatar_url?: string | null
          chief_complaint?: string | null
          created_at?: string
          date_of_birth?: string | null
          drug_history?: string | null
          gender?: string
          height_cm?: number | null
          height_feet?: number | null
          height_inches?: number | null
          history_of_present_illness?: string | null
          id?: string
          immunization_history?: string | null
          marital_status?: string
          medical_conditions?: string[] | null
          name?: string
          ob_gyn_history?: string | null
          occupation?: string | null
          past_illness_history?: string | null
          personal_history?: string | null
          phone?: string | null
          physical_activity?: string | null
          pregnancy_status?: string | null
          previous_childbirths?: number | null
          profile_locked?: boolean | null
          socio_economic_status?: string | null
          treatment_history?: string | null
          updated_at?: string
          user_id?: string | null
          weight?: number | null
        }
        Relationships: []
      }
      prescription_files: {
        Row: {
          created_at: string
          file_name: string
          file_path: string
          id: string
          mime_type: string | null
          notes: string | null
          patient_id: string
          uploaded_by: string | null
          visit_id: string | null
        }
        Insert: {
          created_at?: string
          file_name: string
          file_path: string
          id?: string
          mime_type?: string | null
          notes?: string | null
          patient_id: string
          uploaded_by?: string | null
          visit_id?: string | null
        }
        Update: {
          created_at?: string
          file_name?: string
          file_path?: string
          id?: string
          mime_type?: string | null
          notes?: string | null
          patient_id?: string
          uploaded_by?: string | null
          visit_id?: string | null
        }
        Relationships: []
      }
      prescriptions: {
        Row: {
          advice: string | null
          chamber_id: string
          consultation_type: string | null
          created_at: string
          diagnosis: string
          examination_findings: string | null
          follow_up_days: string | null
          id: string
          is_provisional: boolean | null
          language: string
          medicines: Json | null
          patient_id: string
          provisional_medicines: Json | null
          symptoms: string
          tests: string | null
          visit_id: string | null
        }
        Insert: {
          advice?: string | null
          chamber_id?: string
          consultation_type?: string | null
          created_at?: string
          diagnosis?: string
          examination_findings?: string | null
          follow_up_days?: string | null
          id?: string
          is_provisional?: boolean | null
          language?: string
          medicines?: Json | null
          patient_id: string
          provisional_medicines?: Json | null
          symptoms?: string
          tests?: string | null
          visit_id?: string | null
        }
        Update: {
          advice?: string | null
          chamber_id?: string
          consultation_type?: string | null
          created_at?: string
          diagnosis?: string
          examination_findings?: string | null
          follow_up_days?: string | null
          id?: string
          is_provisional?: boolean | null
          language?: string
          medicines?: Json | null
          patient_id?: string
          provisional_medicines?: Json | null
          symptoms?: string
          tests?: string | null
          visit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prescriptions_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      visits: {
        Row: {
          advice: string | null
          chief_complaint: string | null
          created_at: string
          date: string
          examination_findings: string | null
          final_diagnosis: string | null
          follow_up_days: string | null
          id: string
          investigation_notes: string | null
          investigations: string | null
          medicines: Json | null
          patient_id: string
          prescription_id: string | null
          provisional_medicines: Json | null
          stage: string
          updated_at: string
        }
        Insert: {
          advice?: string | null
          chief_complaint?: string | null
          created_at?: string
          date: string
          examination_findings?: string | null
          final_diagnosis?: string | null
          follow_up_days?: string | null
          id?: string
          investigation_notes?: string | null
          investigations?: string | null
          medicines?: Json | null
          patient_id: string
          prescription_id?: string | null
          provisional_medicines?: Json | null
          stage?: string
          updated_at?: string
        }
        Update: {
          advice?: string | null
          chief_complaint?: string | null
          created_at?: string
          date?: string
          examination_findings?: string | null
          final_diagnosis?: string | null
          follow_up_days?: string | null
          id?: string
          investigation_notes?: string | null
          investigations?: string | null
          medicines?: Json | null
          patient_id?: string
          prescription_id?: string | null
          provisional_medicines?: Json | null
          stage?: string
          updated_at?: string
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
      doctor_public_info: {
        Row: {
          degrees: string | null
          degrees_bn: string | null
          id: string | null
          institution: string | null
          institution_bn: string | null
          letterhead_url: string | null
          name: string | null
          name_bn: string | null
          specialization: string | null
          specialization_bn: string | null
          title: string | null
          title_bn: string | null
          website: string | null
        }
        Insert: {
          degrees?: string | null
          degrees_bn?: string | null
          id?: string | null
          institution?: string | null
          institution_bn?: string | null
          letterhead_url?: string | null
          name?: string | null
          name_bn?: string | null
          specialization?: string | null
          specialization_bn?: string | null
          title?: string | null
          title_bn?: string | null
          website?: string | null
        }
        Update: {
          degrees?: string | null
          degrees_bn?: string | null
          id?: string | null
          institution?: string | null
          institution_bn?: string | null
          letterhead_url?: string | null
          name?: string | null
          name_bn?: string | null
          specialization?: string | null
          specialization_bn?: string | null
          title?: string | null
          title_bn?: string | null
          website?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      get_booked_slots: {
        Args: { target_date: string }
        Returns: {
          time_slot: string
        }[]
      }
      get_doctor_email: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "doctor" | "patient"
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
      app_role: ["doctor", "patient"],
    },
  },
} as const
