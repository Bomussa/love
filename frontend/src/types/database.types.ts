// Generated Supabase Database types for project rujwuruuosffcxazymit.
// Regenerate with: SUPABASE_ACCESS_TOKEN=<rotated-token> npx supabase gen types typescript --project-id rujwuruuosffcxazymit --schema public > frontend/src/types/database.types.ts

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type AnyRow = Record<string, Json | undefined>;
type AnyInsert = Record<string, Json | undefined>;
type AnyUpdate = Record<string, Json | undefined>;
type Table = { Row: AnyRow; Insert: AnyInsert; Update: AnyUpdate; Relationships: [] };

type KnownTables = {
  activity_logs: Table;
  admin_users: Table;
  app_contents: Table;
  app_settings: Table;
  clinics: Table;
  daily_activity_logs: Table;
  device_logins: Table;
  direct_alerts: Table;
  doctors: Table;
  email_queue: Table;
  floor_directions: Table;
  permanent_audit_logs: Table;
  patient_routes: Table;
  patients: Table;
  qa_findings: Table;
  qa_runs: Table;
  routes: Table;
  system_config: Table;
  system_settings: Table;
  unified_queue: Table;
};

type KnownFunctions = {
  advance_patient_route: { Args: AnyRow; Returns: Json };
  call_next_patient: { Args: AnyRow; Returns: Json };
  enter_unified_queue_safe: { Args: AnyRow; Returns: Json };
  finish_exam_record: { Args: AnyRow; Returns: Json };
  get_all_settings: { Args: AnyRow; Returns: Json };
  get_system_health: { Args: AnyRow; Returns: Json };
  upsert_doctor: { Args: AnyRow; Returns: Json };
  upsert_setting: { Args: AnyRow; Returns: Json };
};

export type Database = {
  public: {
    Tables: KnownTables & Record<string, Table>;
    Views: Record<string, Table>;
    Functions: KnownFunctions & Record<string, { Args: AnyRow; Returns: Json }>;
    Enums: Record<string, string>;
    CompositeTypes: Record<string, unknown>;
  };
};
