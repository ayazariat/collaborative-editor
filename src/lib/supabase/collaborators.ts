import { SupabaseClient } from '@supabase/supabase-js'

export interface CollaboratorRow {
  id: string
  user_id: string
  document_id: string
  role: 'editor' | 'viewer'
  created_at: string
  user?: { id: string; email: string; full_name?: string }
}

export async function fetchCollaborators(
  supabase: SupabaseClient,
  documentId: string
) {
  const { data, error } = await supabase
    .from('collaborators')
    .select('*, user:users(id,email,full_name)')
    .eq('document_id', documentId)

  if (error) {
    throw error
  }

  return data || []
}

export async function addCollaborator(
  supabase: SupabaseClient,
  documentId: string,
  userId: string,
  role: 'editor' | 'viewer'
) {
  const { data, error } = await supabase
    .from('collaborators')
    .insert([{ document_id: documentId, user_id: userId, role }])
    .select('*, user:users(id,email,full_name)')
    .single()

  if (error) {
    throw error
  }

  return data
}

export async function removeCollaborator(
  supabase: SupabaseClient,
  collaboratorId: string
) {
  const { error } = await supabase
    .from('collaborators')
    .delete()
    .eq('id', collaboratorId)

  if (error) {
    throw error
  }

  return true
}

export async function updateCollaboratorRole(
  supabase: SupabaseClient,
  collaboratorId: string,
  role: 'editor' | 'viewer'
) {
  const { data, error } = await supabase
    .from('collaborators')
    .update({ role })
    .eq('id', collaboratorId)
    .select('*, user:users(id,email,full_name)')
    .single()

  if (error) {
    throw error
  }

  return data
}

export async function userHasAccess(
  supabase: SupabaseClient,
  documentId: string,
  userId: string
) {
  const { data, error } = await supabase
    .from('collaborators')
    .select('role')
    .eq('document_id', documentId)
    .eq('user_id', userId)
    .single()

  if (error && error.code !== 'PGRST116') {
    throw error
  }

  if (!data) {
    return null
  }

  return data.role
}
