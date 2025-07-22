const WebSocket = require('ws');
const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for all routes
app.use(cors());
app.use(express.json());

// Create HTTP server
const server = require('http').createServer(app);

// Create WebSocket server
const wss = new WebSocket.Server({ server });

// Store active sessions
const sessions = new Map();
const clients = new Map();

// Helper function to generate session ID
function generateSessionId() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Helper function to get random location
function getRandomLocation() {
  const locations = [
    'United States', 'Canada', 'United Kingdom', 'Germany', 'France', 
    'Australia', 'Japan', 'South Korea', 'Brazil', 'India', 'Mexico',
    'Netherlands', 'Sweden', 'Norway', 'Denmark', 'Finland', 'Italy',
    'Spain', 'Portugal', 'Poland', 'Czech Republic', 'Austria', 'Switzerland'
  ];
  return locations[Math.floor(Math.random() * locations.length)];
}

// WebSocket connection handler
wss.on('connection', (ws, req) => {
  console.log('🌐 New WebSocket connection established');
  
  const clientId = uuidv4();
  
  // Parse query parameters
  const url = new URL(req.url, `http://${req.headers.host}`);
  const sessionId = url.searchParams.get('sessionId');
  const playerId = url.searchParams.get('playerId');
  const playerName = url.searchParams.get('playerName');
  const isHost = url.searchParams.get('isHost') === 'true';
  
  console.log('🌐 Connection details:', {
    clientId,
    sessionId,
    playerId,
    playerName,
    isHost
  });
  
  // Handle different connection types
  if (sessionId && playerId && playerName) {
    if (isHost) {
      // DM creating/joining a session
      handleDMConnection(ws, clientId, sessionId, playerId, playerName);
    } else {
      // Player joining a session
      handlePlayerConnection(ws, clientId, sessionId, playerId, playerName);
    }
  } else {
    // Client just browsing sessions (no session parameters)
    handleBrowseConnection(ws, clientId);
  }
  
  // Handle incoming messages
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data);
      console.log('📨 Received message:', message.type, 'from', playerName || 'browser');
      handleMessage(ws, clientId, message);
    } catch (error) {
      console.error('❌ Error parsing message:', error);
    }
  });
  
  // Handle client disconnect
  ws.on('close', (code, reason) => {
    console.log('👋 Client disconnected:', playerName || 'browser', 'code:', code, 'reason:', reason);
    handleClientDisconnect(clientId, sessionId, playerId);
  });
  
  // Handle errors
  ws.on('error', (error) => {
    console.error('💥 WebSocket error:', error);
  });
});

function handleDMConnection(ws, clientId, sessionId, playerId, playerName) {
  console.log('👑 DM connecting to session:', sessionId);
  
  // Create or get session
  let session = sessions.get(sessionId);
  if (!session) {
    session = {
      id: sessionId,
      hostId: playerId,
      players: [],
      maxPlayers: 8,
      createdAt: new Date(),
      isActive: true,
      isPublic: true,
      campaignName: 'Campaign',
      dmName: playerName
    };
    sessions.set(sessionId, session);
    console.log('✅ Created new session:', sessionId);
  }
  
  // Add DM to session
  const dmPlayer = {
    id: playerId,
    name: playerName,
    isConnected: true,
    lastSeen: new Date(),
    location: getRandomLocation()
  };
  
  session.players = [dmPlayer]; // DM is always first player
  session.hostId = playerId;
  session.dmName = playerName;
  
  // Store client info
  clients.set(clientId, {
    ws,
    sessionId,
    playerId,
    playerName,
    isHost: true
  });
  
  // Send confirmation to DM
  const response = {
    type: 'session_created',
    sessionId,
    success: true,
    data: {
      message: 'Session created successfully',
      session: session
    },
    timestamp: new Date()
  };
  
  ws.send(JSON.stringify(response));
  console.log('✅ DM session confirmed:', sessionId);
}

