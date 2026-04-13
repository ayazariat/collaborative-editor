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
        <div className="spinner" />
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