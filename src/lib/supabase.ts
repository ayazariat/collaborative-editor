import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Database types
export interface User {
  id: string
  email: string
  created_at: string
}

export interface Document {
  id: string
  title: string
  owner_id: string
  created_at: string
  updated_at: string
}

export interface Collaborator {
  id: string
  user_id: string
  document_id: string
  role: 'editor' | 'viewer'
  created_at: string
}

export interface Comment {
  id: string
  document_id: string
  user_id: string
  content: string
  position: any
  created_at: string
}

export interface DocumentVersion {
  id: string
  document_id: string
  user_id: string
  content: any
  created_at: string
}