function handlePlayerConnection(ws, clientId, sessionId, playerId, playerName) {
  console.log('👤 Player connecting to session:', sessionId);
  
  const session = sessions.get(sessionId);
  if (!session) {
    console.log('❌ Session not found:', sessionId);
    ws.close(1008, 'Session does not exist');
    return;
  }
  
  if (!session.hostId || session.players.length === 0) {
    console.log('❌ Session has no DM:', sessionId);
    ws.close(1008, 'Session has no DM');
    return;
  }
  
  if (session.players.length >= session.maxPlayers) {
    console.log('❌ Session is full:', sessionId);
    ws.close(1008, 'Session is full');
    return;
  }
  
  // Add player to session
  const newPlayer = {
    id: playerId,
    name: playerName,
    isConnected: true,
    lastSeen: new Date(),
    location: getRandomLocation()
  };
  
  session.players.push(newPlayer);
  
  // Store client info
  clients.set(clientId, {
    ws,
    sessionId,
    playerId,
    playerName,
    isHost: false
  });
  
  // Don't send player_join message here - wait for session_join message
  console.log('✅ Player connected to session:', sessionId, playerName);
}

function handleBrowseConnection(ws, clientId) {
  console.log('🔍 Client connecting for session browsing');
  
  // Store client info for browsing
  clients.set(clientId, {
    ws,
    sessionId: null,
    playerId: null,
    playerName: 'Browser',
    isHost: false,
    isBrowser: true
  });
  
  console.log('✅ Browser client connected, clientId:', clientId);
}

function handleMessage(ws, clientId, message) {
  const client = clients.get(clientId);
  if (!client) return;
  
  switch (message.type) {
    case 'session_create':
      handleSessionCreate(ws, clientId, message);
      break;
    case 'session_join':
      handleSessionJoin(ws, clientId, message);
      break;
    case 'session_list':
      handleSessionList(ws, clientId);
      break;
    case 'state_update':
      handleStateUpdate(ws, clientId, message);
      break;
    case 'chat_message':
      handleChatMessage(ws, clientId, message);
      break;
    case 'ping':
      ws.send(JSON.stringify({ type: 'pong', timestamp: new Date() }));
      break;
    default:
      console.log('❓ Unknown message type:', message.type);
  }
}

function handleSessionCreate(ws, clientId, message) {
  const sessionId = message.sessionId;
  const sessionData = message.data;
  
  const session = {
    id: sessionId,
    hostId: message.playerId,
    players: [{
      id: message.playerId,
      name: sessionData.dmName,
      isConnected: true,
      lastSeen: new Date(),
      location: getRandomLocation()
    }],
    maxPlayers: sessionData.maxPlayers || 8,
    createdAt: new Date(),
    isActive: true,
    isPublic: sessionData.isPublic || false,
    campaignName: sessionData.sessionName,
    dmName: sessionData.dmName
  };
  
  sessions.set(sessionId, session);
  
  const response = {
    type: 'session_created',
    sessionId,
    success: true,
    data: { session },
    timestamp: new Date()
  };
  
  ws.send(JSON.stringify(response));
  console.log('✅ Session created via message:', sessionId);
}

function handleSessionJoin(ws, clientId, message) {
  const sessionId = message.sessionId;
  const session = sessions.get(sessionId);
  
  if (!session) {
    ws.send(JSON.stringify({
      type: 'session_join',
      sessionId,
      success: false,
      error: 'Session not found',
      timestamp: new Date()
    }));
    return;
  }
  
  const newPlayer = {
    id: message.playerId,
    name: message.data.playerName,
    isConnected: true,
    lastSeen: new Date(),
    location: getRandomLocation()
  };
  
  session.players.push(newPlayer);
  
  // Send player_join message to the joining player (this is what the client expects)
  ws.send(JSON.stringify({
    type: 'player_join',
    sessionId,
    playerId: message.playerId,
    data: { player: newPlayer, session },
    timestamp: new Date()
  }));
  
  // Notify all other clients about the new player
  broadcastToSession(sessionId, {
    type: 'player_join',
    sessionId,
    playerId: message.playerId,
    data: { player: newPlayer, session },
    timestamp: new Date()
  }, clientId);
  
  console.log('✅ Player joined via message:', sessionId, newPlayer.name);
}

