'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import CollaborativeEditor from '@/components/editor/CollaborativeEditor'

export default function EditorPage() {
  const params = useParams()
  const router = useRouter()
  const documentId = params.id as string

  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!documentId) {
      router.push('/')
    } else {
      setLoading(false)
    }
  }, [documentId, router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="spinner"></div>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <CollaborativeEditor documentId={documentId} />
      </div>
    </main>
  )
}

  useEffect(() => {
    if (hasSupabase) {
      checkUser()
      fetchDocument()
    } else {
      // For local documents, no user check needed
      setDocument({ id: documentId, title: 'Local Document', owner_id: 'local', created_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      setTitle('Local Document')
      setShareUrl(window.location.href)
      setLoading(false)
    }
  }, [documentId])

  const checkUser = async () => {
    if (!supabase) return
    const { data: { user } } = await supabase.auth.getUser()
    setUser(user)
  }

  const fetchDocument = async () => {
    if (!supabase) return
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('id', documentId)
        .single()

      if (error) throw error
      if (data) {
        setDocument(data)
        setTitle(data.title)
      }
    } catch (error) {
      console.error('Error fetching document:', error)
      router.push('/')
    } finally {
      setLoading(false)
    }
  }

  const updateTitle = async (newTitle: string) => {
    if (!hasSupabase) {
      setTitle(newTitle)
      return
    }
    if (!supabase) return
    try {
      const { error } = await supabase
        .from('documents')
        .update({ title: newTitle, updated_at: new Date().toISOString() })
        .eq('id', documentId)

      if (error) throw error
      setTitle(newTitle)
    } catch (error) {
      console.error('Error updating title:', error)
    }
  }

  const shareLocalDocument = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      alert('Document link copied to clipboard!')
    } catch (error) {
      console.error('Failed to copy link:', error)
      alert('Failed to copy link. Please copy the URL manually.')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="spinner"></div>
      </div>
    )
  }

  if (!document) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900">Document not found</h2>
          <p className="mt-2 text-gray-600">The document you're looking for doesn't exist.</p>
          <button
            onClick={() => router.push('/')}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Go Home
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/')}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <svg
                  className="w-5 h-5 text-gray-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 19l-7-7m0 0l7-7m-7 7h18"
                  />
                </svg>
              </button>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={() => updateTitle(title)}
                className="text-xl font-semibold text-gray-900 bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-2 py-1"
                placeholder={hasSupabase ? "Document title" : "Local Document"}
                disabled={!hasSupabase}
              />
            </div>

            <div className="flex items-center gap-2">
              {/* Presence */}
              <Presence documentId={documentId} userId={user?.id} />

              {/* Comments Toggle */}
              <button
                onClick={() => setShowComments(!showComments)}
                disabled={!hasSupabase}
                className={`p-2 rounded-lg transition-colors ${
                  !hasSupabase
                    ? 'text-gray-400 cursor-not-allowed'
                    : showComments
                    ? 'bg-blue-100 text-blue-600'
                    : 'hover:bg-gray-100 text-gray-600'
                }`}
                title={hasSupabase ? 'Comments' : 'Comments require Supabase setup'}
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  />
                </svg>
              </button>

              {/* Version History Toggle */}
              <button
                onClick={() => setShowVersionHistory(!showVersionHistory)}
                disabled={!hasSupabase}
                className={`p-2 rounded-lg transition-colors ${
                  !hasSupabase
                    ? 'text-gray-400 cursor-not-allowed'
                    : showVersionHistory
                    ? 'bg-blue-100 text-blue-600'
                    : 'hover:bg-gray-100 text-gray-600'
                }`}
                title={hasSupabase ? 'Version History' : 'Version History requires Supabase setup'}
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </button>

              {/* Share Button */}
              <button
                onClick={hasSupabase ? () => setShowShareModal(true) : shareLocalDocument}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg transition-colors bg-blue-600 text-white hover:bg-blue-700"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                  />
                </svg>
                Share
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex">
        {/* Editor */}
        <main className={`flex-1 transition-all ${showComments || showVersionHistory ? 'mr-80' : ''}`}>
          <div className="max-w-4xl mx-auto py-8 px-4">
            <Editor documentId={documentId} userId={user?.id} />
          </div>
        </main>

        {/* Sidebar */}
        {(showComments || showVersionHistory) && hasSupabase && (
          <aside className="fixed right-0 top-16 w-80 h-[calc(100vh-4rem)] bg-white border-l border-gray-200 overflow-y-auto">
            {showComments && (
              <Comments documentId={documentId} userId={user?.id} />
            )}
            {showVersionHistory && (
              <VersionHistory documentId={documentId} />
            )}
          </aside>
        )}
      </div>

      {/* Share Modal */}
      {showShareModal && hasSupabase && (
        <ShareModal
          documentId={documentId}
          userId={user?.id}
          onClose={() => setShowShareModal(false)}
        />
      )}
    </div>
  )
}
