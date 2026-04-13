import { SupabaseClient } from '@supabase/supabase-js'

export interface DocumentRow {
  id: string
  title: string
  owner_id: string
  created_at: string
  updated_at: string
}

export interface DocumentVersionRow {
  id: string
  document_id: string
  user_id: string
  content: { yjs: string }
  created_at: string
}

export async function fetchDocumentById(supabase: SupabaseClient, documentId: string) {
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('id', documentId)
    .single()

  if (error) {
    throw error
  }

  return data
}

export async function updateDocumentTitle(
  supabase: SupabaseClient,
  documentId: string,
  title: string
) {
  const { data, error } = await supabase
    .from('documents')
    .update({ title, updated_at: new Date().toISOString() })
    .eq('id', documentId)

  if (error) {
    throw error
  }

  return data
}

export async function fetchLatestDocumentVersion(
  supabase: SupabaseClient,
  documentId: string
): Promise<DocumentVersionRow | null> {
  const { data, error } = await supabase
    .from('document_versions')
    .select('*')
    .eq('document_id', documentId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (error && error.code !== 'PGRST116') {
    throw error
  }

  return data || null
}

export async function saveDocumentVersion(
  supabase: SupabaseClient,
  documentId: string,
  userId: string,
  encodedState: string
) {
  const { data, error } = await supabase
    .from('document_versions')
    .insert([{ document_id: documentId, user_id: userId, content: { yjs: encodedState } }])

  if (error) {
    throw error
  }

  return data && data[0]
}
