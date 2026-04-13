'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Auth } from '@supabase/auth-ui-react'
import { ThemeSupa } from '@supabase/auth-ui-shared'

interface Document {
  id: string
  title: string
  owner_id: string
  created_at: string
  updated_at: string
}

interface User {
  id: string
  email: string
  user_metadata?: {
    full_name?: string
    avatar_url?: string
  }
}

export default function HomePage() {
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<User | null>(null)
  const [showAuth, setShowAuth] = useState(false)
  const hasSupabase = !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const supabase = hasSupabase ? createClientComponentClient() : null

  useEffect(() => {
    if (hasSupabase) {
      checkUser()
      const { data: { subscription } } = supabase!.auth.onAuthStateChange((event, session) => {
        setUser(session?.user ?? null)
        if (session?.user) {
          setShowAuth(false)
          fetchDocuments()
        } else {
          setDocuments([])
          setLoading(false)
        }
      })
      return () => subscription.unsubscribe()
    } else {
      setLoading(false)
    }
  }, [])

  const checkUser = async () => {
    if (!supabase) return
    try {
      const { data: { user }, error } = await supabase.auth.getUser()
      if (error) throw error
      setUser(user)
      if (user) {
        fetchDocuments()
      } else {
        setLoading(false)
      }
    } catch (error) {
      console.error('Error checking user:', error)
      setLoading(false)
    }
  }

  const signOut = async () => {
    if (!supabase) return
    try {
      await supabase.auth.signOut()
      setUser(null)
      setDocuments([])
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  const fetchDocuments = async () => {
    if (!supabase) return
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .order('updated_at', { ascending: false })

      if (error) throw error
      setDocuments(data || [])
    } catch (error) {
      console.error('Error fetching documents:', error)
    } finally {
      setLoading(false)
    }
  }

  const createDocument = async () => {
    if (hasSupabase && user) {
      try {
        const { data, error } = await supabase
          .from('documents')
          .insert([
            {
              title: 'Untitled Document',
              owner_id: user?.id,
            },
          ])
          .select()
          .single()

        if (error) throw error
        if (data) {
          window.location.href = `/editor/${data.id}`
        }
      } catch (error) {
        console.error('Error creating document:', error)
      }
    } else {
      // Create local document for testing
      const localDocId = `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      window.location.href = `/editor/${localDocId}`
    }
  }

  const deleteDocument = async (id: string) => {
    if (!supabase) return
    try {
      const { error } = await supabase
        .from('documents')
        .delete()
        .eq('id', id)

      if (error) throw error
      setDocuments(documents.filter(doc => doc.id !== id))
    } catch (error) {
      console.error('Error deleting document:', error)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  // Show authentication UI if Supabase is configured but user is not logged in
  if (hasSupabase && !user) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="flex justify-center">
            <div className="w-16 h-16 bg-blue-600 rounded-lg flex items-center justify-center">
              <svg
                className="w-8 h-8 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Collaborative Editor
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Sign in to create and collaborate on documents
          </p>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
            <Auth
              supabaseClient={supabase!}
              appearance={{ theme: ThemeSupa }}
              providers={['google', 'github']}
              redirectTo={`${window.location.origin}/`}
            />
          </div>
        </div>

        <div className="mt-8 text-center">
          <button
            onClick={() => setShowAuth(false)}
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            Continue without signing in →
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-gray-900">Collaborative Editor</h1>
            </div>
            {user && (
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  {user.user_metadata?.avatar_url && (
                    <img
                      src={user.user_metadata.avatar_url}
                      alt="Avatar"
                      className="w-8 h-8 rounded-full"
                    />
                  )}
                  <span className="text-sm text-gray-600">
                    {user.user_metadata?.full_name || user.email}
                  </span>
                </div>
                <button
                  onClick={signOut}
                  className="text-sm text-gray-600 hover:text-gray-900 px-3 py-1 rounded-md hover:bg-gray-100 transition-colors"
                >
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Message */}
        {user && (
          <div className="mb-8 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              Welcome back, {user.user_metadata?.full_name || user.email?.split('@')[0]}!
            </h2>
            <p className="text-gray-600">
              Create a new document or continue working on your existing ones.
            </p>
          </div>
        )}

        {/* Create Document Button */}
        <div className="mb-8">
          <button
            onClick={createDocument}
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
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
                d="M12 4v16m8-8H4"
              />
            </svg>
            {user ? 'New Document' : 'New Local Document'}
          </button>
          {!user && hasSupabase && (
            <p className="mt-2 text-sm text-gray-600">
              Sign in to save documents permanently and collaborate with others.
            </p>
          )}
          {!hasSupabase && (
            <p className="mt-2 text-sm text-gray-600">
              Running in local mode. Set up Supabase for persistent documents and collaboration.
            </p>
          )}
        </div>

        {/* Documents Grid */}
        {documents.length === 0 ? (
          <div className="text-center py-12">
            <svg
              className="mx-auto h-16 w-16 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <h3 className="mt-4 text-lg font-medium text-gray-900">No documents yet</h3>
            <p className="mt-2 text-gray-500">
              {user ? 'Create your first document to get started.' : 'Create a local document to try the editor.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow"
              >
                <div className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <Link
                        href={`/editor/${doc.id}`}
                        className="text-lg font-medium text-gray-900 hover:text-blue-600 truncate block"
                      >
                        {doc.title}
                      </Link>
                      <p className="mt-1 text-sm text-gray-500">
                        Updated {new Date(doc.updated_at).toLocaleDateString()}
                      </p>
                    </div>
                    <button
                      onClick={() => deleteDocument(doc.id)}
                      className="ml-2 p-2 text-gray-400 hover:text-red-600 transition-colors rounded-md hover:bg-red-50"
                      title="Delete document"
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
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
                <div className="bg-gray-50 px-6 py-3">
                  <Link
                    href={`/editor/${doc.id}`}
                    className="text-sm font-medium text-blue-600 hover:text-blue-500"
                  >
                    Open document →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
