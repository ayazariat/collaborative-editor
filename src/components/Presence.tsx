'use client'

import { useEffect, useState } from 'react'
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'

interface PresenceProps {
  documentId: string
  userId?: string
}

interface User {
  name: string
  color: string
  userId: string
}

export default function Presence({ documentId, userId }: PresenceProps) {
  const [users, setUsers] = useState<User[]>([])
  const [provider, setProvider] = useState<WebsocketProvider | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string>('')

  // Generate a temporary user ID for local documents once on mount
  useEffect(() => {
    if (!currentUserId) {
      setCurrentUserId(userId || `local-user-${Math.random().toString(36).substr(2, 9)}`)
    }
  }, []) // Only run once on mount

  useEffect(() => {
    if (!currentUserId) return

    // Create a temporary Yjs doc for presence
    const doc = new Y.Doc()
    const wsProvider = new WebsocketProvider(
      process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:1234',
      documentId,
      doc
    )

    setProvider(wsProvider)

    // Update users list when awareness changes
    const updateUsers = () => {
      const states = wsProvider.awareness.getStates()
      const userList: User[] = []

      states.forEach((state, clientId) => {
        if (state.user && state.user.userId !== currentUserId) {
          userList.push(state.user as User)
        }
      })

      setUsers(userList)
    }

    wsProvider.awareness.on('change', updateUsers)
    updateUsers()

    return () => {
      wsProvider.awareness.off('change', updateUsers)
      wsProvider.destroy()
      doc.destroy()
    }
  }, [documentId, currentUserId])

  if (users.length === 0) {
    return null
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex -space-x-2">
        {users.slice(0, 5).map((user, index) => (
          <div
            key={user.userId}
            className="w-8 h-8 rounded-full border-2 border-white flex items-center justify-center text-white text-xs font-medium"
            style={{ backgroundColor: user.color }}
            title={user.name}
          >
            {user.name.charAt(0).toUpperCase()}
          </div>
        ))}
        {users.length > 5 && (
          <div className="w-8 h-8 rounded-full border-2 border-white bg-gray-200 flex items-center justify-center text-gray-600 text-xs font-medium">
            +{users.length - 5}
          </div>
        )}
      </div>
      <span className="text-sm text-gray-600">
        {users.length} {users.length === 1 ? 'user' : 'users'} editing
      </span>
    </div>
  )
}
