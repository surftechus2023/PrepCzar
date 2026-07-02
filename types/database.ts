export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          full_name: string;
          preferred_language: 'en' | 'es' | 'fr';
          role: 'student' | 'admin';
          created_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string;
          preferred_language?: 'en' | 'es' | 'fr';
          role?: 'student' | 'admin';
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string;
          preferred_language?: 'en' | 'es' | 'fr';
          role?: 'student' | 'admin';
        };
      };
      exam_categories: {
        Row: {
          id: string;
          name: string;
          slug: string;
          description: string;
          icon: string;
          display_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          description?: string;
          icon?: string;
          display_order?: number;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          description?: string;
          icon?: string;
          display_order?: number;
        };
      };
      exam_tracks: {
        Row: {
          id: string;
          category_id: string;
          name: string;
          slug: string;
          monthly_price: number;
          description: string;
          full_name: string;
          active: boolean;
          display_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          category_id: string;
          name: string;
          slug: string;
          monthly_price: number;
          description?: string;
          full_name?: string;
          active?: boolean;
          display_order?: number;
        };
        Update: {
          id?: string;
          category_id?: string;
          name?: string;
          slug?: string;
          monthly_price?: number;
          description?: string;
          full_name?: string;
          active?: boolean;
          display_order?: number;
        };
      };
      exams: {
        Row: {
          id: string;
          name: string;
          slug: string;
          monthly_price: number;
          description: string;
          active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          monthly_price: number;
          description?: string;
          active?: boolean;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          monthly_price?: number;
          description?: string;
          active?: boolean;
        };
      };
      topics: {
        Row: {
          id: string;
          exam_id: string | null;
          exam_track_id: string | null;
          title: string;
          description: string;
          display_order: number;
          official_weight_percent: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          exam_id?: string | null;
          exam_track_id?: string | null;
          title: string;
          description?: string;
          display_order?: number;
          official_weight_percent?: number | null;
        };
        Update: {
          id?: string;
          exam_id?: string | null;
          exam_track_id?: string | null;
          title?: string;
          description?: string;
          display_order?: number;
          official_weight_percent?: number | null;
        };
      };
      questions: {
        Row: {
          id: string;
          exam_id: string | null;
          exam_track_id: string | null;
          topic_id: string | null;
          difficulty: 'easy' | 'medium' | 'hard';
          question_en: string;
          question_es: string;
          question_fr: string;
          option_a_en: string;
          option_a_es: string;
          option_a_fr: string;
          option_b_en: string;
          option_b_es: string;
          option_b_fr: string;
          option_c_en: string;
          option_c_es: string;
          option_c_fr: string;
          option_d_en: string;
          option_d_es: string;
          option_d_fr: string;
          correct_option: 'a' | 'b' | 'c' | 'd';
          rationale_en: string;
          rationale_es: string;
          rationale_fr: string;
          subtopic: string | null;
          learning_objective: string | null;
          cognitive_level: string | null;
          correct_rationale_en: string | null;
          option_a_rationale_en: string | null;
          option_b_rationale_en: string | null;
          option_c_rationale_en: string | null;
          option_d_rationale_en: string | null;
          test_taking_tip_en: string | null;
          source_topic: string | null;
          duplicate_hash: string | null;
          quality_score: number | null;
          review_notes: string | null;
          generation_batch_id: string | null;
          generated_by_ai: boolean;
          integrity_status: 'pending' | 'passed' | 'needs_review' | 'needs_improvement' | 'needs_human_review' | 'failed';
          integrity_score: number;
          quality_flags: Json;
          bias_flags: Json;
          distractor_flags: Json;
          blueprint_alignment_score: number;
          difficulty_quality_score: number;
          cognitive_level_detected: string | null;
          predicted_difficulty: 'easy' | 'medium' | 'hard' | null;
          plagiarism_risk_score: number;
          integrity_review_notes: string | null;
          integrity_checked_at: string | null;
          improvement_attempts: number;
          auto_improved: boolean;
          improvement_notes: string | null;
          integrity_override: boolean;
          integrity_override_reason: string | null;
          integrity_override_by: string | null;
          integrity_override_at: string | null;
          active: boolean;
          reviewed: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          exam_id?: string | null;
          exam_track_id?: string | null;
          topic_id?: string | null;
          difficulty?: 'easy' | 'medium' | 'hard';
          question_en: string;
          question_es?: string;
          question_fr?: string;
          option_a_en?: string;
          option_a_es?: string;
          option_a_fr?: string;
          option_b_en?: string;
          option_b_es?: string;
          option_b_fr?: string;
          option_c_en?: string;
          option_c_es?: string;
          option_c_fr?: string;
          option_d_en?: string;
          option_d_es?: string;
          option_d_fr?: string;
          correct_option: 'a' | 'b' | 'c' | 'd';
          rationale_en?: string;
          rationale_es?: string;
          rationale_fr?: string;
          subtopic?: string | null;
          learning_objective?: string | null;
          cognitive_level?: string | null;
          correct_rationale_en?: string | null;
          option_a_rationale_en?: string | null;
          option_b_rationale_en?: string | null;
          option_c_rationale_en?: string | null;
          option_d_rationale_en?: string | null;
          test_taking_tip_en?: string | null;
          source_topic?: string | null;
          duplicate_hash?: string | null;
          quality_score?: number | null;
          review_notes?: string | null;
          generation_batch_id?: string | null;
          generated_by_ai?: boolean;
          integrity_status?: 'pending' | 'passed' | 'needs_review' | 'needs_improvement' | 'needs_human_review' | 'failed';
          integrity_score?: number;
          quality_flags?: Json;
          bias_flags?: Json;
          distractor_flags?: Json;
          blueprint_alignment_score?: number;
          difficulty_quality_score?: number;
          cognitive_level_detected?: string | null;
          predicted_difficulty?: 'easy' | 'medium' | 'hard' | null;
          plagiarism_risk_score?: number;
          integrity_review_notes?: string | null;
          integrity_checked_at?: string | null;
          improvement_attempts?: number;
          auto_improved?: boolean;
          improvement_notes?: string | null;
          integrity_override?: boolean;
          integrity_override_reason?: string | null;
          integrity_override_by?: string | null;
          integrity_override_at?: string | null;
          active?: boolean;
          reviewed?: boolean;
        };
        Update: {
          id?: string;
          exam_id?: string | null;
          exam_track_id?: string | null;
          topic_id?: string | null;
          difficulty?: 'easy' | 'medium' | 'hard';
          question_en?: string;
          question_es?: string;
          question_fr?: string;
          option_a_en?: string;
          option_a_es?: string;
          option_a_fr?: string;
          option_b_en?: string;
          option_b_es?: string;
          option_b_fr?: string;
          option_c_en?: string;
          option_c_es?: string;
          option_c_fr?: string;
          option_d_en?: string;
          option_d_es?: string;
          option_d_fr?: string;
          correct_option?: 'a' | 'b' | 'c' | 'd';
          rationale_en?: string;
          rationale_es?: string;
          rationale_fr?: string;
          subtopic?: string | null;
          learning_objective?: string | null;
          cognitive_level?: string | null;
          correct_rationale_en?: string | null;
          option_a_rationale_en?: string | null;
          option_b_rationale_en?: string | null;
          option_c_rationale_en?: string | null;
          option_d_rationale_en?: string | null;
          test_taking_tip_en?: string | null;
          source_topic?: string | null;
          duplicate_hash?: string | null;
          quality_score?: number | null;
          review_notes?: string | null;
          generation_batch_id?: string | null;
          generated_by_ai?: boolean;
          integrity_status?: 'pending' | 'passed' | 'needs_review' | 'needs_improvement' | 'needs_human_review' | 'failed';
          integrity_score?: number;
          quality_flags?: Json;
          bias_flags?: Json;
          distractor_flags?: Json;
          blueprint_alignment_score?: number;
          difficulty_quality_score?: number;
          cognitive_level_detected?: string | null;
          predicted_difficulty?: 'easy' | 'medium' | 'hard' | null;
          plagiarism_risk_score?: number;
          integrity_review_notes?: string | null;
          integrity_checked_at?: string | null;
          improvement_attempts?: number;
          auto_improved?: boolean;
          improvement_notes?: string | null;
          integrity_override?: boolean;
          integrity_override_reason?: string | null;
          integrity_override_by?: string | null;
          integrity_override_at?: string | null;
          active?: boolean;
          reviewed?: boolean;
        };
      };
      ai_generation_batches: {
        Row: {
          id: string;
          admin_user_id: string | null;
          exam_track_id: string | null;
          topic_id: string | null;
          content_type: 'mcq' | 'flashcards' | 'vignettes';
          quantity_requested: number;
          quantity_generated: number;
          quantity_inserted: number;
          quantity_rejected: number;
          status: 'pending' | 'running' | 'completed' | 'failed';
          model_used: string | null;
          prompt_version: string | null;
          error_message: string | null;
          created_at: string;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          admin_user_id?: string | null;
          exam_track_id?: string | null;
          topic_id?: string | null;
          content_type: 'mcq' | 'flashcards' | 'vignettes';
          quantity_requested: number;
          quantity_generated?: number;
          quantity_inserted?: number;
          quantity_rejected?: number;
          status?: 'pending' | 'running' | 'completed' | 'failed';
          model_used?: string | null;
          prompt_version?: string | null;
          error_message?: string | null;
          created_at?: string;
          completed_at?: string | null;
        };
        Update: {
          id?: string;
          admin_user_id?: string | null;
          exam_track_id?: string | null;
          topic_id?: string | null;
          content_type?: 'mcq' | 'flashcards' | 'vignettes';
          quantity_requested?: number;
          quantity_generated?: number;
          quantity_inserted?: number;
          quantity_rejected?: number;
          status?: 'pending' | 'running' | 'completed' | 'failed';
          model_used?: string | null;
          prompt_version?: string | null;
          error_message?: string | null;
          created_at?: string;
          completed_at?: string | null;
        };
      };
      flashcards: {
        Row: {
          id: string;
          exam_id: string | null;
          exam_track_id: string | null;
          exam_name: string | null;
          topic_id: string | null;
          front_en: string;
          front_es: string;
          front_fr: string;
          back_en: string;
          back_es: string;
          back_fr: string;
          active: boolean;
          reviewed: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          exam_id?: string | null;
          exam_track_id?: string | null;
          exam_name?: string | null;
          topic_id?: string | null;
          front_en?: string;
          front_es?: string;
          front_fr?: string;
          back_en?: string;
          back_es?: string;
          back_fr?: string;
          active?: boolean;
          reviewed?: boolean;
        };
        Update: {
          id?: string;
          exam_id?: string | null;
          exam_track_id?: string | null;
          exam_name?: string | null;
          topic_id?: string | null;
          front_en?: string;
          front_es?: string;
          front_fr?: string;
          back_en?: string;
          back_es?: string;
          back_fr?: string;
          active?: boolean;
          reviewed?: boolean;
        };
      };
      case_vignettes: {
        Row: {
          id: string;
          exam_id: string | null;
          exam_track_id: string | null;
          exam_name: string | null;
          topic_id: string | null;
          case_en: string;
          case_es: string;
          case_fr: string;
          prompt_en: string;
          prompt_es: string;
          prompt_fr: string;
          ideal_answer_en: string;
          ideal_answer_es: string;
          ideal_answer_fr: string;
          coaching_feedback_en: string;
          coaching_feedback_es: string;
          coaching_feedback_fr: string;
          active: boolean;
          reviewed: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          exam_id?: string | null;
          exam_track_id?: string | null;
          exam_name?: string | null;
          topic_id?: string | null;
          case_en?: string;
          case_es?: string;
          case_fr?: string;
          prompt_en?: string;
          prompt_es?: string;
          prompt_fr?: string;
          ideal_answer_en?: string;
          ideal_answer_es?: string;
          ideal_answer_fr?: string;
          coaching_feedback_en?: string;
          coaching_feedback_es?: string;
          coaching_feedback_fr?: string;
          active?: boolean;
          reviewed?: boolean;
        };
        Update: {
          id?: string;
          exam_id?: string | null;
          exam_track_id?: string | null;
          exam_name?: string | null;
          topic_id?: string | null;
          case_en?: string;
          case_es?: string;
          case_fr?: string;
          prompt_en?: string;
          prompt_es?: string;
          prompt_fr?: string;
          ideal_answer_en?: string;
          ideal_answer_es?: string;
          ideal_answer_fr?: string;
          coaching_feedback_en?: string;
          coaching_feedback_es?: string;
          coaching_feedback_fr?: string;
          active?: boolean;
          reviewed?: boolean;
        };
      };
      subscriptions: {
        Row: {
          id: string;
          user_id: string;
          exam_id: string | null;
          exam_track_id: string | null;
          stripe_subscription_id: string | null;
          stripe_customer_id: string | null;
          status: 'active' | 'inactive' | 'canceled' | 'past_due' | 'trialing';
          started_at: string;
          expires_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          exam_id?: string | null;
          exam_track_id?: string | null;
          stripe_subscription_id?: string | null;
          stripe_customer_id?: string | null;
          status?: 'active' | 'inactive' | 'canceled' | 'past_due' | 'trialing';
          started_at?: string;
          expires_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          exam_id?: string | null;
          exam_track_id?: string | null;
          stripe_subscription_id?: string | null;
          stripe_customer_id?: string | null;
          status?: 'active' | 'inactive' | 'canceled' | 'past_due' | 'trialing';
          started_at?: string;
          expires_at?: string | null;
        };
      };
      user_exam_access: {
        Row: {
          id: string;
          user_id: string;
          exam_track_id: string;
          subscription_id: string | null;
          active: boolean;
          granted_at: string;
          revoked_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          exam_track_id: string;
          subscription_id?: string | null;
          active?: boolean;
          granted_at?: string;
          revoked_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          exam_track_id?: string;
          subscription_id?: string | null;
          active?: boolean;
          granted_at?: string;
          revoked_at?: string | null;
        };
      };
      practice_sessions: {
        Row: {
          id: string;
          user_id: string;
          exam_id: string | null;
          exam_track_id: string | null;
          mode: 'mcq' | 'flashcard' | 'vignette';
          score_percent: number | null;
          completed: boolean;
          started_at: string;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          exam_id?: string | null;
          exam_track_id?: string | null;
          mode: 'mcq' | 'flashcard' | 'vignette';
          score_percent?: number | null;
          completed?: boolean;
          started_at?: string;
          completed_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          exam_id?: string | null;
          exam_track_id?: string | null;
          mode?: 'mcq' | 'flashcard' | 'vignette';
          score_percent?: number | null;
          completed?: boolean;
          started_at?: string;
          completed_at?: string | null;
        };
      };
      responses: {
        Row: {
          id: string;
          session_id: string;
          question_id: string;
          selected_answer: 'a' | 'b' | 'c' | 'd';
          is_correct: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          question_id: string;
          selected_answer: 'a' | 'b' | 'c' | 'd';
          is_correct: boolean;
        };
        Update: {
          id?: string;
          session_id?: string;
          question_id?: string;
          selected_answer?: 'a' | 'b' | 'c' | 'd';
          is_correct?: boolean;
        };
      };
      scores: {
        Row: {
          id: string;
          user_id: string;
          exam_id: string | null;
          exam_track_id: string | null;
          score: number;
          weak_topics: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          exam_id?: string | null;
          exam_track_id?: string | null;
          score: number;
          weak_topics?: Json;
        };
        Update: {
          id?: string;
          user_id?: string;
          exam_id?: string | null;
          exam_track_id?: string | null;
          score?: number;
          weak_topics?: Json;
        };
      };
      generation_logs: {
        Row: {
          id: string;
          admin_user_id: string | null;
          exam_track_id: string | null;
          exam_name: string | null;
          topic_id: string | null;
          content_type: 'mcq' | 'flashcards' | 'vignettes';
          requested_count: number;
          generated_count: number;
          duplicate_count: number;
          status: 'success' | 'error';
          error_message: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          admin_user_id?: string | null;
          exam_track_id?: string | null;
          exam_name?: string | null;
          topic_id?: string | null;
          content_type: 'mcq' | 'flashcards' | 'vignettes';
          requested_count: number;
          generated_count?: number;
          duplicate_count?: number;
          status?: 'success' | 'error';
          error_message?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          admin_user_id?: string | null;
          exam_track_id?: string | null;
          exam_name?: string | null;
          topic_id?: string | null;
          content_type?: 'mcq' | 'flashcards' | 'vignettes';
          requested_count?: number;
          generated_count?: number;
          duplicate_count?: number;
          status?: 'success' | 'error';
          error_message?: string | null;
          created_at?: string;
        };
      };
    };
  };
}

export type User = Database['public']['Tables']['users']['Row'];
export type ExamCategory = Database['public']['Tables']['exam_categories']['Row'];
export type ExamTrack = Database['public']['Tables']['exam_tracks']['Row'];
export type Exam = Database['public']['Tables']['exams']['Row'];
export type Topic = Database['public']['Tables']['topics']['Row'];
export type Question = Database['public']['Tables']['questions']['Row'];
export type Flashcard = Database['public']['Tables']['flashcards']['Row'];
export type CaseVignette = Database['public']['Tables']['case_vignettes']['Row'];
export type Subscription = Database['public']['Tables']['subscriptions']['Row'];
export type UserExamAccess = Database['public']['Tables']['user_exam_access']['Row'];
export type PracticeSession = Database['public']['Tables']['practice_sessions']['Row'];
export type Response = Database['public']['Tables']['responses']['Row'];
export type Score = Database['public']['Tables']['scores']['Row'];
export type GenerationLog = Database['public']['Tables']['generation_logs']['Row'];
export type AiGenerationBatch = Database['public']['Tables']['ai_generation_batches']['Row'];
