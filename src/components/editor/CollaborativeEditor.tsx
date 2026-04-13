'use client'

import { useEffect, useMemo, useState, useCallback } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Collaboration from '@tiptap/extension-collaboration'
import CollaborationCursor from '@tiptap/extension-collaboration-cursor'
import Placeholder from '@tiptap/extension-placeholder'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Highlight from '@tiptap/extension-highlight'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import * as Y from 'yjs'

import Toolbar from './Toolbar'
import PresenceBar from './PresenceBar'
import VersionHistory from './VersionHistory'
import ShareModal from './ShareModal'

import {
  getOrCreateYjsProvider,
  releaseYjsProvider,
  encodeStateToBase64,
  applyBase64State,
} from '@/lib/yjs/provider'
import {
  fetchDocumentById,
  fetchLatestDocumentVersion,
  saveDocumentVersion,
  updateDocumentTitle,
} from '@/lib/supabase/documents'
import {
  fetchCollaborators,
  userHasAccess,
  CollaboratorRow,
} from '@/lib/supabase/collaborators'

interface CollaborativeEditorProps {
  documentId: string
  ownerId?: string
}

const AVATAR_COLORS = [
  '#f87171', '#fb923c', '#fbbf24', '#a3e635', '#4ade80', '#2dd4bf', '#22d3ee', '#60a5fa', '#a78bfa', '#f472b6',
]

