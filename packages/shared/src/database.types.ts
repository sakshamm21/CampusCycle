export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '14.18';
  };
  public: {
    Tables: {
      ai_actions: {
        Row: {
          args: Json;
          college_id: string | null;
          confirmed_at: string | null;
          created_at: string;
          error: string | null;
          expires_at: string;
          id: string;
          is_demo: boolean;
          preview: Json;
          result: Json | null;
          run_id: string | null;
          status: Database['public']['Enums']['ai_action_status'];
          thread_id: string | null;
          tool: string;
          user_id: string;
        };
        Insert: {
          args: Json;
          college_id?: string | null;
          confirmed_at?: string | null;
          created_at?: string;
          error?: string | null;
          expires_at?: string;
          id?: string;
          is_demo?: boolean;
          preview: Json;
          result?: Json | null;
          run_id?: string | null;
          status?: Database['public']['Enums']['ai_action_status'];
          thread_id?: string | null;
          tool: string;
          user_id: string;
        };
        Update: {
          args?: Json;
          college_id?: string | null;
          confirmed_at?: string | null;
          created_at?: string;
          error?: string | null;
          expires_at?: string;
          id?: string;
          is_demo?: boolean;
          preview?: Json;
          result?: Json | null;
          run_id?: string | null;
          status?: Database['public']['Enums']['ai_action_status'];
          thread_id?: string | null;
          tool?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'ai_actions_college_id_fkey';
            columns: ['college_id'];
            isOneToOne: false;
            referencedRelation: 'colleges';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'ai_actions_run_id_fkey';
            columns: ['run_id'];
            isOneToOne: false;
            referencedRelation: 'ai_runs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'ai_actions_thread_id_fkey';
            columns: ['thread_id'];
            isOneToOne: false;
            referencedRelation: 'ai_threads';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'ai_actions_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'admin_users_v';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'ai_actions_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      ai_evals: {
        Row: {
          cases_passed: number;
          cases_total: number;
          cost_usd: number;
          details: Json;
          id: string;
          job: string;
          model: string;
          prompt_version: string;
          run_at: string;
          safety_passed: boolean;
          score: number;
        };
        Insert: {
          cases_passed: number;
          cases_total: number;
          cost_usd?: number;
          details?: Json;
          id?: string;
          job: string;
          model: string;
          prompt_version: string;
          run_at?: string;
          safety_passed: boolean;
          score: number;
        };
        Update: {
          cases_passed?: number;
          cases_total?: number;
          cost_usd?: number;
          details?: Json;
          id?: string;
          job?: string;
          model?: string;
          prompt_version?: string;
          run_at?: string;
          safety_passed?: boolean;
          score?: number;
        };
        Relationships: [];
      };
      ai_insights: {
        Row: {
          college_id: string;
          content: Json;
          created_at: string;
          id: string;
          is_demo: boolean;
          is_seed: boolean;
          kind: Database['public']['Enums']['ai_insight_kind'];
          run_id: string | null;
          status: Database['public']['Enums']['ai_insight_status'];
          valid_until: string | null;
        };
        Insert: {
          college_id: string;
          content: Json;
          created_at?: string;
          id?: string;
          is_demo?: boolean;
          is_seed?: boolean;
          kind: Database['public']['Enums']['ai_insight_kind'];
          run_id?: string | null;
          status?: Database['public']['Enums']['ai_insight_status'];
          valid_until?: string | null;
        };
        Update: {
          college_id?: string;
          content?: Json;
          created_at?: string;
          id?: string;
          is_demo?: boolean;
          is_seed?: boolean;
          kind?: Database['public']['Enums']['ai_insight_kind'];
          run_id?: string | null;
          status?: Database['public']['Enums']['ai_insight_status'];
          valid_until?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'ai_insights_college_id_fkey';
            columns: ['college_id'];
            isOneToOne: false;
            referencedRelation: 'colleges';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'ai_insights_run_id_fkey';
            columns: ['run_id'];
            isOneToOne: false;
            referencedRelation: 'ai_runs';
            referencedColumns: ['id'];
          },
        ];
      };
      ai_knowledge: {
        Row: {
          chunk_index: number;
          college_id: string | null;
          content: string;
          content_hash: string;
          created_at: string;
          embedding: string;
          id: string;
          source: string;
        };
        Insert: {
          chunk_index: number;
          college_id?: string | null;
          content: string;
          content_hash: string;
          created_at?: string;
          embedding: string;
          id?: string;
          source: string;
        };
        Update: {
          chunk_index?: number;
          college_id?: string | null;
          content?: string;
          content_hash?: string;
          created_at?: string;
          embedding?: string;
          id?: string;
          source?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'ai_knowledge_college_id_fkey';
            columns: ['college_id'];
            isOneToOne: false;
            referencedRelation: 'colleges';
            referencedColumns: ['id'];
          },
        ];
      };
      ai_memories: {
        Row: {
          content: string;
          created_at: string;
          embedding: string;
          id: string;
          last_used_at: string | null;
          user_id: string;
        };
        Insert: {
          content: string;
          created_at?: string;
          embedding: string;
          id?: string;
          last_used_at?: string | null;
          user_id: string;
        };
        Update: {
          content?: string;
          created_at?: string;
          embedding?: string;
          id?: string;
          last_used_at?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'ai_memories_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'admin_users_v';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'ai_memories_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      ai_messages: {
        Row: {
          action_ids: string[];
          chart: Json | null;
          content: string;
          created_at: string;
          id: string;
          input_mode: string;
          photo_path: string | null;
          role: string;
          run_id: string | null;
          table_data: Json | null;
          thread_id: string;
        };
        Insert: {
          action_ids?: string[];
          chart?: Json | null;
          content?: string;
          created_at?: string;
          id?: string;
          input_mode?: string;
          photo_path?: string | null;
          role: string;
          run_id?: string | null;
          table_data?: Json | null;
          thread_id: string;
        };
        Update: {
          action_ids?: string[];
          chart?: Json | null;
          content?: string;
          created_at?: string;
          id?: string;
          input_mode?: string;
          photo_path?: string | null;
          role?: string;
          run_id?: string | null;
          table_data?: Json | null;
          thread_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'ai_messages_thread_id_fkey';
            columns: ['thread_id'];
            isOneToOne: false;
            referencedRelation: 'ai_threads';
            referencedColumns: ['id'];
          },
        ];
      };
      ai_runs: {
        Row: {
          agent: Database['public']['Enums']['ai_agent'];
          college_id: string | null;
          cost_usd: number;
          duration_ms: number | null;
          ended_at: string | null;
          error: string | null;
          id: string;
          input_summary: string | null;
          is_demo: boolean;
          is_seed: boolean;
          models_used: string[];
          output_summary: string | null;
          prompt_version: string | null;
          started_at: string;
          status: Database['public']['Enums']['ai_run_status'];
          steps: number;
          thread_id: string | null;
          tokens_in: number;
          tokens_out: number;
          trigger: Database['public']['Enums']['ai_trigger'];
          user_id: string | null;
        };
        Insert: {
          agent: Database['public']['Enums']['ai_agent'];
          college_id?: string | null;
          cost_usd?: number;
          duration_ms?: number | null;
          ended_at?: string | null;
          error?: string | null;
          id?: string;
          input_summary?: string | null;
          is_demo?: boolean;
          is_seed?: boolean;
          models_used?: string[];
          output_summary?: string | null;
          prompt_version?: string | null;
          started_at?: string;
          status?: Database['public']['Enums']['ai_run_status'];
          steps?: number;
          thread_id?: string | null;
          tokens_in?: number;
          tokens_out?: number;
          trigger: Database['public']['Enums']['ai_trigger'];
          user_id?: string | null;
        };
        Update: {
          agent?: Database['public']['Enums']['ai_agent'];
          college_id?: string | null;
          cost_usd?: number;
          duration_ms?: number | null;
          ended_at?: string | null;
          error?: string | null;
          id?: string;
          input_summary?: string | null;
          is_demo?: boolean;
          is_seed?: boolean;
          models_used?: string[];
          output_summary?: string | null;
          prompt_version?: string | null;
          started_at?: string;
          status?: Database['public']['Enums']['ai_run_status'];
          steps?: number;
          thread_id?: string | null;
          tokens_in?: number;
          tokens_out?: number;
          trigger?: Database['public']['Enums']['ai_trigger'];
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'ai_runs_college_id_fkey';
            columns: ['college_id'];
            isOneToOne: false;
            referencedRelation: 'colleges';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'ai_runs_thread_id_fkey';
            columns: ['thread_id'];
            isOneToOne: false;
            referencedRelation: 'ai_threads';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'ai_runs_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'admin_users_v';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'ai_runs_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      ai_settings: {
        Row: {
          college_id: string | null;
          daily_steps: Json;
          features: Json;
          free_only: boolean;
          id: string;
          model_routes: Json | null;
          monthly_cap_usd: number;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          college_id?: string | null;
          daily_steps?: Json;
          features?: Json;
          free_only?: boolean;
          id?: string;
          model_routes?: Json | null;
          monthly_cap_usd?: number;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          college_id?: string | null;
          daily_steps?: Json;
          features?: Json;
          free_only?: boolean;
          id?: string;
          model_routes?: Json | null;
          monthly_cap_usd?: number;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'ai_settings_college_id_fkey';
            columns: ['college_id'];
            isOneToOne: true;
            referencedRelation: 'colleges';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'ai_settings_updated_by_fkey';
            columns: ['updated_by'];
            isOneToOne: false;
            referencedRelation: 'admin_users_v';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'ai_settings_updated_by_fkey';
            columns: ['updated_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      ai_steps: {
        Row: {
          agent: Database['public']['Enums']['ai_agent'] | null;
          cost_usd: number;
          created_at: string;
          duration_ms: number;
          id: string;
          input: Json | null;
          kind: Database['public']['Enums']['ai_step_kind'];
          model: string | null;
          name: string;
          ok: boolean;
          output: Json | null;
          run_id: string;
          step_no: number;
          tokens_in: number;
          tokens_out: number;
        };
        Insert: {
          agent?: Database['public']['Enums']['ai_agent'] | null;
          cost_usd?: number;
          created_at?: string;
          duration_ms?: number;
          id?: string;
          input?: Json | null;
          kind: Database['public']['Enums']['ai_step_kind'];
          model?: string | null;
          name?: string;
          ok?: boolean;
          output?: Json | null;
          run_id: string;
          step_no: number;
          tokens_in?: number;
          tokens_out?: number;
        };
        Update: {
          agent?: Database['public']['Enums']['ai_agent'] | null;
          cost_usd?: number;
          created_at?: string;
          duration_ms?: number;
          id?: string;
          input?: Json | null;
          kind?: Database['public']['Enums']['ai_step_kind'];
          model?: string | null;
          name?: string;
          ok?: boolean;
          output?: Json | null;
          run_id?: string;
          step_no?: number;
          tokens_in?: number;
          tokens_out?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'ai_steps_run_id_fkey';
            columns: ['run_id'];
            isOneToOne: false;
            referencedRelation: 'ai_runs';
            referencedColumns: ['id'];
          },
        ];
      };
      ai_threads: {
        Row: {
          college_id: string | null;
          created_at: string;
          id: string;
          is_demo: boolean;
          is_seed: boolean;
          language: string;
          summary: string;
          summary_upto: string | null;
          surface: string;
          title: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          college_id?: string | null;
          created_at?: string;
          id?: string;
          is_demo?: boolean;
          is_seed?: boolean;
          language?: string;
          summary?: string;
          summary_upto?: string | null;
          surface: string;
          title?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          college_id?: string | null;
          created_at?: string;
          id?: string;
          is_demo?: boolean;
          is_seed?: boolean;
          language?: string;
          summary?: string;
          summary_upto?: string | null;
          surface?: string;
          title?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'ai_threads_college_id_fkey';
            columns: ['college_id'];
            isOneToOne: false;
            referencedRelation: 'colleges';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'ai_threads_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'admin_users_v';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'ai_threads_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      ai_usage: {
        Row: {
          college_id: string | null;
          cost_usd: number;
          day: string;
          pool: string;
          steps: number;
          tokens_in: number;
          tokens_out: number;
          user_id: string | null;
        };
        Insert: {
          college_id?: string | null;
          cost_usd?: number;
          day: string;
          pool: string;
          steps?: number;
          tokens_in?: number;
          tokens_out?: number;
          user_id?: string | null;
        };
        Update: {
          college_id?: string | null;
          cost_usd?: number;
          day?: string;
          pool?: string;
          steps?: number;
          tokens_in?: number;
          tokens_out?: number;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'ai_usage_college_id_fkey';
            columns: ['college_id'];
            isOneToOne: false;
            referencedRelation: 'colleges';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'ai_usage_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'admin_users_v';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'ai_usage_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      audit_log: {
        Row: {
          action: string;
          actor_id: string | null;
          college_id: string | null;
          confirmed_by: string | null;
          created_at: string;
          details: Json;
          id: number;
          is_demo: boolean;
          target_id: string | null;
          target_type: string | null;
          via: string;
        };
        Insert: {
          action: string;
          actor_id?: string | null;
          college_id?: string | null;
          confirmed_by?: string | null;
          created_at?: string;
          details?: Json;
          id?: never;
          is_demo?: boolean;
          target_id?: string | null;
          target_type?: string | null;
          via?: string;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          college_id?: string | null;
          confirmed_by?: string | null;
          created_at?: string;
          details?: Json;
          id?: never;
          is_demo?: boolean;
          target_id?: string | null;
          target_type?: string | null;
          via?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'audit_log_actor_id_fkey';
            columns: ['actor_id'];
            isOneToOne: false;
            referencedRelation: 'admin_users_v';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'audit_log_actor_id_fkey';
            columns: ['actor_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'audit_log_college_id_fkey';
            columns: ['college_id'];
            isOneToOne: false;
            referencedRelation: 'colleges';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'audit_log_confirmed_by_fkey';
            columns: ['confirmed_by'];
            isOneToOne: false;
            referencedRelation: 'admin_users_v';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'audit_log_confirmed_by_fkey';
            columns: ['confirmed_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      bikes: {
        Row: {
          ai_flag: string | null;
          college_id: string;
          created_at: string;
          current_pass_id: string | null;
          current_stand_id: string | null;
          id: string;
          is_demo: boolean;
          last_seen_at: string | null;
          last_seen_stand_id: string | null;
          maintenance_after_return: boolean;
          notes: string;
          short_code: string;
          status: Database['public']['Enums']['bike_status'];
          updated_at: string;
        };
        Insert: {
          ai_flag?: string | null;
          college_id: string;
          created_at?: string;
          current_pass_id?: string | null;
          current_stand_id?: string | null;
          id?: string;
          is_demo?: boolean;
          last_seen_at?: string | null;
          last_seen_stand_id?: string | null;
          maintenance_after_return?: boolean;
          notes?: string;
          short_code: string;
          status?: Database['public']['Enums']['bike_status'];
          updated_at?: string;
        };
        Update: {
          ai_flag?: string | null;
          college_id?: string;
          created_at?: string;
          current_pass_id?: string | null;
          current_stand_id?: string | null;
          id?: string;
          is_demo?: boolean;
          last_seen_at?: string | null;
          last_seen_stand_id?: string | null;
          maintenance_after_return?: boolean;
          notes?: string;
          short_code?: string;
          status?: Database['public']['Enums']['bike_status'];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'bikes_college_id_fkey';
            columns: ['college_id'];
            isOneToOne: false;
            referencedRelation: 'colleges';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'bikes_current_pass_fk';
            columns: ['current_pass_id'];
            isOneToOne: true;
            referencedRelation: 'admin_bikes_v';
            referencedColumns: ['pass_id'];
          },
          {
            foreignKeyName: 'bikes_current_pass_fk';
            columns: ['current_pass_id'];
            isOneToOne: true;
            referencedRelation: 'admin_users_v';
            referencedColumns: ['pass_id'];
          },
          {
            foreignKeyName: 'bikes_current_pass_fk';
            columns: ['current_pass_id'];
            isOneToOne: true;
            referencedRelation: 'rider_passes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'bikes_current_stand_id_fkey';
            columns: ['current_stand_id'];
            isOneToOne: false;
            referencedRelation: 'stands';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'bikes_last_seen_stand_id_fkey';
            columns: ['last_seen_stand_id'];
            isOneToOne: false;
            referencedRelation: 'stands';
            referencedColumns: ['id'];
          },
        ];
      };
      colleges: {
        Row: {
          active: boolean;
          bike_prefix: string;
          center_lat: number | null;
          center_lng: number | null;
          created_at: string;
          default_geofence_m: number;
          email_domains: string[];
          id: string;
          max_ride_minutes: number;
          name: string;
          next_pass_no: number;
          rules_text: string;
          short_code: string;
          strike_limit: number;
          time_zone: string;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          bike_prefix: string;
          center_lat?: number | null;
          center_lng?: number | null;
          created_at?: string;
          default_geofence_m?: number;
          email_domains?: string[];
          id?: string;
          max_ride_minutes?: number;
          name: string;
          next_pass_no?: number;
          rules_text?: string;
          short_code: string;
          strike_limit?: number;
          time_zone?: string;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          bike_prefix?: string;
          center_lat?: number | null;
          center_lng?: number | null;
          created_at?: string;
          default_geofence_m?: number;
          email_domains?: string[];
          id?: string;
          max_ride_minutes?: number;
          name?: string;
          next_pass_no?: number;
          rules_text?: string;
          short_code?: string;
          strike_limit?: number;
          time_zone?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      issue_reports: {
        Row: {
          ai_suggested_type: Database['public']['Enums']['issue_type'] | null;
          assigned_to: string | null;
          bike_id: string | null;
          college_id: string;
          created_at: string;
          group_id: string | null;
          id: string;
          is_demo: boolean;
          is_seed: boolean;
          note: string;
          photo_path: string | null;
          reporter_id: string | null;
          resolution_note: string | null;
          resolved_at: string | null;
          resolved_by: string | null;
          ride_id: string | null;
          source: string;
          stand_id: string | null;
          status: Database['public']['Enums']['issue_status'];
          triage_attempts: number;
          triaged_at: string | null;
          type: Database['public']['Enums']['issue_type'];
          updated_at: string;
          urgency: number | null;
        };
        Insert: {
          ai_suggested_type?: Database['public']['Enums']['issue_type'] | null;
          assigned_to?: string | null;
          bike_id?: string | null;
          college_id: string;
          created_at?: string;
          group_id?: string | null;
          id?: string;
          is_demo?: boolean;
          is_seed?: boolean;
          note?: string;
          photo_path?: string | null;
          reporter_id?: string | null;
          resolution_note?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          ride_id?: string | null;
          source?: string;
          stand_id?: string | null;
          status?: Database['public']['Enums']['issue_status'];
          triage_attempts?: number;
          triaged_at?: string | null;
          type: Database['public']['Enums']['issue_type'];
          updated_at?: string;
          urgency?: number | null;
        };
        Update: {
          ai_suggested_type?: Database['public']['Enums']['issue_type'] | null;
          assigned_to?: string | null;
          bike_id?: string | null;
          college_id?: string;
          created_at?: string;
          group_id?: string | null;
          id?: string;
          is_demo?: boolean;
          is_seed?: boolean;
          note?: string;
          photo_path?: string | null;
          reporter_id?: string | null;
          resolution_note?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          ride_id?: string | null;
          source?: string;
          stand_id?: string | null;
          status?: Database['public']['Enums']['issue_status'];
          triage_attempts?: number;
          triaged_at?: string | null;
          type?: Database['public']['Enums']['issue_type'];
          updated_at?: string;
          urgency?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'issue_group_fk';
            columns: ['group_id'];
            isOneToOne: false;
            referencedRelation: 'ai_insights';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'issue_reports_assigned_to_fkey';
            columns: ['assigned_to'];
            isOneToOne: false;
            referencedRelation: 'admin_users_v';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'issue_reports_assigned_to_fkey';
            columns: ['assigned_to'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'issue_reports_bike_id_fkey';
            columns: ['bike_id'];
            isOneToOne: false;
            referencedRelation: 'admin_bikes_v';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'issue_reports_bike_id_fkey';
            columns: ['bike_id'];
            isOneToOne: false;
            referencedRelation: 'bikes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'issue_reports_college_id_fkey';
            columns: ['college_id'];
            isOneToOne: false;
            referencedRelation: 'colleges';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'issue_reports_reporter_id_fkey';
            columns: ['reporter_id'];
            isOneToOne: false;
            referencedRelation: 'admin_users_v';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'issue_reports_reporter_id_fkey';
            columns: ['reporter_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'issue_reports_resolved_by_fkey';
            columns: ['resolved_by'];
            isOneToOne: false;
            referencedRelation: 'admin_users_v';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'issue_reports_resolved_by_fkey';
            columns: ['resolved_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'issue_reports_ride_id_fkey';
            columns: ['ride_id'];
            isOneToOne: false;
            referencedRelation: 'admin_rides_v';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'issue_reports_ride_id_fkey';
            columns: ['ride_id'];
            isOneToOne: false;
            referencedRelation: 'rides';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'issue_reports_stand_id_fkey';
            columns: ['stand_id'];
            isOneToOne: false;
            referencedRelation: 'stands';
            referencedColumns: ['id'];
          },
        ];
      };
      notifications: {
        Row: {
          body: string;
          college_id: string | null;
          created_at: string;
          data: Json;
          id: string;
          kind: Database['public']['Enums']['notification_kind'];
          push_error: string | null;
          pushed_at: string | null;
          read_at: string | null;
          title: string;
          user_id: string;
        };
        Insert: {
          body: string;
          college_id?: string | null;
          created_at?: string;
          data?: Json;
          id?: string;
          kind: Database['public']['Enums']['notification_kind'];
          push_error?: string | null;
          pushed_at?: string | null;
          read_at?: string | null;
          title: string;
          user_id: string;
        };
        Update: {
          body?: string;
          college_id?: string | null;
          created_at?: string;
          data?: Json;
          id?: string;
          kind?: Database['public']['Enums']['notification_kind'];
          push_error?: string | null;
          pushed_at?: string | null;
          read_at?: string | null;
          title?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'notifications_college_id_fkey';
            columns: ['college_id'];
            isOneToOne: false;
            referencedRelation: 'colleges';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'notifications_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'admin_users_v';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'notifications_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      profiles: {
        Row: {
          applied_at: string;
          approved_at: string | null;
          approved_by: string | null;
          college_id: string | null;
          created_at: string;
          demo_role: string | null;
          email: string;
          email_domain_match: boolean;
          full_name: string;
          id: string;
          id_check_attempts: number;
          id_check_consent: boolean;
          id_check_result: Json | null;
          id_photo_path: string | null;
          is_demo: boolean;
          is_owner: boolean;
          notif_prefs: Json;
          password_reset_requested_at: string | null;
          phone: string;
          push_token: string | null;
          rejection_reason: string | null;
          role: Database['public']['Enums']['user_role'];
          roll_number: string;
          rules_accepted_at: string | null;
          status: Database['public']['Enums']['profile_status'];
          strikes: number;
          suspended_reason: string | null;
          theme: string;
          updated_at: string;
        };
        Insert: {
          applied_at?: string;
          approved_at?: string | null;
          approved_by?: string | null;
          college_id?: string | null;
          created_at?: string;
          demo_role?: string | null;
          email: string;
          email_domain_match?: boolean;
          full_name?: string;
          id: string;
          id_check_attempts?: number;
          id_check_consent?: boolean;
          id_check_result?: Json | null;
          id_photo_path?: string | null;
          is_demo?: boolean;
          is_owner?: boolean;
          notif_prefs?: Json;
          password_reset_requested_at?: string | null;
          phone?: string;
          push_token?: string | null;
          rejection_reason?: string | null;
          role?: Database['public']['Enums']['user_role'];
          roll_number?: string;
          rules_accepted_at?: string | null;
          status?: Database['public']['Enums']['profile_status'];
          strikes?: number;
          suspended_reason?: string | null;
          theme?: string;
          updated_at?: string;
        };
        Update: {
          applied_at?: string;
          approved_at?: string | null;
          approved_by?: string | null;
          college_id?: string | null;
          created_at?: string;
          demo_role?: string | null;
          email?: string;
          email_domain_match?: boolean;
          full_name?: string;
          id?: string;
          id_check_attempts?: number;
          id_check_consent?: boolean;
          id_check_result?: Json | null;
          id_photo_path?: string | null;
          is_demo?: boolean;
          is_owner?: boolean;
          notif_prefs?: Json;
          password_reset_requested_at?: string | null;
          phone?: string;
          push_token?: string | null;
          rejection_reason?: string | null;
          role?: Database['public']['Enums']['user_role'];
          roll_number?: string;
          rules_accepted_at?: string | null;
          status?: Database['public']['Enums']['profile_status'];
          strikes?: number;
          suspended_reason?: string | null;
          theme?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'profiles_approved_by_fkey';
            columns: ['approved_by'];
            isOneToOne: false;
            referencedRelation: 'admin_users_v';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'profiles_approved_by_fkey';
            columns: ['approved_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'profiles_college_id_fkey';
            columns: ['college_id'];
            isOneToOne: false;
            referencedRelation: 'colleges';
            referencedColumns: ['id'];
          },
        ];
      };
      rider_passes: {
        Row: {
          borrowed_at: string | null;
          college_id: string | null;
          created_at: string;
          current_bike_id: string | null;
          current_ride_id: string | null;
          id: string;
          is_demo: boolean;
          issued_at: string | null;
          minted_seen_at: string | null;
          pass_number: number | null;
          rider_id: string;
          status: Database['public']['Enums']['pass_status'];
          total_minutes: number;
          total_rides: number;
          updated_at: string;
        };
        Insert: {
          borrowed_at?: string | null;
          college_id?: string | null;
          created_at?: string;
          current_bike_id?: string | null;
          current_ride_id?: string | null;
          id?: string;
          is_demo?: boolean;
          issued_at?: string | null;
          minted_seen_at?: string | null;
          pass_number?: number | null;
          rider_id: string;
          status?: Database['public']['Enums']['pass_status'];
          total_minutes?: number;
          total_rides?: number;
          updated_at?: string;
        };
        Update: {
          borrowed_at?: string | null;
          college_id?: string | null;
          created_at?: string;
          current_bike_id?: string | null;
          current_ride_id?: string | null;
          id?: string;
          is_demo?: boolean;
          issued_at?: string | null;
          minted_seen_at?: string | null;
          pass_number?: number | null;
          rider_id?: string;
          status?: Database['public']['Enums']['pass_status'];
          total_minutes?: number;
          total_rides?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'passes_current_ride_fk';
            columns: ['current_ride_id'];
            isOneToOne: true;
            referencedRelation: 'admin_rides_v';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'passes_current_ride_fk';
            columns: ['current_ride_id'];
            isOneToOne: true;
            referencedRelation: 'rides';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'rider_passes_college_id_fkey';
            columns: ['college_id'];
            isOneToOne: false;
            referencedRelation: 'colleges';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'rider_passes_current_bike_id_fkey';
            columns: ['current_bike_id'];
            isOneToOne: true;
            referencedRelation: 'admin_bikes_v';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'rider_passes_current_bike_id_fkey';
            columns: ['current_bike_id'];
            isOneToOne: true;
            referencedRelation: 'bikes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'rider_passes_rider_id_fkey';
            columns: ['rider_id'];
            isOneToOne: true;
            referencedRelation: 'admin_users_v';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'rider_passes_rider_id_fkey';
            columns: ['rider_id'];
            isOneToOne: true;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      rides: {
        Row: {
          bike_id: string;
          college_id: string;
          created_at: string;
          due_at: string;
          end_accuracy_m: number | null;
          end_lat: number | null;
          end_lng: number | null;
          end_stand_id: string | null;
          ended_at: string | null;
          flags: string[];
          force_note: string | null;
          forced_by: string | null;
          id: string;
          is_demo: boolean;
          is_overdue: boolean;
          late: boolean;
          overdue_at: string | null;
          pass_id: string | null;
          photo_check: Database['public']['Enums']['photo_check'];
          photo_check_attempts: number;
          photo_check_note: string | null;
          reminder_sent_at: string | null;
          return_photo_path: string | null;
          rider_id: string | null;
          start_accuracy_m: number | null;
          start_lat: number | null;
          start_lng: number | null;
          start_stand_id: string | null;
          started_at: string;
          status: Database['public']['Enums']['ride_status'];
        };
        Insert: {
          bike_id: string;
          college_id: string;
          created_at?: string;
          due_at: string;
          end_accuracy_m?: number | null;
          end_lat?: number | null;
          end_lng?: number | null;
          end_stand_id?: string | null;
          ended_at?: string | null;
          flags?: string[];
          force_note?: string | null;
          forced_by?: string | null;
          id?: string;
          is_demo?: boolean;
          is_overdue?: boolean;
          late?: boolean;
          overdue_at?: string | null;
          pass_id?: string | null;
          photo_check?: Database['public']['Enums']['photo_check'];
          photo_check_attempts?: number;
          photo_check_note?: string | null;
          reminder_sent_at?: string | null;
          return_photo_path?: string | null;
          rider_id?: string | null;
          start_accuracy_m?: number | null;
          start_lat?: number | null;
          start_lng?: number | null;
          start_stand_id?: string | null;
          started_at?: string;
          status?: Database['public']['Enums']['ride_status'];
        };
        Update: {
          bike_id?: string;
          college_id?: string;
          created_at?: string;
          due_at?: string;
          end_accuracy_m?: number | null;
          end_lat?: number | null;
          end_lng?: number | null;
          end_stand_id?: string | null;
          ended_at?: string | null;
          flags?: string[];
          force_note?: string | null;
          forced_by?: string | null;
          id?: string;
          is_demo?: boolean;
          is_overdue?: boolean;
          late?: boolean;
          overdue_at?: string | null;
          pass_id?: string | null;
          photo_check?: Database['public']['Enums']['photo_check'];
          photo_check_attempts?: number;
          photo_check_note?: string | null;
          reminder_sent_at?: string | null;
          return_photo_path?: string | null;
          rider_id?: string | null;
          start_accuracy_m?: number | null;
          start_lat?: number | null;
          start_lng?: number | null;
          start_stand_id?: string | null;
          started_at?: string;
          status?: Database['public']['Enums']['ride_status'];
        };
        Relationships: [
          {
            foreignKeyName: 'rides_bike_id_fkey';
            columns: ['bike_id'];
            isOneToOne: false;
            referencedRelation: 'admin_bikes_v';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'rides_bike_id_fkey';
            columns: ['bike_id'];
            isOneToOne: false;
            referencedRelation: 'bikes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'rides_college_id_fkey';
            columns: ['college_id'];
            isOneToOne: false;
            referencedRelation: 'colleges';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'rides_end_stand_id_fkey';
            columns: ['end_stand_id'];
            isOneToOne: false;
            referencedRelation: 'stands';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'rides_forced_by_fkey';
            columns: ['forced_by'];
            isOneToOne: false;
            referencedRelation: 'admin_users_v';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'rides_forced_by_fkey';
            columns: ['forced_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'rides_pass_id_fkey';
            columns: ['pass_id'];
            isOneToOne: false;
            referencedRelation: 'admin_bikes_v';
            referencedColumns: ['pass_id'];
          },
          {
            foreignKeyName: 'rides_pass_id_fkey';
            columns: ['pass_id'];
            isOneToOne: false;
            referencedRelation: 'admin_users_v';
            referencedColumns: ['pass_id'];
          },
          {
            foreignKeyName: 'rides_pass_id_fkey';
            columns: ['pass_id'];
            isOneToOne: false;
            referencedRelation: 'rider_passes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'rides_rider_id_fkey';
            columns: ['rider_id'];
            isOneToOne: false;
            referencedRelation: 'admin_users_v';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'rides_rider_id_fkey';
            columns: ['rider_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'rides_start_stand_id_fkey';
            columns: ['start_stand_id'];
            isOneToOne: false;
            referencedRelation: 'stands';
            referencedColumns: ['id'];
          },
        ];
      };
      stands: {
        Row: {
          active: boolean;
          capacity: number;
          college_id: string;
          created_at: string;
          id: string;
          lat: number;
          lng: number;
          location: unknown;
          name: string;
          radius_m: number;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          capacity?: number;
          college_id: string;
          created_at?: string;
          id?: string;
          lat: number;
          lng: number;
          location?: unknown;
          name: string;
          radius_m?: number;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          capacity?: number;
          college_id?: string;
          created_at?: string;
          id?: string;
          lat?: number;
          lng?: number;
          location?: unknown;
          name?: string;
          radius_m?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'stands_college_id_fkey';
            columns: ['college_id'];
            isOneToOne: false;
            referencedRelation: 'colleges';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      admin_bikes_v: {
        Row: {
          ai_flag: string | null;
          borrowed_at: string | null;
          college_id: string | null;
          created_at: string | null;
          current_stand_id: string | null;
          holder_name: string | null;
          id: string | null;
          is_demo: boolean | null;
          last_seen_at: string | null;
          last_seen_stand_id: string | null;
          last_seen_stand_name: string | null;
          maintenance_after_return: boolean | null;
          notes: string | null;
          pass_id: string | null;
          pass_label: string | null;
          short_code: string | null;
          stand_name: string | null;
          status: Database['public']['Enums']['bike_status'] | null;
        };
        Relationships: [
          {
            foreignKeyName: 'bikes_college_id_fkey';
            columns: ['college_id'];
            isOneToOne: false;
            referencedRelation: 'colleges';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'bikes_current_stand_id_fkey';
            columns: ['current_stand_id'];
            isOneToOne: false;
            referencedRelation: 'stands';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'bikes_last_seen_stand_id_fkey';
            columns: ['last_seen_stand_id'];
            isOneToOne: false;
            referencedRelation: 'stands';
            referencedColumns: ['id'];
          },
        ];
      };
      admin_issues_v: {
        Row: {
          ai_suggested_type: Database['public']['Enums']['issue_type'] | null;
          assigned_to: string | null;
          assignee_name: string | null;
          bike_code: string | null;
          bike_id: string | null;
          bike_status: Database['public']['Enums']['bike_status'] | null;
          college_id: string | null;
          created_at: string | null;
          group_id: string | null;
          id: string | null;
          is_demo: boolean | null;
          note: string | null;
          photo_path: string | null;
          reporter_id: string | null;
          reporter_name: string | null;
          resolution_note: string | null;
          resolved_at: string | null;
          ride_id: string | null;
          source: string | null;
          stand_id: string | null;
          stand_name: string | null;
          status: Database['public']['Enums']['issue_status'] | null;
          triaged_at: string | null;
          type: Database['public']['Enums']['issue_type'] | null;
          updated_at: string | null;
          urgency: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'issue_group_fk';
            columns: ['group_id'];
            isOneToOne: false;
            referencedRelation: 'ai_insights';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'issue_reports_assigned_to_fkey';
            columns: ['assigned_to'];
            isOneToOne: false;
            referencedRelation: 'admin_users_v';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'issue_reports_assigned_to_fkey';
            columns: ['assigned_to'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'issue_reports_bike_id_fkey';
            columns: ['bike_id'];
            isOneToOne: false;
            referencedRelation: 'admin_bikes_v';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'issue_reports_bike_id_fkey';
            columns: ['bike_id'];
            isOneToOne: false;
            referencedRelation: 'bikes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'issue_reports_college_id_fkey';
            columns: ['college_id'];
            isOneToOne: false;
            referencedRelation: 'colleges';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'issue_reports_reporter_id_fkey';
            columns: ['reporter_id'];
            isOneToOne: false;
            referencedRelation: 'admin_users_v';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'issue_reports_reporter_id_fkey';
            columns: ['reporter_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'issue_reports_ride_id_fkey';
            columns: ['ride_id'];
            isOneToOne: false;
            referencedRelation: 'admin_rides_v';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'issue_reports_ride_id_fkey';
            columns: ['ride_id'];
            isOneToOne: false;
            referencedRelation: 'rides';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'issue_reports_stand_id_fkey';
            columns: ['stand_id'];
            isOneToOne: false;
            referencedRelation: 'stands';
            referencedColumns: ['id'];
          },
        ];
      };
      admin_rides_v: {
        Row: {
          bike_code: string | null;
          bike_id: string | null;
          college_id: string | null;
          due_at: string | null;
          end_stand_id: string | null;
          end_stand_name: string | null;
          ended_at: string | null;
          flags: string[] | null;
          force_note: string | null;
          id: string | null;
          is_demo: boolean | null;
          is_overdue: boolean | null;
          late: boolean | null;
          minutes: number | null;
          pass_label: string | null;
          photo_check: Database['public']['Enums']['photo_check'] | null;
          photo_check_note: string | null;
          return_photo_path: string | null;
          rider_id: string | null;
          rider_name: string | null;
          start_stand_id: string | null;
          start_stand_name: string | null;
          started_at: string | null;
          status: Database['public']['Enums']['ride_status'] | null;
        };
        Relationships: [
          {
            foreignKeyName: 'rides_bike_id_fkey';
            columns: ['bike_id'];
            isOneToOne: false;
            referencedRelation: 'admin_bikes_v';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'rides_bike_id_fkey';
            columns: ['bike_id'];
            isOneToOne: false;
            referencedRelation: 'bikes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'rides_college_id_fkey';
            columns: ['college_id'];
            isOneToOne: false;
            referencedRelation: 'colleges';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'rides_end_stand_id_fkey';
            columns: ['end_stand_id'];
            isOneToOne: false;
            referencedRelation: 'stands';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'rides_rider_id_fkey';
            columns: ['rider_id'];
            isOneToOne: false;
            referencedRelation: 'admin_users_v';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'rides_rider_id_fkey';
            columns: ['rider_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'rides_start_stand_id_fkey';
            columns: ['start_stand_id'];
            isOneToOne: false;
            referencedRelation: 'stands';
            referencedColumns: ['id'];
          },
        ];
      };
      admin_users_v: {
        Row: {
          applied_at: string | null;
          approved_at: string | null;
          bike_code: string | null;
          borrowed_at: string | null;
          college_code: string | null;
          college_id: string | null;
          college_name: string | null;
          created_at: string | null;
          current_ride_id: string | null;
          demo_role: string | null;
          email: string | null;
          email_domain_match: boolean | null;
          full_name: string | null;
          id: string | null;
          id_check_consent: boolean | null;
          id_check_result: Json | null;
          id_photo_path: string | null;
          is_demo: boolean | null;
          is_owner: boolean | null;
          pass_id: string | null;
          pass_label: string | null;
          pass_number: number | null;
          pass_status: Database['public']['Enums']['pass_status'] | null;
          password_reset_requested_at: string | null;
          phone: string | null;
          rejection_reason: string | null;
          role: Database['public']['Enums']['user_role'] | null;
          roll_number: string | null;
          status: Database['public']['Enums']['profile_status'] | null;
          strikes: number | null;
          suspended_reason: string | null;
          total_minutes: number | null;
          total_rides: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'passes_current_ride_fk';
            columns: ['current_ride_id'];
            isOneToOne: true;
            referencedRelation: 'admin_rides_v';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'passes_current_ride_fk';
            columns: ['current_ride_id'];
            isOneToOne: true;
            referencedRelation: 'rides';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'profiles_college_id_fkey';
            columns: ['college_id'];
            isOneToOne: false;
            referencedRelation: 'colleges';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Functions: {
      admin_bike_qr_payloads: {
        Args: { p_bike_ids: string[] };
        Returns: {
          bike_id: string;
          payload: string;
          short_code: string;
        }[];
      };
      admin_run_demo_reset: { Args: never; Returns: undefined };
      admin_run_ride_timers: { Args: never; Returns: undefined };
      admin_scan_bike: { Args: { p_payload: string }; Returns: Json };
      admin_scan_pass: { Args: { p_payload: string }; Returns: Json };
      admin_set_app_config: {
        Args: { p_key: string; p_value: string };
        Returns: undefined;
      };
      admin_setup_demo_account: {
        Args: {
          p_college: string;
          p_kind: string;
          p_pass_number?: number;
          p_user: string;
        };
        Returns: undefined;
      };
      ai_budget_state: { Args: { p_pool: string }; Returns: Json };
      ai_digest_inputs: {
        Args: { p_college: string; p_demo: boolean };
        Returns: Json;
      };
      ai_forecast_inputs: {
        Args: { p_college: string; p_demo: boolean };
        Returns: Json;
      };
      ai_record_usage: {
        Args: {
          p_college: string;
          p_cost: number;
          p_pool: string;
          p_steps: number;
          p_tokens_in: number;
          p_tokens_out: number;
          p_user: string;
        };
        Returns: undefined;
      };
      ai_usage_summary: { Args: { p_college_id?: string }; Returns: Json };
      approve_rider: {
        Args: { p_ai_action_id?: string; p_source?: string; p_user_id: string };
        Returns: Json;
      };
      approve_riders: {
        Args: {
          p_ai_action_id?: string;
          p_source?: string;
          p_user_ids: string[];
        };
        Returns: Json;
      };
      attach_return_photo: {
        Args: { p_path: string; p_ride_id: string };
        Returns: Json;
      };
      borrow_bike: {
        Args: {
          p_accuracy?: number;
          p_code: string;
          p_demo_stand_id?: string;
          p_is_mock?: boolean;
          p_lat?: number;
          p_lng?: number;
          p_preview_only?: boolean;
          p_sig?: string;
        };
        Returns: Json;
      };
      check_return_location: {
        Args: {
          p_accuracy?: number;
          p_demo_stand_id?: string;
          p_is_mock?: boolean;
          p_lat?: number;
          p_lng?: number;
        };
        Returns: Json;
      };
      clear_bike_flag: { Args: { p_bike_id: string }; Returns: Json };
      clear_my_ai_memory: { Args: never; Returns: Json };
      colleges_overview: {
        Args: never;
        Returns: {
          active: boolean;
          admins: number;
          bikes: number;
          id: string;
          name: string;
          pending: number;
          riders: number;
          rides_7d: number;
          short_code: string;
          stands: number;
        }[];
      };
      create_bikes: {
        Args: {
          p_college_id: string;
          p_count?: number;
          p_notes?: string;
          p_stand_id: string;
        };
        Returns: Json;
      };
      create_college: {
        Args: {
          p_bike_prefix: string;
          p_center_lat: number;
          p_center_lng: number;
          p_email_domains: string[];
          p_name: string;
          p_short_code: string;
          p_time_zone: string;
        };
        Returns: Json;
      };
      dashboard_stats: { Args: { p_college_id: string }; Returns: Json };
      demo_qr_samples: {
        Args: never;
        Returns: {
          code: string;
          payload: string;
          stand_name: string;
        }[];
      };
      force_return: {
        Args: {
          p_add_strike?: boolean;
          p_ai_action_id?: string;
          p_note: string;
          p_ride_id: string;
          p_source?: string;
          p_stand_id: string;
        };
        Returns: Json;
      };
      get_my_context: { Args: never; Returns: Json };
      get_my_pass_qr: { Args: never; Returns: Json };
      get_pass_stats: { Args: never; Returns: Json };
      get_stand_detail: { Args: { p_stand_id: string }; Returns: Json };
      get_stands_with_counts: {
        Args: { p_college_id?: string; p_lat?: number; p_lng?: number };
        Returns: {
          active: boolean;
          capacity: number;
          distance_m: number;
          free_bikes: number;
          id: string;
          lat: number;
          lng: number;
          maintenance_bikes: number;
          name: string;
          radius_m: number;
          total_bikes: number;
        }[];
      };
      health: { Args: never; Returns: Json };
      list_colleges_public: {
        Args: never;
        Returns: {
          email_domains: string[];
          id: string;
          name: string;
          short_code: string;
        }[];
      };
      list_pickable_bikes: {
        Args: never;
        Returns: {
          bike_id: string;
          code: string;
          payload: string;
          stand_id: string;
          stand_name: string;
        }[];
      };
      mark_bike_missing: {
        Args: { p_add_strike?: boolean; p_bike_id: string; p_note: string };
        Returns: Json;
      };
      mark_notifications_read: {
        Args: { p_ids?: string[] };
        Returns: undefined;
      };
      mark_pass_minted_seen: { Args: never; Returns: undefined };
      match_ai_knowledge: {
        Args: { p_college: string; p_count?: number; p_embedding: string };
        Returns: {
          content: string;
          id: string;
          similarity: number;
          source: string;
        }[];
      };
      match_ai_memories: {
        Args: {
          p_count?: number;
          p_embedding: string;
          p_min_similarity?: number;
          p_user: string;
        };
        Returns: {
          content: string;
          id: string;
          similarity: number;
        }[];
      };
      move_bike: {
        Args: {
          p_ai_action_id?: string;
          p_bike_id: string;
          p_source?: string;
          p_stand_id: string;
        };
        Returns: Json;
      };
      move_bikes: {
        Args: { p_ai_action_id?: string; p_moves: Json; p_source?: string };
        Returns: Json;
      };
      pass_label_of: {
        Args: { p_number: number; p_short_code: string };
        Returns: string;
      };
      preview_bike: {
        Args: {
          p_accuracy?: number;
          p_code: string;
          p_demo_stand_id?: string;
          p_is_mock?: boolean;
          p_lat?: number;
          p_lng?: number;
          p_sig?: string;
        };
        Returns: Json;
      };
      reinstate_rider: { Args: { p_user_id: string }; Returns: Json };
      reject_rider: {
        Args: {
          p_ai_action_id?: string;
          p_reason: string;
          p_source?: string;
          p_user_id: string;
        };
        Returns: Json;
      };
      report_issue: {
        Args: {
          p_ai_suggested_type?: Database['public']['Enums']['issue_type'];
          p_bike_code?: string;
          p_note?: string;
          p_photo_path?: string;
          p_ride_id?: string;
          p_source?: string;
          p_stand_id?: string;
          p_type: Database['public']['Enums']['issue_type'];
        };
        Returns: Json;
      };
      request_password_reset: { Args: { p_email: string }; Returns: Json };
      request_ride_close: {
        Args: { p_note: string; p_source?: string };
        Returns: Json;
      };
      reset_strikes: { Args: { p_user_id: string }; Returns: Json };
      retire_bike: { Args: { p_bike_id: string }; Returns: Json };
      return_bike: {
        Args: {
          p_accuracy?: number;
          p_code: string;
          p_demo_stand_id?: string;
          p_is_mock?: boolean;
          p_lat?: number;
          p_lng?: number;
          p_photo_path?: string;
          p_sig?: string;
        };
        Returns: Json;
      };
      rides_per_day: {
        Args: { p_college_id: string; p_days?: number };
        Returns: {
          day: string;
          rides: number;
        }[];
      };
      set_bike_maintenance: {
        Args: {
          p_ai_action_id?: string;
          p_bike_id: string;
          p_note?: string;
          p_on: boolean;
          p_source?: string;
        };
        Returns: Json;
      };
      set_college_active: {
        Args: { p_active: boolean; p_college_id: string };
        Returns: Json;
      };
      set_id_photo: {
        Args: { p_consent: boolean; p_path: string };
        Returns: Json;
      };
      set_insight_status: {
        Args: {
          p_id: string;
          p_status: Database['public']['Enums']['ai_insight_status'];
        };
        Returns: Json;
      };
      set_user_role: {
        Args: {
          p_college_id?: string;
          p_role: Database['public']['Enums']['user_role'];
          p_user_id: string;
        };
        Returns: Json;
      };
      stand_check_submit: {
        Args: { p_codes: string[]; p_stand_id: string };
        Returns: Json;
      };
      suspend_rider: {
        Args: {
          p_ai_action_id?: string;
          p_reason: string;
          p_source?: string;
          p_user_id: string;
        };
        Returns: Json;
      };
      update_ai_settings: {
        Args: {
          p_college_id: string;
          p_daily_steps?: Json;
          p_features?: Json;
          p_free_only?: boolean;
          p_model_routes?: Json;
          p_monthly_cap_usd?: number;
        };
        Returns: Json;
      };
      update_application: {
        Args: {
          p_college_id: string;
          p_full_name: string;
          p_phone: string;
          p_roll_number: string;
        };
        Returns: Json;
      };
      update_bike_notes: {
        Args: { p_bike_id: string; p_notes: string };
        Returns: Json;
      };
      update_college_settings: {
        Args: {
          p_center_lat?: number;
          p_center_lng?: number;
          p_college_id: string;
          p_default_geofence_m: number;
          p_email_domains: string[];
          p_max_ride_minutes: number;
          p_name: string;
          p_rules_text: string;
          p_strike_limit: number;
        };
        Returns: Json;
      };
      update_issue: {
        Args: {
          p_ai_action_id?: string;
          p_assign_to_me?: boolean;
          p_bike_maintenance?: boolean;
          p_issue_id: string;
          p_note?: string;
          p_source?: string;
          p_status?: Database['public']['Enums']['issue_status'];
        };
        Returns: Json;
      };
      upsert_stand: {
        Args: {
          p_active?: boolean;
          p_capacity?: number;
          p_college_id: string;
          p_id: string;
          p_lat: number;
          p_lng: number;
          p_name: string;
          p_radius_m?: number;
        };
        Returns: Json;
      };
    };
    Enums: {
      ai_action_status: 'proposed' | 'confirmed' | 'done' | 'cancelled' | 'expired' | 'failed';
      ai_agent: 'orchestrator' | 'ride' | 'inspector' | 'ops' | 'triage';
      ai_insight_kind: 'digest' | 'forecast' | 'rebalancing' | 'issue_group';
      ai_insight_status: 'active' | 'accepted' | 'dismissed' | 'expired';
      ai_run_status: 'running' | 'done' | 'failed' | 'stopped_by_guardrail' | 'over_budget';
      ai_step_kind: 'context' | 'model_call' | 'tool_call' | 'guardrail' | 'router_fallback';
      ai_trigger:
        | 'chat'
        | 'console'
        | 'photo_check'
        | 'id_check'
        | 'issue_suggest'
        | 'issue_triage'
        | 'morning'
        | 'eval';
      bike_status: 'available' | 'borrowed' | 'maintenance' | 'missing' | 'retired';
      issue_status: 'open' | 'in_progress' | 'resolved';
      issue_type:
        | 'flat_tyre'
        | 'brakes'
        | 'chain'
        | 'damaged_qr'
        | 'bike_missing'
        | 'accident'
        | 'ride_close_request'
        | 'other';
      notification_kind:
        | 'approval'
        | 'rejection'
        | 'ride_reminder'
        | 'ride_overdue'
        | 'ride_closed'
        | 'strike'
        | 'suspension'
        | 'reinstated'
        | 'issue_update'
        | 'password_reset'
        | 'admin_alert'
        | 'torq';
      pass_status: 'pending' | 'ready' | 'riding' | 'overdue' | 'suspended';
      photo_check: 'pending' | 'ok' | 'unclear' | 'failed' | 'skipped';
      profile_status: 'pending' | 'approved' | 'rejected' | 'suspended';
      ride_status: 'active' | 'returned' | 'force_returned';
      user_role: 'rider' | 'college_admin' | 'super_admin';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    keyof (DefaultSchema['Tables'] & DefaultSchema['Views']) | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      ai_action_status: ['proposed', 'confirmed', 'done', 'cancelled', 'expired', 'failed'],
      ai_agent: ['orchestrator', 'ride', 'inspector', 'ops', 'triage'],
      ai_insight_kind: ['digest', 'forecast', 'rebalancing', 'issue_group'],
      ai_insight_status: ['active', 'accepted', 'dismissed', 'expired'],
      ai_run_status: ['running', 'done', 'failed', 'stopped_by_guardrail', 'over_budget'],
      ai_step_kind: ['context', 'model_call', 'tool_call', 'guardrail', 'router_fallback'],
      ai_trigger: [
        'chat',
        'console',
        'photo_check',
        'id_check',
        'issue_suggest',
        'issue_triage',
        'morning',
        'eval',
      ],
      bike_status: ['available', 'borrowed', 'maintenance', 'missing', 'retired'],
      issue_status: ['open', 'in_progress', 'resolved'],
      issue_type: [
        'flat_tyre',
        'brakes',
        'chain',
        'damaged_qr',
        'bike_missing',
        'accident',
        'ride_close_request',
        'other',
      ],
      notification_kind: [
        'approval',
        'rejection',
        'ride_reminder',
        'ride_overdue',
        'ride_closed',
        'strike',
        'suspension',
        'reinstated',
        'issue_update',
        'password_reset',
        'admin_alert',
        'torq',
      ],
      pass_status: ['pending', 'ready', 'riding', 'overdue', 'suspended'],
      photo_check: ['pending', 'ok', 'unclear', 'failed', 'skipped'],
      profile_status: ['pending', 'approved', 'rejected', 'suspended'],
      ride_status: ['active', 'returned', 'force_returned'],
      user_role: ['rider', 'college_admin', 'super_admin'],
    },
  },
} as const;
