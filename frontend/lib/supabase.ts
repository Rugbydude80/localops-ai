import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Types for our database tables
export interface Business {
  id: number
  name: string
  type?: string
  phone_number?: string
  email?: string
  address?: string
  owner_name?: string
  subscription_tier: string
  is_active: boolean
  created_at: string
}

export interface Staff {
  id: number
  business_id: number
  name: string
  phone_number: string
  email?: string
  role: string
  roles?: string[]
  skills: string[]
  seniority_level?: string
  availability?: Record<string, string[]>
  reliability_score: number
  is_active: boolean
  hired_date: string
  last_shift_date?: string
  max_weekly_hours?: number
  unavailable_times?: any[]
  contract_type?: string
  hourly_rate?: number
  currency?: string
}

export interface EmergencyRequest {
  id: number
  business_id: number
  shift_date: string
  shift_start: string
  shift_end: string
  required_skill: string
  urgency: string
  message?: string
  status: string
  filled_by?: number
  filled_at?: string
  created_at: string
  expires_at?: string
}

export interface ShiftCoverage {
  id: number
  request_id: number
  staff_id: number
  response: string
  response_time_minutes?: number
  responded_at: string
}

export interface MessageLog {
  id: number
  business_id: number
  staff_id: number
  request_id?: number
  message_type: string
  platform: string
  phone_number: string
  message_content: string
  external_message_id?: string
  status: string
  sent_at: string
  delivered_at?: string
  read_at?: string
}