function colorById(id: string) {
  let hash = 0
  for (let i = 0; i < id.length; i++) {
    hash = (hash << 5) - hash + id.charCodeAt(i)
    hash |= 0
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

export default function CollaborativeEditor({ documentId, ownerId }: CollaborativeEditorProps) {
  const supabase = createClientComponentClient()
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [message, setMessage] = useState<string>('Loading document...')
  const [document, setDocument] = useState<{ id: string; title: string; owner_id: string; updated_at: string } | null>(null)
  const [canEdit, setCanEdit] = useState(false)
  const [currentUser, setCurrentUser] = useState<{ id: string; email: string; full_name?: string } | null>(null)
  const [providerEntry, setProviderEntry] = useState<{ ydoc: Y.Doc; provider: any } | null>(null)
  const [activeUsers, setActiveUsers] = useState<any[]>([])
  const [activityLog, setActivityLog] = useState<string[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [lastSavedAt, setLastSavedAt] = useState<string>('')
  const [showShare, setShowShare] = useState(false)
  const [showVersionHistory, setShowVersionHistory] = useState(false)
  const [showSummary, setShowSummary] = useState(false)
  const [summaryText, setSummaryText] = useState('')

  const [versionToRestore, setVersionToRestore] = useState<string | null>(null)

  const [collaborators, setCollaborators] = useState<CollaboratorRow[]>([])

  const [role, setRole] = useState<'editor' | 'viewer'>('editor')

  useEffect(() => {
    let mounted = true
    const init = async () => {
      try {
        setStatus('loading')
        setMessage('Loading session...')

        const { data } = await supabase.auth.getUser()
        const user = data.user
        if (!user) {
          setMessage('You need to sign in to access this document.')
          setStatus('error')
          return
        }

        const userData = { id: user.id, email: user.email || 'anonymous', full_name: user.user_metadata?.full_name }
        if (mounted) setCurrentUser(userData)

        const doc = await fetchDocumentById(supabase, documentId)
        if (!doc) {
          setMessage('Document not found.')
          setStatus('error')
          return
        }

        const collaboratorRole = await userHasAccess(supabase, documentId, user.id)

        const hasOwnerAccess = doc.owner_id === user.id
        if (!hasOwnerAccess && !collaboratorRole) {
          setMessage('Access denied. Please ask the owner to share the document.')
          setStatus('error')
          return
        }

        setCanEdit(hasOwnerAccess || collaboratorRole === 'editor')
        setRole(hasOwnerAccess ? 'editor' : (collaboratorRole as 'editor' | 'viewer'))

        const collabs = await fetchCollaborators(supabase, documentId)
        setCollaborators(collabs)

        setDocument(doc)

        const previous = await fetchLatestDocumentVersion(supabase, documentId)

        const entry = getOrCreateYjsProvider(documentId)
        if (!mounted) return
        setProviderEntry(entry)

        const initialYdoc = entry.ydoc

        if (previous?.content?.yjs) {
          applyBase64State(initialYdoc, previous.content.yjs)
        }

        await new Promise<void>((resolve) => {
          entry.provider.once('synced', () => resolve())
          setTimeout(resolve, 1500)
        })

        entry.provider.awareness.setLocalStateField('user', {
          userId: user.id,
          name: userData.full_name || userData.email || 'Anonymous',
          email: userData.email,
          color: colorById(user.id),
        })

        entry.provider.awareness.on('change', () => {
          const states = Array.from(entry.provider.awareness.getStates().values()) as any[]
          setActiveUsers(states.map((s) => s.user).filter(Boolean))
          setActivityLog((prev) => [`${new Date().toLocaleTimeString()} - Presence changed (${states.length} active)`, ...prev].slice(0, 40))
        })

        entry.provider.on('status', ({ status }: { status: string }) => {
          setActivityLog((prev) => [`${new Date().toLocaleTimeString()} - Connection ${status}`, ...prev].slice(0, 40))
        })

        const interval = setInterval(async () => {
          if (!canEdit || !initialYdoc) return
          const payload = encodeStateToBase64(initialYdoc)
          await saveDocumentVersion(supabase, documentId, user.id, payload)
          setLastSavedAt(new Date().toLocaleTimeString())
        }, 30000)

        setSnapshotIntervalId(interval)

        setStatus('ready')
        setMessage('Document loaded.')
      } catch (error) {
        console.error(error)
        setMessage('Failed to initialize collaboration editor')
        setStatus('error')
      }
    }

    init()

    return () => {
      mounted = false
      if (cleanupInterval) {
        clearInterval(cleanupInterval)
      }
      if (providerToRelease) {
        releaseYjsProvider(documentId)
      }
    }
  }, [documentId])

  useEffect(() => {
    if (!providerEntry || !currentUser) return
    if (document) {
      ;(async () => {
        if (canEdit) {
          try {
            await updateDocumentTitle(supabase, documentId, document.title)
          } catch (e) {
            console.error(e)
          }
        }
      })()
    }
  }, [document?.title])

  const handleCommand = useCallback(
    (command: string) => {
      if (!providerEntry || !providerEntry.provider || !providerEntry.ydoc) return
      const editorInstance = editor
      if (!editorInstance) return

      if (command === 'heading1') {
        editorInstance.chain().focus().toggleHeading({ level: 1 }).run()
      }
      if (command === 'todo') {
        editorInstance.chain().focus().toggleTaskList().run()
      }
      setShowSlash(false)
      setSlashCommand('')
    },
    [providerEntry]
  )

  const editor = useEditor(
    {
      extensions: [
        StarterKit,
        TaskList,
        TaskItem.configure({ nested: true }),
        Highlight,
        Placeholder.configure({ placeholder: 'Type / for commands and start collaborating...' }),
        providerEntry
          ? Collaboration.configure({ document: providerEntry.ydoc })
          : Collaboration.configure({ document: new Y.Doc() }),
        providerEntry
          ? CollaborationCursor.configure({
              provider: providerEntry.provider,
              user: {
                name: currentUser?.full_name || currentUser?.email || 'Anonymous',
                color: colorById(currentUser?.id || 'anon'),
              },
            })
          : CollaborationCursor.configure({ provider: null as any, user: { name: 'Anon', color: '#AAA' } }),
      ],
      editorProps: {
        attributes: {
          class: 'border-none outline-none p-4 min-h-[400px]',
        },
      },
      editable: canEdit,
      onUpdate: async ({ editor }) => {
        if (providerEntry) {
          setIsSaving(true)
          setLastSavedAt(new Date().toLocaleTimeString())
          setTimeout(() => setIsSaving(false), 500)

          const updateState = encodeStateToBase64(providerEntry.ydoc)
          if (currentUser) await saveDocumentVersion(supabase, documentId, currentUser.id, updateState)
        }
      },
      onCreate: ({ editor }) => {
        editor.chain().focus().run()
      },
    },
    [providerEntry, canEdit, currentUser]
  )

  useEffect(() => {
    if (!editor) return
    editor.setEditable(canEdit)
  }, [editor, canEdit])

  const addComment = async () => {
    if (!editor || editor.isEmpty) return
    const selectedText = editor.state.doc.textBetween(editor.state.selection.from, editor.state.selection.to, ' ')
    const comment = prompt('Add comment for selected text:', selectedText)
    if (!comment) return
    setActivityLog((prev) => [`${new Date().toLocaleTimeString()} - Comment added: ${comment}`, ...prev].slice(0, 40))
  }

  const taskExtract = () => {
    if (!editor) return
    const selectedText = editor.state.doc.textBetween(editor.state.selection.from, editor.state.selection.to, ' ')
    if (!selectedText) return

    const lines = selectedText.split(/\n+/).map((line) => line.trim()).filter(Boolean)
    if (!lines.length) return

    editor.chain().focus().insertContent({ type: 'taskList', content: lines.map((line) => ({ type: 'taskItem', attrs: { checked: false }, content: [{ type: 'text', text: line }] })) }).run()
    setActivityLog((prev) => [`${new Date().toLocaleTimeString()} - Task extraction from selection`, ...prev].slice(0, 40))
  }

  const summarize = () => {
    if (!editor) return
    const text = editor.getText().slice(0, 1200)
    const summary = `Summary: ${text.substring(0, 200)}...`
    setSummaryText(summary)
    setShowSummary(true)
    setActivityLog((prev) => [`${new Date().toLocaleTimeString()} - AI summary generated`, ...prev].slice(0, 40))
  }

  const onRestoreVersion = (contentBase64: string) => {
    if (!providerEntry || !editor) return
    applyBase64State(providerEntry.ydoc, contentBase64)
    editor.commands.setContent(providerEntry.ydoc.getText('default').toString())
    setActivityLog((prev) => [`${new Date().toLocaleTimeString()} - Version restored`, ...prev].slice(0, 40))
  }

  const statusIndicator = useMemo(() => {
    if (status === 'error') return 'text-red-600'
    if (status === 'loading') return 'text-yellow-500'
    return 'text-green-600'
  }, [status])

  if (status === 'error') {
    return <div className="p-8 text-center text-red-600">{message}</div>
  }

  if (!providerEntry || !editor) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="spinner" />
        <span className="ml-3">Preparing collaborative editor...</span>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <PresenceBar awareness={providerEntry.provider.awareness} currentUserId={currentUser?.id || ''} />
          <div className="text-xs text-gray-500">Previous save: {lastSavedAt || '—'}</div>
          <div className={`${statusIndicator} text-xs font-semibold`}>{status}</div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowShare(true)} className="text-sm px-3 py-1 bg-blue-600 text-white rounded">Share</button>
          <button onClick={() => setShowVersionHistory((prev) => !prev)} className="text-sm px-3 py-1 bg-gray-100 rounded">Version</button>
          <button onClick={summarize} className="text-sm px-3 py-1 bg-indigo-600 text-white rounded">Summarize</button>
        </div>
      </div>

      <Toolbar editor={editor} onSummarize={summarize} onTaskExtract={taskExtract} onAddComment={addComment} readOnly={!canEdit} />

      <div className="border rounded-lg bg-white">
        <EditorContent editor={editor} className="min-h-[420px] p-3 prose prose-sm sm:prose lg:prose-lg" />
      </div>

      {showSummary && (
        <section className="rounded-lg border bg-gray-50 p-4">
          <h3 className="text-sm font-semibold mb-2">AI Summary</h3>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{summaryText}</p>
        </section>
      )}

      {showVersionHistory && (
        <div className="rounded-lg border p-3 bg-white">
          <VersionHistory documentId={documentId} onRestore={onRestoreVersion} />
        </div>
      )}

      <div className="rounded-lg border p-3 bg-white">
        <h4 className="text-sm font-semibold mb-2">Activity Log</h4>
        <div className="max-h-40 overflow-y-auto text-xs text-gray-600">
          {activityLog.length === 0 ? <p className="text-gray-500">No activity yet</p> : activityLog.map((item, idx) => <div key={idx}>{item}</div>)}
        </div>
      </div>

      {showShare && <ShareModal documentId={documentId} onClose={() => setShowShare(false)} />}
    </div>
  )
}
