const WebSocket = require('ws')
const http = require('http')
const url = require('url')

// Configuration
const PORT = process.env.WS_PORT || 1234
const PING_INTERVAL = 30000 // 30 seconds
const PONG_TIMEOUT = 10000 // 10 seconds

// Room management
const rooms = new Map()

// Create HTTP server
const server = http.createServer((req, res) => {
  // Health check endpoint
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({
      status: 'ok',
      rooms: rooms.size,
      connections: Array.from(rooms.values()).reduce((sum, room) => sum + room.size, 0)
    }))
    return
  }

  // CORS headers for development
  res.writeHead(200, {
    'Content-Type': 'text/plain',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  })
  res.end('WebSocket Relay Server Running')
})

// Create WebSocket server
const wss = new WebSocket.Server({ server })

// Handle new connections
wss.on('connection', (ws, req) => {
  const parsedUrl = url.parse(req.url, true)
  const documentId = parsedUrl.pathname.slice(1) // Remove leading '/'

  if (!documentId) {
    ws.close(1008, 'Document ID required')
    return
  }

  if (!rooms.has(documentId)) {
    rooms.set(documentId, new Set())
  }
  const room = rooms.get(documentId)
  room.add(ws)

  console.log(`Client connected to document: ${documentId} (Total in room: ${room.size})`)

  ws.isAlive = true
  ws.on('pong', () => {
    ws.isAlive = true
  })

  ws.on('message', (message) => {
    try {
      room.forEach((client) => {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(message)
        }
      })
    } catch (error) {
      console.error('Error broadcasting message:', error)
    }
  })

  ws.on('close', () => {
    room.delete(ws)
    console.log(`Client disconnected from document: ${documentId} (Remaining in room: ${room.size})`)

    if (room.size === 0) {
      rooms.delete(documentId)
    }
  })

  ws.on('error', (error) => {
    console.error('WebSocket error:', error)
    room.delete(ws)
  })
})

// Ping/pong interval to detect dead connections
const interval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) {
      return ws.terminate()
    }
    ws.isAlive = false
    ws.ping()
  })
}, PING_INTERVAL)

// Clean up on server close
wss.on('close', () => {
  clearInterval(interval)
})

// Start server
server.listen(PORT, () => {
  console.log(`WebSocket Relay Server running on port ${PORT}`)
  console.log(`Health check available at http://localhost:${PORT}/health`)
  console.log('Waiting for connections...')
})

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...')
  wss.close(() => {
    server.close(() => {
      console.log('Server closed')
      process.exit(0)
    })
  })
})

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...')
  wss.close(() => {
    server.close(() => {
      console.log('Server closed')
      process.exit(0)
    })
  })
})
