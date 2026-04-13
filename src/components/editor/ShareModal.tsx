'use client'

import { useEffect, useState } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { fetchCollaborators, addCollaborator, removeCollaborator, updateCollaboratorRole } from '@/lib/supabase/collaborators'

interface ShareModalProps {
  documentId: string
  onClose: () => void
}

interface Collaborator {
  id: string
  user_id: string
  role: string
  user?: { email: string }
}

export default function ShareModal({ documentId, onClose }: ShareModalProps) {
  const [collaborators, setCollaborators] = useState<Collaborator[]>([])
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'editor' | 'viewer'>('editor')
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<string | null>(null)
  const hasSupabase =
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const supabase = hasSupabase ? createClientComponentClient() : null

  useEffect(() => {
    loadCollaborators()
  }, [documentId])

  const loadCollaborators = async () => {
    if (!hasSupabase || !supabase) {
      setLoading(false)
      setCollaborators([])
      return
    }
    setLoading(true)
    try {
      const list = await fetchCollaborators(supabase, documentId)
      setCollaborators(list)
    } catch (error) {
      console.error(error)
      setMessage('Unable to load collaborators')
    } finally {
      setLoading(false)
    }
  }

  const handleAddCollaborator = async () => {
    if (!hasSupabase || !supabase) {
      setMessage('Local mode: sharing by email requires Supabase configuration.')
      return
    }
    if (!email.trim()) {
      setMessage('Please provide an email.')
      return
    }

    try {
      // Ensure user exists in Auth users table
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('email', email)
        .single()

      if (userError) {
        setMessage('User not found; ask them to sign up first.')
        return
      }

      const collaborator = await addCollaborator(supabase, documentId, userData.id, role)
      setCollaborators([...collaborators, collaborator])
      setEmail('')
      setMessage('Collaborator added.')
    } catch (error) {
      console.error(error)
      setMessage('Error adding collaborator. Maybe already has access.')
    }
  }

  const handleRemove = async (id: string) => {
    if (!hasSupabase || !supabase) return
    try {
      await removeCollaborator(supabase, id)
      setCollaborators(collaborators.filter((c) => c.id !== id))
      setMessage('Collaborator removed.')
    } catch (error) {
      console.error(error)
      setMessage('Failed to remove collaborator.')
    }
  }

  const handleRoleChange = async (id: string, newRole: 'editor' | 'viewer') => {
    if (!hasSupabase || !supabase) return
    try {
      const updated = await updateCollaboratorRole(supabase, id, newRole)
      setCollaborators(collaborators.map((c) => (c.id === id ? updated : c)))
      setMessage('Role updated.')
    } catch (error) {
      console.error(error)
      setMessage('Failed to update role.')
    }
  }

  const shareLink = `${typeof window !== 'undefined' ? window.location.origin : ''}/editor/${documentId}`

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="w-full max-w-lg rounded-xl bg-white shadow-xl overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold">Share Document</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-900">Close</button>
        </div>

        <div className="p-4 space-y-4">
          {message && <div className="text-sm text-blue-700">{message}</div>}

          {!hasSupabase && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Local mode active: link sharing works, collaborator permissions require Supabase env vars.
            </div>
          )}

          <div>
            <label className="text-sm font-medium text-gray-700">Share Link</label>
            <div className="flex gap-2 mt-1">
              <input readOnly value={shareLink} className="flex-1 rounded-lg border px-3 py-2 text-sm" />
              <button
                onClick={() => {
                  navigator.clipboard.writeText(shareLink)
                  setMessage('Link copied!')
                }}
                className="rounded-lg bg-blue-600 px-3 py-2 text-white text-sm"
              >
                Copy
              </button>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700">Add collaborator</label>
            <div className="flex flex-wrap gap-2 mt-1">
              <input
                className="flex-1 rounded-lg border px-3 py-2 text-sm"
                placeholder="user@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as 'editor' | 'viewer')}
                className="rounded-lg border px-3 py-2 text-sm"
              >
                <option value="editor">Editor</option>
                <option value="viewer">Viewer</option>
              </select>
              <button onClick={handleAddCollaborator} className="rounded-lg bg-green-600 px-3 py-2 text-white text-sm">
                Add
              </button>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold">Collaborators ({collaborators.length})</h4>
            {loading ? (
              <div className="py-2 text-sm text-gray-500">Loading...</div>
            ) : collaborators.length === 0 ? (
              <p className="text-sm text-gray-500">No collaborators yet.</p>
            ) : (
              <ul className="space-y-2 max-h-40 overflow-y-auto">
                {collaborators.map((collab) => (
                  <li key={collab.id} className="flex items-center justify-between rounded-lg bg-gray-50 p-2">
                    <div>
                      <div className="text-sm font-medium">{collab.user?.email || 'Unknown user'}</div>
                      <div className="text-xs text-gray-500">{collab.role}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        value={collab.role}
                        onChange={(e) => handleRoleChange(collab.id, e.target.value as 'editor' | 'viewer')}
                        className="rounded border py-1 px-2 text-xs"
                      >
                        <option value="editor">Editor</option>
                        <option value="viewer">Viewer</option>
                      </select>
                      <button onClick={() => handleRemove(collab.id)} className="text-red-600 text-xs">Remove</button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
