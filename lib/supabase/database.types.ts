export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '14.5'
  }
  public: {
    Tables: {
      daily_entries: {
        Row: {
          avg_heart_rate: number | null
          calories_burnt: number | null
          created_at: string
          deleted_at: string | null
          entry_date: string
          gym_seconds: number | null
          id: string
          max_heart_rate: number | null
          note: string | null
          steps: number | null
          updated_at: string
          user_id: string
          walk_seconds: number | null
          weight_kg: number | null
        }
        Insert: {
          avg_heart_rate?: number | null
          calories_burnt?: number | null
          created_at?: string
          deleted_at?: string | null
          entry_date: string
          gym_seconds?: number | null
          id: string
          max_heart_rate?: number | null
          note?: string | null
          steps?: number | null
          updated_at?: string
          user_id: string
          walk_seconds?: number | null
          weight_kg?: number | null
        }
        Update: {
          avg_heart_rate?: number | null
          calories_burnt?: number | null
          created_at?: string
          deleted_at?: string | null
          entry_date?: string
          gym_seconds?: number | null
          id?: string
          max_heart_rate?: number | null
          note?: string | null
          steps?: number | null
          updated_at?: string
          user_id?: string
          walk_seconds?: number | null
          weight_kg?: number | null
        }
        Relationships: []
      }
      exercises: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          is_archived: boolean
          muscle_group: string
          name: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id: string
          is_archived?: boolean
          muscle_group: string
          name: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_archived?: boolean
          muscle_group?: string
          name?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          height_cm: number | null
          id: string
          rest_seconds_by_exercise: Json
          rest_sound_muted: boolean
          step_goal: number
          target_weight_kg: number | null
          unit_system: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          height_cm?: number | null
          id: string
          rest_seconds_by_exercise?: Json
          rest_sound_muted?: boolean
          step_goal?: number
          target_weight_kg?: number | null
          unit_system?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          height_cm?: number | null
          id?: string
          rest_seconds_by_exercise?: Json
          rest_sound_muted?: boolean
          step_goal?: number
          target_weight_kg?: number | null
          unit_system?: string
          updated_at?: string
        }
        Relationships: []
      }
      workout_sessions: {
        Row: {
          created_at: string
          deleted_at: string | null
          ended_at: string | null
          entry_date: string
          id: string
          started_at: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          ended_at?: string | null
          entry_date: string
          id: string
          started_at: string
          status: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          ended_at?: string | null
          entry_date?: string
          id?: string
          started_at?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      workout_sets: {
        Row: {
          completed_at: string | null
          created_at: string
          deleted_at: string | null
          exercise_id: string
          id: string
          reps: number | null
          rpe: number | null
          session_id: string
          set_index: number
          updated_at: string
          weight_kg: number | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          deleted_at?: string | null
          exercise_id: string
          id: string
          reps?: number | null
          rpe?: number | null
          session_id: string
          set_index: number
          updated_at?: string
          weight_kg?: number | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          deleted_at?: string | null
          exercise_id?: string
          id?: string
          reps?: number | null
          rpe?: number | null
          session_id?: string
          set_index?: number
          updated_at?: string
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: 'workout_sets_exercise_id_fkey'
            columns: ['exercise_id']
            isOneToOne: false
            referencedRelation: 'exercises'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'workout_sets_session_id_fkey'
            columns: ['session_id']
            isOneToOne: false
            referencedRelation: 'workout_sessions'
            referencedColumns: ['id']
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
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
