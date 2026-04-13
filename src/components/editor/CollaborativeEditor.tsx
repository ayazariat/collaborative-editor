'use client'

import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
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
  const hasSupabase =
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const supabase = hasSupabase ? createClientComponentClient() : null
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
  const [localVersionTick, setLocalVersionTick] = useState(0)

  const [versionToRestore, setVersionToRestore] = useState<string | null>(null)
  const [collaborators, setCollaborators] = useState<CollaboratorRow[]>([])
  const [role, setRole] = useState<'editor' | 'viewer'>('editor')

  const snapshotIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const providerReleaseRef = useRef<string | null>(null)

  useEffect(() => {
    let mounted = true
    const init = async () => {
      try {
        setStatus('loading')
        setMessage('Loading session...')

        if (!hasSupabase || !supabase) {
          const entry = getOrCreateYjsProvider(documentId)
          if (!mounted) return

          setDocument({
            id: documentId,
            title: 'Local Document',
            owner_id: 'local',
            updated_at: new Date().toISOString(),
          })
          setCanEdit(true)
          setRole('editor')
          setCurrentUser({
            id: `local-${crypto.randomUUID()}`,
            email: 'local@offline',
            full_name: 'Local User',
          })
          setProviderEntry(entry)

          entry.provider.awareness.setLocalStateField('user', {
            userId: `local-${crypto.randomUUID()}`,
            name: 'Local User',
            email: 'local@offline',
            color: colorById(`local-${documentId}`),
          })

          providerReleaseRef.current = documentId
          const localInterval = setInterval(() => {
            const payload = encodeStateToBase64(entry.ydoc)
            const raw = localStorage.getItem(`local_versions_${documentId}`)
            const list = raw ? JSON.parse(raw) : []
            list.unshift({
              id: `local-${Date.now()}`,
              content: payload,
              created_at: new Date().toISOString(),
              user_id: 'local',
              user: { email: 'local@offline' },
            })
            localStorage.setItem(`local_versions_${documentId}`, JSON.stringify(list.slice(0, 20)))
            setLocalVersionTick((prev) => prev + 1)
          }, 30000)
          snapshotIntervalRef.current = localInterval
          setStatus('ready')
          setMessage('Local collaboration mode')
          return
        }

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
          if (!canEdit || !initialYdoc || !hasSupabase || !supabase) return
          const payload = encodeStateToBase64(initialYdoc)
          await saveDocumentVersion(supabase, documentId, user.id, payload)
          setLastSavedAt(new Date().toLocaleTimeString())
        }, 30000)

        snapshotIntervalRef.current = interval
        providerReleaseRef.current = documentId

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
      if (snapshotIntervalRef.current) {
        clearInterval(snapshotIntervalRef.current)
      }
      if (providerReleaseRef.current) {
        releaseYjsProvider(documentId)
      }
    }
  }, [documentId, hasSupabase, supabase, canEdit])

  useEffect(() => {
    if (!providerEntry || !currentUser || !hasSupabase || !supabase) return
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
  }, [document?.title, hasSupabase, supabase, canEdit, currentUser, providerEntry, documentId])

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
        ...(providerEntry
          ? [
              Collaboration.configure({ document: providerEntry.ydoc }),
              CollaborationCursor.configure({
                provider: providerEntry.provider,
                user: {
                  name: currentUser?.full_name || currentUser?.email || 'Anonymous',
                  color: colorById(currentUser?.id || 'anon'),
                },
              }),
            ]
          : []),
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
          if (hasSupabase && supabase && currentUser) {
            await saveDocumentVersion(supabase, documentId, currentUser.id, updateState)
          } else {
            const raw = localStorage.getItem(`local_versions_${documentId}`)
            const list = raw ? JSON.parse(raw) : []
            list.unshift({
              id: `local-${Date.now()}`,
              content: updateState,
              created_at: new Date().toISOString(),
              user_id: 'local',
              user: { email: 'local@offline' },
            })
            localStorage.setItem(`local_versions_${documentId}`, JSON.stringify(list.slice(0, 20)))
            setLocalVersionTick((prev) => prev + 1)
          }
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
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="text-red-500 text-5xl">⚠️</div>
          <h2 className="text-xl font-semibold text-gray-900">{message}</h2>
          <a href="/" className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">Go Home</a>
        </div>
      </div>
    )
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
    <div className="space-y-4 text-slate-900">
      {/* Header bar */}
      <header className="sticky top-0 z-40 rounded-xl bg-white/90 backdrop-blur border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between px-4 py-3 gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <a href="/" className="shrink-0 p-2 rounded-lg hover:bg-slate-100 transition-colors" title="Back to home">
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </a>
            <input
              type="text"
              value={document?.title ?? ''}
              onChange={(e) => setDocument((d) => d ? { ...d, title: e.target.value } : d)}
              onBlur={async (e) => {
                if (canEdit && document && hasSupabase && supabase) {
                  try { await updateDocumentTitle(supabase, documentId, e.target.value) } catch {}
                }
              }}
              readOnly={!canEdit}
              className="text-lg font-semibold tracking-tight bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-slate-400 rounded px-1 py-0.5 min-w-0 truncate"
              placeholder="Untitled Document"
            />
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {/* Save status */}
            {isSaving ? (
              <span className="text-xs text-amber-700 flex items-center gap-1 bg-amber-50 border border-amber-200 rounded-full px-2 py-1">
                <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                Saving…
              </span>
            ) : lastSavedAt ? (
              <span className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-1">✓ Saved {lastSavedAt}</span>
            ) : null}
            {/* Connection dot */}
            <span className={`w-2 h-2 rounded-full ${statusIndicator.replace('text-', 'bg-')}`} title={status} />
            <PresenceBar awareness={providerEntry.provider.awareness} currentUserId={currentUser?.id || ''} />
            <button onClick={() => setShowShare(true)} className="px-3 py-1.5 bg-slate-900 text-white text-sm rounded-lg hover:bg-slate-800 transition-colors">Share</button>
            <button onClick={() => setShowVersionHistory((prev) => !prev)} className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${showVersionHistory ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'}`}>History</button>
          </div>
        </div>
      </header>

      <Toolbar editor={editor} onSummarize={summarize} onTaskExtract={taskExtract} onAddComment={addComment} readOnly={!canEdit} />

      <div className="border rounded-xl bg-white shadow-sm ring-1 ring-slate-100">
        <EditorContent editor={editor} className="min-h-[520px] px-8 py-6 prose prose-sm sm:prose lg:prose-lg max-w-none focus:outline-none" />
      </div>

      {showSummary && (
        <section className="rounded-xl border bg-indigo-50 border-indigo-200 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-indigo-800">AI Summary</h3>
            <button onClick={() => setShowSummary(false)} className="text-indigo-400 hover:text-indigo-700 text-xs">Dismiss</button>
          </div>
          <p className="text-sm text-indigo-900 whitespace-pre-wrap">{summaryText}</p>
        </section>
      )}

      {showVersionHistory && (
        <div className="rounded-xl border p-3 bg-white shadow-sm">
          <VersionHistory key={`${documentId}-${localVersionTick}`} documentId={documentId} onRestore={onRestoreVersion} />
        </div>
      )}

      <div className="rounded-xl border p-3 bg-white shadow-sm">
        <h4 className="text-sm font-semibold mb-2">Activity Log</h4>
        <div className="max-h-40 overflow-y-auto text-xs text-gray-600">
          {activityLog.length === 0 ? (
            <p className="text-gray-400 italic">No activity yet</p>
          ) : activityLog.map((item, idx) => (
            <div key={idx} className="flex gap-2">
              <span className="text-gray-300 select-none">›</span>
              <span>{item}</span>
            </div>
          ))}
        </div>
      </div>

      {showShare && <ShareModal documentId={documentId} onClose={() => setShowShare(false)} />}
    </div>
  )
}
