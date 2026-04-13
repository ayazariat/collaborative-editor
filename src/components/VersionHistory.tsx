'use client'

import { useEffect, useState } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

interface VersionHistoryProps {
  documentId: string
}

interface Version {
  id: string
  content: any
  created_at: string
  user_id: string
  user?: {
    email: string
  }
}

export default function VersionHistory({ documentId }: VersionHistoryProps) {
  const [versions, setVersions] = useState<Version[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedVersion, setSelectedVersion] = useState<Version | null>(null)
  const supabase = createClientComponentClient()

  useEffect(() => {
    fetchVersions()
  }, [documentId])

  const fetchVersions = async () => {
    try {
      const { data, error } = await supabase
        .from('document_versions')
        .select(`
          *,
          user:users(email)
        `)
        .eq('document_id', documentId)
        .order('created_at', { ascending: false })
        .limit(20)

      if (error) throw error
      setVersions(data || [])
    } catch (error) {
      console.error('Error fetching versions:', error)
    } finally {
      setLoading(false)
    }
  }

  const restoreVersion = async (version: Version) => {
    // This would restore the document to a previous version
    // Implementation depends on how you want to handle version restoration
    alert('Version restoration feature - implement based on your needs')
  }

  if (loading) {
    return (
      <div className="p-4">
        <div className="spinner mx-auto"></div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">Version History</h3>
        <p className="text-sm text-gray-500 mt-1">
          {versions.length} version{versions.length !== 1 ? 's' : ''} saved
        </p>
      </div>

      {/* Versions List */}
      <div className="flex-1 overflow-y-auto">
        {versions.length === 0 ? (
          <div className="p-4 text-center text-gray-500">
            No versions saved yet. Versions are created automatically.
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {versions.map((version) => (
              <div
                key={version.id}
                className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${
                  selectedVersion?.id === version.id ? 'bg-blue-50' : ''
                }`}
                onClick={() => setSelectedVersion(version)}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-gray-900">
                      {new Date(version.created_at).toLocaleString()}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {version.user?.email || 'Unknown User'}
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      restoreVersion(version)
                    }}
                    className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                  >
                    Restore
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Version Preview */}
      {selectedVersion && (
        <div className="border-t border-gray-200 p-4">
          <h4 className="text-sm font-medium text-gray-900 mb-2">Preview</h4>
          <div className="bg-gray-50 rounded-lg p-3 max-h-40 overflow-y-auto">
            <pre className="text-xs text-gray-700 whitespace-pre-wrap">
              {JSON.stringify(selectedVersion.content, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  )
}
