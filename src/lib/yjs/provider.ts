import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'

interface YjsProviderEntry {
  ydoc: Y.Doc
  provider: WebsocketProvider
  clients: number
}

const providerCache = new Map<string, YjsProviderEntry>()

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:1234'

export function getOrCreateYjsProvider(documentId: string) {
  if (providerCache.has(documentId)) {
    const entry = providerCache.get(documentId)!
    entry.clients += 1
    return entry
  }

  const ydoc = new Y.Doc()
  const provider = new WebsocketProvider(WS_URL, documentId, ydoc, {
    connect: true,
    maxBackoffTime: 10000,
  })

  const entry: YjsProviderEntry = {
    ydoc,
    provider,
    clients: 1,
  }

  providerCache.set(documentId, entry)

  provider.on('status', (event: { status: string }) => {
    console.debug(`[Yjs] ${documentId} status:`, event.status)
  })

  provider.on('synced', () => {
    console.debug(`[Yjs] ${documentId} synced`)
  })

  return entry
}

export function releaseYjsProvider(documentId: string) {
  const entry = providerCache.get(documentId)
  if (!entry) return

  entry.clients -= 1
  if (entry.clients <= 0) {
    entry.provider.destroy()
    entry.ydoc.destroy()
    providerCache.delete(documentId)
  }
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = typeof window !== 'undefined' ? window.atob(base64) : Buffer.from(base64, 'base64').toString('binary')
  const len = binary.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

function uint8ArrayToBase64(buffer: Uint8Array) {
  let binary = ''
  const len = buffer.byteLength
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(buffer[i])
  }
  return typeof window !== 'undefined' ? window.btoa(binary) : Buffer.from(binary, 'binary').toString('base64')
}

export function encodeStateToBase64(ydoc: Y.Doc) {
  const update = Y.encodeStateAsUpdate(ydoc)
  return uint8ArrayToBase64(update)
}

export function applyBase64State(ydoc: Y.Doc, base64: string) {
  if (!base64) return
  try {
    const update = base64ToUint8Array(base64)
    Y.applyUpdate(ydoc, update)
  } catch (error) {
    console.error('[Yjs] applyState error', error)
  }
}
