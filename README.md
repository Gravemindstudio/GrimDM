# GrimDM WebSocket Server

A real-time WebSocket server for GrimDM online sessions.

## Quick Deploy Options

### Option 1: Render (Recommended - Free)
1. Fork this repository
2. Go to [render.com](https://render.com)
3. Create a new Web Service
4. Connect your GitHub repository
5. Set build command: `npm install`
6. Set start command: `npm start`
7. Deploy!

### Option 2: Railway
1. Go to [railway.app](https://railway.app)
2. Create new project
3. Deploy from GitHub
4. Add environment variables if needed

### Option 3: Heroku
1. Install Heroku CLI
2. Run: `heroku create your-app-name`
3. Run: `git push heroku main`
4. Your server will be available at: `wss://your-app-name.herokuapp.com`

### Option 4: Local Testing
```bash
cd server
npm install
npm start
```

## Environment Variables

- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Environment (production/development)

## API Endpoints

- `GET /api/health` - Server health check
- `GET /api/sessions` - List public sessions
- `WS /` - WebSocket endpoint for real-time communication

## WebSocket Events

### Client to Server:
- `session_create` - Create new session
- `session_join` - Join existing session
- `session_list` - Get list of public sessions
- `state_update` - Update game state
- `chat_message` - Send chat message
- `ping` - Keep connection alive

### Server to Client:
- `session_created` - Session creation confirmation
- `player_join` - Player joined session
- `player_leave` - Player left session
- `session_list` - List of public sessions
- `state_update` - Game state update
- `chat_message` - Chat message
- `pong` - Response to ping

## Connection URL Format

```
wss://your-server.com/?sessionId=SESSION_ID&playerId=PLAYER_ID&playerName=PLAYER_NAME&isHost=true/false
```

## Features

- ✅ Real-time WebSocket communication
- ✅ Session management
- ✅ Player join/leave handling
- ✅ Public session discovery
- ✅ Automatic session cleanup
- ✅ Health monitoring
- ✅ CORS support
- ✅ Error handling

## Security Notes

- Add authentication if needed
- Rate limiting for production
- Input validation
- HTTPS/WSS for production 