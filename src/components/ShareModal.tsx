export { default } from './editor/ShareModal'

interface Collaborator {
  id: string
  user_id: string
  role: string
  user?: {
    email: string
  }
}

export default function ShareModal({ documentId, userId, onClose }: ShareModalProps) {
  const [collaborators, setCollaborators] = useState<Collaborator[]>([])
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'editor' | 'viewer'>('editor')
  const [loading, setLoading] = useState(true)
  const [shareLink, setShareLink] = useState('')
  const supabase = createClientComponentClient()

  useEffect(() => {
    fetchCollaborators()
    generateShareLink()
  }, [documentId])

  const fetchCollaborators = async () => {
    try {
      const { data, error } = await supabase
        .from('collaborators')
        .select(`
          *,
          user:users(email)
        `)
        .eq('document_id', documentId)

      if (error) throw error
      setCollaborators(data || [])
    } catch (error) {
      console.error('Error fetching collaborators:', error)
    } finally {
      setLoading(false)
    }
  }

  const generateShareLink = () => {
    const link = `${window.location.origin}/editor/${documentId}`
    setShareLink(link)
  }

  const addCollaborator = async () => {
    if (!email.trim()) return

    try {
      // First, find or create user
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('email', email)
        .single()

      if (userError) {
        alert('User not found. They need to sign up first.')
        return
      }

      // Add collaborator
      const { data, error } = await supabase
        .from('collaborators')
        .insert([
          {
            document_id: documentId,
            user_id: userData.id,
            role: role,
          },
        ])
        .select(`
          *,
          user:users(email)
        `)
        .single()

      if (error) throw error
      if (data) {
        setCollaborators([...collaborators, data])
        setEmail('')
      }
    } catch (error) {
      console.error('Error adding collaborator:', error)
    }
  }

  const removeCollaborator = async (collaboratorId: string) => {
    try {
      const { error } = await supabase
        .from('collaborators')
        .delete()
        .eq('id', collaboratorId)

      if (error) throw error
      setCollaborators(collaborators.filter((c) => c.id !== collaboratorId))
    } catch (error) {
      console.error('Error removing collaborator:', error)
    }
  }

  const updateRole = async (collaboratorId: string, newRole: string) => {
    try {
      const { error } = await supabase
        .from('collaborators')
        .update({ role: newRole })
        .eq('id', collaboratorId)

      if (error) throw error
      setCollaborators(
        collaborators.map((c) =>
          c.id === collaboratorId ? { ...c, role: newRole } : c
        )
      )
    } catch (error) {
      console.error('Error updating role:', error)
    }
  }

  const copyLink = () => {
    navigator.clipboard.writeText(shareLink)
    alert('Link copied to clipboard!')
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Share Document</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
          >
            <svg
              className="w-5 h-5 text-gray-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          {/* Share Link */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Share Link
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={shareLink}
                readOnly
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-sm"
              />
              <button
                onClick={copyLink}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
              >
                Copy
              </button>
            </div>
          </div>

          {/* Add Collaborator */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Add Collaborator
            </label>
            <div className="flex gap-2">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter email address"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as 'editor' | 'viewer')}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              >
                <option value="editor">Editor</option>
                <option value="viewer">Viewer</option>
              </select>
              <button
                onClick={addCollaborator}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
              >
                Add
              </button>
            </div>
          </div>

          {/* Collaborators List */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Collaborators ({collaborators.length})
            </label>
            {loading ? (
              <div className="flex justify-center py-4">
                <div className="spinner"></div>
              </div>
            ) : collaborators.length === 0 ? (
              <div className="text-center py-4 text-gray-500 text-sm">
                No collaborators yet
              </div>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {collaborators.map((collaborator) => (
                  <div
                    key={collaborator.id}
                    className="flex items-center justify-between p-2 bg-gray-50 rounded-lg"
                  >
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {collaborator.user?.email || 'Unknown User'}
                      </div>
                      <select
                        value={collaborator.role}
                        onChange={(e) =>
                          updateRole(collaborator.id, e.target.value)
                        }
                        className="text-xs text-gray-500 bg-transparent border-none focus:outline-none"
                      >
                        <option value="editor">Editor</option>
                        <option value="viewer">Viewer</option>
                      </select>
                    </div>
                    <button
                      onClick={() => removeCollaborator(collaborator.id)}
                      className="p-1 text-gray-400 hover:text-red-600 transition-colors"
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
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end p-4 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
