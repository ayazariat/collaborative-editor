'use client'

import { useEffect, useState, useCallback } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Collaboration from '@tiptap/extension-collaboration'
import CollaborationCursor from '@tiptap/extension-collaboration-cursor'
import Highlight from '@tiptap/extension-highlight'
import Placeholder from '@tiptap/extension-placeholder'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

interface EditorProps {
  documentId: string
  userId?: string
}

const COLORS = [
  '#f87171', // red
  '#fb923c', // orange
  '#fbbf24', // amber
  '#a3e635', // lime
  '#4ade80', // green
  '#2dd4bf', // teal
  '#22d3ee', // cyan
  '#60a5fa', // blue
  '#a78bfa', // violet
  '#f472b6', // pink
]

export default function Editor({ documentId, userId }: EditorProps) {
  const [ydoc] = useState(() => new Y.Doc())
  const [provider, setProvider] = useState<WebsocketProvider | null>(null)
  const [username, setUsername] = useState<string>('')
  const [currentUserId, setCurrentUserId] = useState<string>('')
  const [isSaving, setIsSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'connecting' | 'disconnected'>('connecting')
  const hasSupabase = !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const supabase = hasSupabase ? createClientComponentClient() : null

  // Generate a temporary user ID for local documents once on mount
  useEffect(() => {
    if (!currentUserId) {
      setCurrentUserId(userId || `local-user-${Math.random().toString(36).substr(2, 9)}`)
    }
  }, []) // Only run once on mount

  useEffect(() => {
    if (!currentUserId) return

    const fetchUser = async () => {
      if (!supabase) {
        setUsername('Anonymous')
        return
      }
      const { data: { user } } = await supabase.auth.getUser()
      if (user?.email) {
        setUsername(user.email.split('@')[0])
      } else {
        setUsername('Anonymous')
      }
    }
    fetchUser()

    const wsProvider = new WebsocketProvider(
      process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:1234',
      documentId,
      ydoc
    )

    // Monitor connection status
    wsProvider.on('status', (event: { status: string }) => {
      setConnectionStatus(event.status === 'connected' ? 'connected' : 'disconnected')
    })

    // Auto-save indicator
    const handleDocumentUpdate = () => {
      setIsSaving(true)
      setLastSaved(new Date())

      // Simulate save delay
      setTimeout(() => {
        setIsSaving(false)
      }, 500)
    }

    ydoc.on('update', handleDocumentUpdate)

    setProvider(wsProvider)

    const color = COLORS[Math.floor(Math.random() * COLORS.length)]
    wsProvider.awareness.setLocalStateField('user', {
      name: username || 'Anonymous',
      color: color,
      userId: currentUserId,
    })

    return () => {
      ydoc.off('update', handleDocumentUpdate)
      wsProvider.destroy()
    }
  }, [documentId, currentUserId, ydoc])

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        history: false,
      }),
      Highlight,
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      Placeholder.configure({
        placeholder: 'Start writing...',
      }),
      ...(ydoc
        ? [
            Collaboration.configure({
              document: ydoc,
            }),
          ]
        : []),
      ...(provider
        ? [
            CollaborationCursor.configure({
              provider: provider,
              user: {
                name: username || 'Anonymous',
                color: COLORS[Math.floor(Math.random() * COLORS.length)],
              },
            }),
          ]
        : []),
    ],
    editorProps: {
      attributes: {
        class: 'prose prose-sm sm:prose lg:prose-lg xl:prose-2xl mx-auto focus:outline-none',
      },
    },
    onUpdate: ({ editor }) => {
    },
  }, [ydoc, provider])

  // Keyboard shortcuts
  useEffect(() => {
    if (!editor) return

    const handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl+B for bold
      if (event.ctrlKey && event.key === 'b') {
        event.preventDefault()
        editor.chain().focus().toggleBold().run()
      }
      // Ctrl+I for italic
      if (event.ctrlKey && event.key === 'i') {
        event.preventDefault()
        editor.chain().focus().toggleItalic().run()
      }
      // Ctrl+Shift+7 for bullet list
      if (event.ctrlKey && event.shiftKey && event.key === '7') {
        event.preventDefault()
        editor.chain().focus().toggleBulletList().run()
      }
      // Ctrl+Shift+8 for numbered list
      if (event.ctrlKey && event.shiftKey && event.key === '8') {
        event.preventDefault()
        editor.chain().focus().toggleOrderedList().run()
      }
      // Ctrl+Z for undo
      if (event.ctrlKey && event.key === 'z' && !event.shiftKey) {
        event.preventDefault()
        editor.chain().focus().undo().run()
      }
      // Ctrl+Y or Ctrl+Shift+Z for redo
      if ((event.ctrlKey && event.key === 'y') || (event.ctrlKey && event.shiftKey && event.key === 'z')) {
        event.preventDefault()
        editor.chain().focus().redo().run()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [editor])

  // Enhanced toolbar button component
  const ToolbarButton = ({
    onClick,
    isActive = false,
    children,
    title,
    shortcut,
  }: {
    onClick: () => void
    isActive?: boolean
    children: React.ReactNode
    title: string
    shortcut?: string
  }) => (
    <button
      onClick={onClick}
      className={`relative p-2 rounded-md transition-all duration-150 ${
        isActive
          ? 'bg-blue-100 text-blue-700 shadow-sm'
          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
      }`}
      title={`${title}${shortcut ? ` (${shortcut})` : ''}`}
    >
      {children}
    </button>
  )

  if (!editor || !provider) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="spinner"></div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      {/* Status Bar */}
      <div className="border-b border-gray-200 px-4 py-2 flex items-center justify-between bg-gray-50">
        <div className="flex items-center gap-4">
          {/* Connection Status */}
          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${
                connectionStatus === 'connected'
                  ? 'bg-green-500'
                  : connectionStatus === 'connecting'
                  ? 'bg-yellow-500 animate-pulse'
                  : 'bg-red-500'
              }`}
            />
            <span className="text-xs text-gray-600 capitalize">
              {connectionStatus}
            </span>
          </div>

          {/* Auto-save Status */}
          <div className="flex items-center gap-2">
            {isSaving ? (
              <>
                <div className="animate-spin w-3 h-3 border border-gray-400 border-t-transparent rounded-full"></div>
                <span className="text-xs text-gray-600">Saving...</span>
              </>
            ) : lastSaved ? (
              <>
                <svg className="w-3 h-3 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                <span className="text-xs text-gray-600">
                  Saved {lastSaved.toLocaleTimeString()}
                </span>
              </>
            ) : null}
          </div>
        </div>

        <div className="text-xs text-gray-500">
          {editor?.storage?.characterCount?.characters() || 0} characters
        </div>
      </div>

      {/* Toolbar */}
      <div className="border-b border-gray-200 p-3 flex items-center gap-1 flex-wrap">
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          isActive={editor.isActive('bold')}
          title="Bold"
          shortcut="Ctrl+B"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 4h8a4 4 0 014 4 4 4 0 01-4 4H6z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 12h9a4 4 0 014 4 4 4 0 01-4 4H6z" />
          </svg>
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          isActive={editor.isActive('italic')}
          title="Italic"
          shortcut="Ctrl+I"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 4h4m-2 0v16m-4 0h8" />
          </svg>
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHighlight().run()}
          isActive={editor.isActive('highlight')}
          title="Highlight"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10m-5-4v4m0-4a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v8a4 4 0 01-4 4z" />
          </svg>
        </ToolbarButton>

        <div className="w-px h-6 bg-gray-300 mx-2"></div>

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          isActive={editor.isActive('heading', { level: 1 })}
          title="Heading 1"
        >
          <span className="font-bold text-sm">H1</span>
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          isActive={editor.isActive('heading', { level: 2 })}
          title="Heading 2"
        >
          <span className="font-bold text-sm">H2</span>
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          isActive={editor.isActive('heading', { level: 3 })}
          title="Heading 3"
        >
          <span className="font-bold text-sm">H3</span>
        </ToolbarButton>

        <div className="w-px h-6 bg-gray-300 mx-2"></div>

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          isActive={editor.isActive('bulletList')}
          title="Bullet List"
          shortcut="Ctrl+Shift+7"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          isActive={editor.isActive('orderedList')}
          title="Numbered List"
          shortcut="Ctrl+Shift+8"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
          </svg>
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleTaskList().run()}
          isActive={editor.isActive('taskList')}
          title="Task List"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
        </ToolbarButton>

        <div className="w-px h-6 bg-gray-300 mx-2"></div>

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          isActive={editor.isActive('blockquote')}
          title="Quote"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          isActive={editor.isActive('codeBlock')}
          title="Code Block"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
          </svg>
        </ToolbarButton>

        <div className="w-px h-6 bg-gray-300 mx-2"></div>

        <ToolbarButton
          onClick={() => editor.chain().focus().undo().run()}
          title="Undo"
          shortcut="Ctrl+Z"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
          </svg>
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().redo().run()}
          title="Redo"
          shortcut="Ctrl+Y"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" />
          </svg>
        </ToolbarButton>
      </div>

      <EditorContent editor={editor} className="min-h-[500px] p-6" />
    </div>
  )
}
