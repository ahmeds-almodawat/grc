// Lightweight Supabase typing for the MVP. Extend with generated Supabase types later using:
// npx supabase gen types typescript --project-id <project-id> > src/types/supabase-generated.ts
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Views: {
      v_executive_grc_summary: {
        Row: {
          organization_id: string;
          organization_name_en: string | null;
          organization_name_ar: string | null;
          active_projects: number;
          overdue_projects: number;
          overdue_milestones: number;
          overdue_tasks: number;
          critical_open_risks: number;
          compliance_expiring_30_days: number;
          overdue_audit_findings: number;
          pending_approvals: number;
          pending_evidence_reviews: number;
        };
      };
      v_critical_attention_items: {
        Row: {
          id: string;
          organization_id: string;
          item_type: string;
          title: string;
          department_name: string | null;
          owner_name: string | null;
          due_date: string | null;
          status: string;
          risk_level: 'critical' | 'high' | 'medium' | 'low';
          progress_percent: number | null;
          sort_rank: number;
        };
      };
    };
    Tables: {
      organizations: {
        Row: { id: string; name_en: string; name_ar: string | null; is_active: boolean; created_at: string; updated_at: string };
        Insert: { id?: string; name_en: string; name_ar?: string | null; is_active?: boolean };
        Update: Partial<Database['public']['Tables']['organizations']['Insert']>;
      };
      departments: {
        Row: { id: string; organization_id: string; division_id: string | null; name_en: string; name_ar: string | null; code: string | null; is_active: boolean };
        Insert: { id?: string; organization_id: string; division_id?: string | null; name_en: string; name_ar?: string | null; code?: string | null; is_active?: boolean };
        Update: Partial<Database['public']['Tables']['departments']['Insert']>;
      };
      profiles: {
        Row: { id: string; organization_id: string | null; full_name_en: string; full_name_ar: string | null; email: string; department_id: string | null; is_active: boolean };
        Insert: { id: string; organization_id?: string | null; full_name_en: string; full_name_ar?: string | null; email: string; department_id?: string | null; is_active?: boolean };
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
      };
      projects: {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
      };
      risks: {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
      };
      compliance_items: {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
      };
      audit_findings: {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
      };
      committee_decisions: {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
      };
    };
  };
}
