'use client'

import { useEffect, useMemo, useState } from 'react'

interface PresenceBarProps {
  awareness: any
  currentUserId: string
}

interface PresenceEntry {
  name: string
  color: string
  userId: string
  email?: string
}

export default function PresenceBar({ awareness, currentUserId }: PresenceBarProps) {
  const [peers, setPeers] = useState<PresenceEntry[]>([])

  useEffect(() => {
    const update = () => {
      const states = Array.from(awareness.getStates().values()) as any[]
      const entries = states
        .filter((entry) => entry.user && entry.user.userId !== currentUserId)
        .map((entry) => entry.user as PresenceEntry)

      setPeers(entries)
    }

    awareness.on('change', update)
    update()

    return () => {
      awareness.off('change', update)
    }
  }, [awareness, currentUserId])

  const count = peers.length

  const avatars = useMemo(() => peers.slice(0, 5), [peers])

  if (count === 0) {
    return (
      <span className="text-sm text-gray-500">You are alone</span>
    )
  }

  return (
    <div className="flex items-center gap-2">      
      <div className="flex -space-x-2">        
        {avatars.map((peer) => (
          <div
            key={peer.userId}
            className="w-8 h-8 rounded-full border-2 border-white text-white text-xs font-semibold flex items-center justify-center"
            style={{ backgroundColor: peer.color }}
            title={peer.name || peer.email || 'Collaborator'}
          >
            {(peer.name || peer.email || 'U').charAt(0).toUpperCase()
              ?? 'U'}
          </div>
        ))}
      </div>
      <span className="text-sm text-gray-600">
        {count} active {count === 1 ? 'user' : 'users'}
      </span>
    </div>
  )
}
