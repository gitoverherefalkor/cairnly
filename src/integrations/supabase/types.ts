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
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      aa_dead_letter_log: {
        Row: {
          created_at: string
          error_message: string
          failed_node: string
          id: string
          timestamp: string
          workflow_name: string
        }
        Insert: {
          created_at?: string
          error_message: string
          failed_node: string
          id?: string
          timestamp: string
          workflow_name: string
        }
        Update: {
          created_at?: string
          error_message?: string
          failed_node?: string
          id?: string
          timestamp?: string
          workflow_name?: string
        }
        Relationships: []
      }
      access_codes: {
        Row: {
          bypass_payment: boolean | null
          code: string
          created_at: string
          currency: string | null
          discount_percent: number | null
          expires_at: string | null
          id: string
          is_active: boolean | null
          is_used: boolean | null
          max_usage: number | null
          price_paid: number | null
          survey_type: string | null
          usage_count: number | null
          used_at: string | null
          user_id: string | null
        }
        Insert: {
          bypass_payment?: boolean | null
          code: string
          created_at?: string
          currency?: string | null
          discount_percent?: number | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          is_used?: boolean | null
          max_usage?: number | null
          price_paid?: number | null
          survey_type?: string | null
          usage_count?: number | null
          used_at?: string | null
          user_id?: string | null
        }
        Update: {
          bypass_payment?: boolean | null
          code?: string
          created_at?: string
          currency?: string | null
          discount_percent?: number | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          is_used?: boolean | null
          max_usage?: number | null
          price_paid?: number | null
          survey_type?: string | null
          usage_count?: number | null
          used_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      ai_research: {
        Row: {
          authors: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          key_findings: string
          published_date: string | null
          source_name: string
          updated_at: string | null
          version: string | null
        }
        Insert: {
          authors?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          key_findings: string
          published_date?: string | null
          source_name: string
          updated_at?: string | null
          version?: string | null
        }
        Update: {
          authors?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          key_findings?: string
          published_date?: string | null
          source_name?: string
          updated_at?: string | null
          version?: string | null
        }
        Relationships: []
      }
      answers: {
        Row: {
          access_code_id: string | null
          id: string
          payload: Json
          status: string
          submitted_at: string | null
          survey_id: string | null
        }
        Insert: {
          access_code_id?: string | null
          id?: string
          payload: Json
          status?: string
          submitted_at?: string | null
          survey_id?: string | null
        }
        Update: {
          access_code_id?: string | null
          id?: string
          payload?: Json
          status?: string
          submitted_at?: string | null
          survey_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "answers_access_code_id_fkey"
            columns: ["access_code_id"]
            isOneToOne: true
            referencedRelation: "access_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "answers_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "surveys"
            referencedColumns: ["id"]
          },
        ]
      }
      api_error_logs: {
        Row: {
          created_at: string | null
          error_message: string | null
          error_type: string | null
          execution_id: string | null
          failed_node: string | null
          id: string
          response_code: string | null
          severity: string | null
          timestamp: string | null
          workflow_id: string | null
          workflow_name: string | null
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          error_type?: string | null
          execution_id?: string | null
          failed_node?: string | null
          id?: string
          response_code?: string | null
          severity?: string | null
          timestamp?: string | null
          workflow_id?: string | null
          workflow_name?: string | null
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          error_type?: string | null
          execution_id?: string | null
          failed_node?: string | null
          id?: string
          response_code?: string | null
          severity?: string | null
          timestamp?: string | null
          workflow_id?: string | null
          workflow_name?: string | null
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          report_id: string
          sender: string
          session_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          report_id: string
          sender: string
          session_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          report_id?: string
          sender?: string
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_resumes: {
        Row: {
          ats_score: number | null
          career_section_id: string | null
          career_title: string
          cover_letter_json: Json | null
          created_at: string
          error_message: string | null
          id: string
          keyword_coverage: Json | null
          report_id: string
          resume_json: Json
          status: string
          template_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ats_score?: number | null
          career_section_id?: string | null
          career_title: string
          cover_letter_json?: Json | null
          created_at?: string
          error_message?: string | null
          id?: string
          keyword_coverage?: Json | null
          report_id: string
          resume_json: Json
          status?: string
          template_id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ats_score?: number | null
          career_section_id?: string | null
          career_title?: string
          cover_letter_json?: Json | null
          created_at?: string
          error_message?: string | null
          id?: string
          keyword_coverage?: Json | null
          report_id?: string
          resume_json?: Json
          status?: string
          template_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "custom_resumes_career_section_id_fkey"
            columns: ["career_section_id"]
            isOneToOne: false
            referencedRelation: "report_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custom_resumes_career_section_id_fkey"
            columns: ["career_section_id"]
            isOneToOne: false
            referencedRelation: "report_sections_with_user"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custom_resumes_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      enriched_jobs: {
        Row: {
          ai_impact_rating: string | null
          alternate_titles: Json
          autonomy_vs_collaboration: string | null
          career_progression: string[] | null
          career_title: string
          certifications_requirements: string | null
          client_interaction: string | null
          colleague_interaction: string | null
          company_size_type: string | null
          core_values: string[] | null
          created_at: string | null
          education_requirements: string | null
          id: number
          leadership_challenges: string[] | null
          motivational_factors: string[] | null
          overview: string | null
          pace_of_work: string | null
          path_type: string | null
          path_type_notes: string | null
          personality_traits: string | null
          report_id: string | null
          salary: Json | null
          soft_skills: string[] | null
          technical_skills: string[] | null
          typical_tasks: string[] | null
          updated_at: string | null
          work_schedule: string | null
        }
        Insert: {
          ai_impact_rating?: string | null
          alternate_titles?: Json
          autonomy_vs_collaboration?: string | null
          career_progression?: string[] | null
          career_title: string
          certifications_requirements?: string | null
          client_interaction?: string | null
          colleague_interaction?: string | null
          company_size_type?: string | null
          core_values?: string[] | null
          created_at?: string | null
          education_requirements?: string | null
          id?: number
          leadership_challenges?: string[] | null
          motivational_factors?: string[] | null
          overview?: string | null
          pace_of_work?: string | null
          path_type?: string | null
          path_type_notes?: string | null
          personality_traits?: string | null
          report_id?: string | null
          salary?: Json | null
          soft_skills?: string[] | null
          technical_skills?: string[] | null
          typical_tasks?: string[] | null
          updated_at?: string | null
          work_schedule?: string | null
        }
        Update: {
          ai_impact_rating?: string | null
          alternate_titles?: Json
          autonomy_vs_collaboration?: string | null
          career_progression?: string[] | null
          career_title?: string
          certifications_requirements?: string | null
          client_interaction?: string | null
          colleague_interaction?: string | null
          company_size_type?: string | null
          core_values?: string[] | null
          created_at?: string | null
          education_requirements?: string | null
          id?: number
          leadership_challenges?: string[] | null
          motivational_factors?: string[] | null
          overview?: string | null
          pace_of_work?: string | null
          path_type?: string | null
          path_type_notes?: string | null
          personality_traits?: string | null
          report_id?: string | null
          salary?: Json | null
          soft_skills?: string[] | null
          technical_skills?: string[] | null
          typical_tasks?: string[] | null
          updated_at?: string | null
          work_schedule?: string | null
        }
        Relationships: []
      }
      error_logs: {
        Row: {
          created_at: string | null
          error_message: string | null
          error_type: string | null
          execution_id: string | null
          failed_node: string | null
          id: string
          severity: string | null
          stack_trace: string | null
          timestamp: string | null
          workflow_id: string | null
          workflow_name: string | null
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          error_type?: string | null
          execution_id?: string | null
          failed_node?: string | null
          id?: string
          severity?: string | null
          stack_trace?: string | null
          timestamp?: string | null
          workflow_id?: string | null
          workflow_name?: string | null
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          error_type?: string | null
          execution_id?: string | null
          failed_node?: string | null
          id?: string
          severity?: string | null
          stack_trace?: string | null
          timestamp?: string | null
          workflow_id?: string | null
          workflow_name?: string | null
        }
        Relationships: []
      }
      job_search_cache: {
        Row: {
          api_source: string
          country_code: string
          created_at: string | null
          expires_at: string
          fetched_at: string
          id: string
          location: string | null
          result_count: number
          results: Json
          search_query: string
        }
        Insert: {
          api_source?: string
          country_code: string
          created_at?: string | null
          expires_at: string
          fetched_at?: string
          id?: string
          location?: string | null
          result_count?: number
          results?: Json
          search_query: string
        }
        Update: {
          api_source?: string
          country_code?: string
          created_at?: string | null
          expires_at?: string
          fetched_at?: string
          id?: string
          location?: string | null
          result_count?: number
          results?: Json
          search_query?: string
        }
        Relationships: []
      }
      n8n_chat_histories: {
        Row: {
          created_at: string | null
          id: number
          message: Json
          session_id: string
        }
        Insert: {
          created_at?: string | null
          id?: number
          message: Json
          session_id: string
        }
        Update: {
          created_at?: string | null
          id?: number
          message?: Json
          session_id?: string
        }
        Relationships: []
      }
      newsletter_subscribers: {
        Row: {
          confirmation_token: string
          confirmed_at: string | null
          created_at: string
          email: string
          id: string
          source: string | null
          status: string
          unsubscribe_token: string
          unsubscribed_at: string | null
        }
        Insert: {
          confirmation_token?: string
          confirmed_at?: string | null
          created_at?: string
          email: string
          id?: string
          source?: string | null
          status?: string
          unsubscribe_token?: string
          unsubscribed_at?: string | null
        }
        Update: {
          confirmation_token?: string
          confirmed_at?: string | null
          created_at?: string
          email?: string
          id?: string
          source?: string | null
          status?: string
          unsubscribe_token?: string
          unsubscribed_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          age_range: string | null
          auth_provider: string | null
          country: string | null
          created_at: string
          email: string
          email_reminders_enabled: boolean | null
          first_name: string | null
          id: string
          last_name: string | null
          privacy_consent_at: string | null
          pronouns: string | null
          referral_code: string | null
          region: string | null
          resume_data: Json | null
          resume_full_data: Json | null
          resume_full_data_extracted_at: string | null
          resume_parsed_data: Json | null
          resume_uploaded_at: string | null
          stripe_promotion_code_id: string | null
          terms_consent_at: string | null
          updated_at: string
        }
        Insert: {
          age_range?: string | null
          auth_provider?: string | null
          country?: string | null
          created_at?: string
          email: string
          email_reminders_enabled?: boolean | null
          first_name?: string | null
          id: string
          last_name?: string | null
          privacy_consent_at?: string | null
          pronouns?: string | null
          referral_code?: string | null
          region?: string | null
          resume_data?: Json | null
          resume_full_data?: Json | null
          resume_full_data_extracted_at?: string | null
          resume_parsed_data?: Json | null
          resume_uploaded_at?: string | null
          stripe_promotion_code_id?: string | null
          terms_consent_at?: string | null
          updated_at?: string
        }
        Update: {
          age_range?: string | null
          auth_provider?: string | null
          country?: string | null
          created_at?: string
          email?: string
          email_reminders_enabled?: boolean | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          privacy_consent_at?: string | null
          pronouns?: string | null
          referral_code?: string | null
          region?: string | null
          resume_data?: Json | null
          resume_full_data?: Json | null
          resume_full_data_extracted_at?: string | null
          resume_parsed_data?: Json | null
          resume_uploaded_at?: string | null
          stripe_promotion_code_id?: string | null
          terms_consent_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      purchases: {
        Row: {
          access_code_id: string | null
          country: string
          created_at: string
          email: string
          first_name: string
          id: string
          last_name: string
          stripe_session_id: string | null
        }
        Insert: {
          access_code_id?: string | null
          country: string
          created_at?: string
          email: string
          first_name: string
          id?: string
          last_name: string
          stripe_session_id?: string | null
        }
        Update: {
          access_code_id?: string | null
          country?: string
          created_at?: string
          email?: string
          first_name?: string
          id?: string
          last_name?: string
          stripe_session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchases_access_code_id_fkey"
            columns: ["access_code_id"]
            isOneToOne: false
            referencedRelation: "access_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      questions: {
        Row: {
          allow_multiple: boolean | null
          allow_other: boolean | null
          config: Json | null
          created_at: string | null
          id: string
          label: string
          max_selections: number | null
          min_selections: number | null
          order_num: number | null
          required: boolean | null
          section_id: string | null
          type: string
        }
        Insert: {
          allow_multiple?: boolean | null
          allow_other?: boolean | null
          config?: Json | null
          created_at?: string | null
          id?: string
          label: string
          max_selections?: number | null
          min_selections?: number | null
          order_num?: number | null
          required?: boolean | null
          section_id?: string | null
          type: string
        }
        Update: {
          allow_multiple?: boolean | null
          allow_other?: boolean | null
          config?: Json | null
          created_at?: string | null
          id?: string
          label?: string
          max_selections?: number | null
          min_selections?: number | null
          order_num?: number | null
          required?: boolean | null
          section_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "questions_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "survey_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      referrals: {
        Row: {
          amount_paid: number | null
          created_at: string
          currency: string | null
          id: string
          invitee_email: string | null
          invitee_user_id: string | null
          promotion_code_used: string | null
          referrer_user_id: string
          stripe_session_id: string
        }
        Insert: {
          amount_paid?: number | null
          created_at?: string
          currency?: string | null
          id?: string
          invitee_email?: string | null
          invitee_user_id?: string | null
          promotion_code_used?: string | null
          referrer_user_id: string
          stripe_session_id: string
        }
        Update: {
          amount_paid?: number | null
          created_at?: string
          currency?: string | null
          id?: string
          invitee_email?: string | null
          invitee_user_id?: string | null
          promotion_code_used?: string | null
          referrer_user_id?: string
          stripe_session_id?: string
        }
        Relationships: []
      }
      report_sections: {
        Row: {
          alternate_titles: string | null
          company_size_type: string | null
          content: string
          created_at: string
          explore: string | null
          fb_status: boolean | null
          feedback: string | null
          feedback_category: number | null
          id: string
          metadata: Json | null
          order_number: number | null
          report_id: string
          score: number | null
          section_type: string
          title: string | null
          updated_at: string
        }
        Insert: {
          alternate_titles?: string | null
          company_size_type?: string | null
          content: string
          created_at?: string
          explore?: string | null
          fb_status?: boolean | null
          feedback?: string | null
          feedback_category?: number | null
          id?: string
          metadata?: Json | null
          order_number?: number | null
          report_id: string
          score?: number | null
          section_type: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          alternate_titles?: string | null
          company_size_type?: string | null
          content?: string
          created_at?: string
          explore?: string | null
          fb_status?: boolean | null
          feedback?: string | null
          feedback_category?: number | null
          id?: string
          metadata?: Json | null
          order_number?: number | null
          report_id?: string
          score?: number | null
          section_type?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_report_sections_report_id"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_sections_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          access_code_id: string | null
          created_at: string
          id: string
          payload: Json
          status: string
          survey_id: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_code_id?: string | null
          created_at?: string
          id?: string
          payload: Json
          status?: string
          survey_id?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_code_id?: string | null
          created_at?: string
          id?: string
          payload?: Json
          status?: string
          survey_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_reports_access_code_id"
            columns: ["access_code_id"]
            isOneToOne: false
            referencedRelation: "access_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_reports_survey_id"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "surveys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_access_code_id_fkey"
            columns: ["access_code_id"]
            isOneToOne: false
            referencedRelation: "access_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "surveys"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_chat_responses: {
        Row: {
          content: string
          content_hash: string | null
          created_at: string
          id: string
          label: string | null
          report_id: string
          section_type: string | null
          user_id: string
        }
        Insert: {
          content: string
          content_hash?: string | null
          created_at?: string
          id?: string
          label?: string | null
          report_id: string
          section_type?: string | null
          user_id: string
        }
        Update: {
          content?: string
          content_hash?: string | null
          created_at?: string
          id?: string
          label?: string | null
          report_id?: string
          section_type?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_chat_responses_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_jobs: {
        Row: {
          apply_url: string | null
          company_name: string | null
          description_snippet: string | null
          external_job_id: string
          id: string
          job_search_id: string | null
          job_title: string
          location: string | null
          posted_date: string | null
          salary_max: number | null
          salary_min: number | null
          saved_at: string | null
          source: string
          user_id: string
        }
        Insert: {
          apply_url?: string | null
          company_name?: string | null
          description_snippet?: string | null
          external_job_id: string
          id?: string
          job_search_id?: string | null
          job_title: string
          location?: string | null
          posted_date?: string | null
          salary_max?: number | null
          salary_min?: number | null
          saved_at?: string | null
          source?: string
          user_id: string
        }
        Update: {
          apply_url?: string | null
          company_name?: string | null
          description_snippet?: string | null
          external_job_id?: string
          id?: string
          job_search_id?: string | null
          job_title?: string
          location?: string | null
          posted_date?: string | null
          salary_max?: number | null
          salary_min?: number | null
          saved_at?: string | null
          source?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_jobs_job_search_id_fkey"
            columns: ["job_search_id"]
            isOneToOne: false
            referencedRelation: "user_job_searches"
            referencedColumns: ["id"]
          },
        ]
      }
      support_requests: {
        Row: {
          access_code: string | null
          category: string
          created_at: string
          email: string
          id: string
          message: string
          page: string | null
          status: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          access_code?: string | null
          category: string
          created_at?: string
          email: string
          id?: string
          message: string
          page?: string | null
          status?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          access_code?: string | null
          category?: string
          created_at?: string
          email?: string
          id?: string
          message?: string
          page?: string | null
          status?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      survey_sections: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          order_num: number | null
          survey_id: string | null
          title: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          order_num?: number | null
          survey_id?: string | null
          title?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          order_num?: number | null
          survey_id?: string | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sections_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "surveys"
            referencedColumns: ["id"]
          },
        ]
      }
      surveys: {
        Row: {
          created_at: string | null
          id: string
          title: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          title: string
        }
        Update: {
          created_at?: string | null
          id?: string
          title?: string
        }
        Relationships: []
      }
      user_engagement_tracking: {
        Row: {
          chat_completed_at: string | null
          chat_last_activity_at: string | null
          chat_last_section_index: number | null
          chat_reminder_sent_at: string | null
          chat_started_at: string | null
          created_at: string | null
          dashboard_visited_after_chat_at: string | null
          report_reminder_sent_at: string | null
          signup_reminder_sent_at: string | null
          survey_completed_at: string | null
          survey_last_activity_at: string | null
          survey_last_section: number | null
          survey_reminder_sent_at: string | null
          survey_started_at: string | null
          survey_total_sections: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          chat_completed_at?: string | null
          chat_last_activity_at?: string | null
          chat_last_section_index?: number | null
          chat_reminder_sent_at?: string | null
          chat_started_at?: string | null
          created_at?: string | null
          dashboard_visited_after_chat_at?: string | null
          report_reminder_sent_at?: string | null
          signup_reminder_sent_at?: string | null
          survey_completed_at?: string | null
          survey_last_activity_at?: string | null
          survey_last_section?: number | null
          survey_reminder_sent_at?: string | null
          survey_started_at?: string | null
          survey_total_sections?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          chat_completed_at?: string | null
          chat_last_activity_at?: string | null
          chat_last_section_index?: number | null
          chat_reminder_sent_at?: string | null
          chat_started_at?: string | null
          created_at?: string | null
          dashboard_visited_after_chat_at?: string | null
          report_reminder_sent_at?: string | null
          signup_reminder_sent_at?: string | null
          survey_completed_at?: string | null
          survey_last_activity_at?: string | null
          survey_last_section?: number | null
          survey_reminder_sent_at?: string | null
          survey_started_at?: string | null
          survey_total_sections?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_job_searches: {
        Row: {
          career_title: string
          country_code: string
          created_at: string | null
          id: string
          location: string | null
          report_id: string
          search_status: string
          section_type: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          career_title: string
          country_code: string
          created_at?: string | null
          id?: string
          location?: string | null
          report_id: string
          search_status?: string
          section_type: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          career_title?: string
          country_code?: string
          created_at?: string | null
          id?: string
          location?: string | null
          report_id?: string
          search_status?: string
          section_type?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_job_searches_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      report_sections_with_user: {
        Row: {
          alternate_titles: string | null
          company_size_type: string | null
          content: string | null
          created_at: string | null
          explore: string | null
          fb_status: boolean | null
          feedback: string | null
          feedback_category: number | null
          full_name: string | null
          id: string | null
          order_number: number | null
          report_id: string | null
          report_status: string | null
          score: number | null
          section_type: string | null
          title: string | null
          updated_at: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_report_sections_report_id"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_sections_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      check_and_send_reminders: { Args: never; Returns: undefined }
      cleanup_old_chat_histories: { Args: never; Returns: undefined }
      consume_access_code: {
        Args: { p_code_id: string }
        Returns: {
          code: string
          id: string
          max_usage: number
          usage_count: number
          used_at: string
          user_id: string
        }[]
      }
      dmetaphone: { Args: { "": string }; Returns: string }
      dmetaphone_alt: { Args: { "": string }; Returns: string }
      enriched_careers: {
        Args: { input_careers_text: string }
        Returns: {
          career_data: Json
        }[]
      }
      enriched_careers_debug: {
        Args: { input_careers_text: string }
        Returns: {
          db_company: string
          db_title: string
          exact_match: boolean
          input_company: string
          input_title: string
        }[]
      }
      enriched_careers_debug2: {
        Args: { input_careers_text: string }
        Returns: {
          input_company: string
          input_order: number
          input_title: string
          match_company: string
          match_title: string
          similarity_score: number
        }[]
      }
      find_career_matches:
        | {
            Args: { alt_titles: string[]; job_title: string }
            Returns: {
              ai_impact_rating: string | null
              alternate_titles: Json
              autonomy_vs_collaboration: string | null
              career_progression: string[] | null
              career_title: string
              certifications_requirements: string | null
              client_interaction: string | null
              colleague_interaction: string | null
              company_size_type: string | null
              core_values: string[] | null
              created_at: string | null
              education_requirements: string | null
              id: number
              leadership_challenges: string[] | null
              motivational_factors: string[] | null
              overview: string | null
              pace_of_work: string | null
              path_type: string | null
              path_type_notes: string | null
              personality_traits: string | null
              report_id: string | null
              salary: Json | null
              soft_skills: string[] | null
              technical_skills: string[] | null
              typical_tasks: string[] | null
              updated_at: string | null
              work_schedule: string | null
            }[]
            SetofOptions: {
              from: "*"
              to: "enriched_jobs"
              isOneToOne: false
              isSetofReturn: true
            }
          }
        | {
            Args: { p_career_title: string }
            Returns: {
              ai_impact_rating: string | null
              alternate_titles: Json
              autonomy_vs_collaboration: string | null
              career_progression: string[] | null
              career_title: string
              certifications_requirements: string | null
              client_interaction: string | null
              colleague_interaction: string | null
              company_size_type: string | null
              core_values: string[] | null
              created_at: string | null
              education_requirements: string | null
              id: number
              leadership_challenges: string[] | null
              motivational_factors: string[] | null
              overview: string | null
              pace_of_work: string | null
              path_type: string | null
              path_type_notes: string | null
              personality_traits: string | null
              report_id: string | null
              salary: Json | null
              soft_skills: string[] | null
              technical_skills: string[] | null
              typical_tasks: string[] | null
              updated_at: string | null
              work_schedule: string | null
            }[]
            SetofOptions: {
              from: "*"
              to: "enriched_jobs"
              isOneToOne: false
              isSetofReturn: true
            }
          }
        | {
            Args: { p_career_title: string; p_company_size_type: string }
            Returns: {
              career_title: string
              company_size_type: string
            }[]
          }
      find_career_non_matches:
        | {
            Args: { job_title: string }
            Returns: {
              career_title: string
              found: boolean
            }[]
          }
        | {
            Args: {
              ai_impact_rating: Json
              company_size_type: string
              job_title: string
              salary: Json
            }
            Returns: {
              ai_impact_rating: Json
              career_title: string
              company_size_type: string
              salary: Json
            }[]
          }
      match_documents: {
        Args: { filter?: Json; match_count?: number; query_embedding: string }
        Returns: {
          content: string
          id: string
          metadata: Json
          similarity: number
        }[]
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      soundex: { Args: { "": string }; Returns: string }
      text_soundex: { Args: { "": string }; Returns: string }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