function handleSessionList(ws, clientId) {
  console.log('📋 Handling session list request from client:', clientId);
  
  const publicSessions = Array.from(sessions.values())
    .filter(session => session.isPublic && session.isActive)
    .map(session => ({
      id: session.id,
      hostId: session.hostId,
      players: session.players,
      maxPlayers: session.maxPlayers,
      createdAt: session.createdAt,
      isActive: session.isActive,
      isPublic: session.isPublic,
      campaignName: session.campaignName,
      dmName: session.dmName
    }));
  
  const response = {
    type: 'session_list',
    sessionId: 'public',
    data: { sessions: publicSessions },
    timestamp: new Date()
  };
  
  try {
    ws.send(JSON.stringify(response));
    console.log('📋 Sent session list:', publicSessions.length, 'sessions to client:', clientId);
  } catch (error) {
    console.error('❌ Error sending session list:', error);
  }
}

function handleStateUpdate(ws, clientId, message) {
  // Broadcast state updates to all clients in the session
  broadcastToSession(message.sessionId, message);
  console.log('🔄 State update broadcasted:', message.sessionId);
}

function handleChatMessage(ws, clientId, message) {
  // Broadcast chat messages to all clients in the session
  broadcastToSession(message.sessionId, message);
  console.log('💬 Chat message broadcasted:', message.sessionId);
}

function handleClientDisconnect(clientId, sessionId, playerId) {
  const client = clients.get(clientId);
  if (!client) return;
  
  console.log('👋 Client disconnected:', client.playerName, 'from session:', sessionId);
  
  // Remove client from clients map
  clients.delete(clientId);
  
  // Remove player from session
  if (sessionId && playerId) {
    const session = sessions.get(sessionId);
    if (session) {
      session.players = session.players.filter(p => p.id !== playerId);
      
      // If no players left, remove session
      if (session.players.length === 0) {
        sessions.delete(sessionId);
        console.log('🗑️ Session removed (no players):', sessionId);
      } else {
        // Notify remaining players
        broadcastToSession(sessionId, {
          type: 'player_leave',
          sessionId,
          playerId,
          data: { session },
          timestamp: new Date()
        });
        console.log('👋 Player leave notification sent:', sessionId);
      }
    }
  }
}

function broadcastToSession(sessionId, message, excludeClientId = null) {
  let sentCount = 0;
  
  clients.forEach((client, clientId) => {
    // Check if client is in the correct session and not the excluded client
    if (client.sessionId === sessionId && client.ws.readyState === WebSocket.OPEN && clientId !== excludeClientId) {
      try {
        client.ws.send(JSON.stringify(message));
        sentCount++;
        console.log('📤 Sent to client:', clientId, 'player:', client.playerName);
      } catch (error) {
        console.error('❌ Error sending message to client:', error);
      }
    }
  });
  
  console.log('📤 Broadcasted to', sentCount, 'clients in session:', sessionId, 'excluded:', excludeClientId);
}

// HTTP endpoints for session management
app.get('/api/sessions', (req, res) => {
  const publicSessions = Array.from(sessions.values())
    .filter(session => session.isPublic && session.isActive)
    .map(session => ({
      id: session.id,
      hostId: session.hostId,
      players: session.players,
      maxPlayers: session.maxPlayers,
      createdAt: session.createdAt,
      isActive: session.isActive,
      isPublic: session.isPublic,
      campaignName: session.campaignName,
      dmName: session.dmName
    }));
  
  res.json({ sessions: publicSessions });
});

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    activeSessions: sessions.size,
    activeClients: clients.size,
    timestamp: new Date()
  });
});

// Start server
server.listen(PORT, () => {
  console.log('🚀 GrimDM WebSocket Server started on port', PORT);
  console.log('🌐 WebSocket URL: ws://localhost:' + PORT);
  console.log('📊 Health check: http://localhost:' + PORT + '/api/health');
  console.log('📋 Sessions list: http://localhost:' + PORT + '/api/sessions');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 Shutting down server...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
}); 