/**
 * EventHub Durable Object — real-time WebSocket pub/sub for notifications.
 *
 * Each user gets their own Durable Object instance (keyed by email).
 * When a clinician sends a notification, the worker calls broadcast()
 * on the patient's DO, which pushes to all connected WebSocket clients instantly.
 *
 * Clients connect via: GET /api/ws (upgraded to WebSocket)
 * Server pushes:       { type: "notification", data: {...} }
 *                      { type: "questionnaire", data: {...} }
 *                      { type: "ping" }
 */

export class EventHub {
  constructor(state, env) {
    this.state = state;
    this.sessions = new Set(); // active WebSocket connections
  }

  async fetch(request) {
    const url = new URL(request.url);

    // WebSocket upgrade
    if (url.pathname === '/ws') {
      if (request.headers.get('Upgrade') !== 'websocket') {
        return new Response('Expected WebSocket upgrade', { status: 426 });
      }

      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);

      this.state.acceptWebSocket(server);
      this.sessions.add(server);

      // Send a welcome message
      server.send(JSON.stringify({ type: 'connected', timestamp: new Date().toISOString() }));

      return new Response(null, { status: 101, webSocket: client });
    }

    // Broadcast endpoint (called internally by the worker)
    if (url.pathname === '/broadcast') {
      const body = await request.json();
      this.broadcast(body);
      return new Response('OK');
    }

    return new Response('Not found', { status: 404 });
  }

  broadcast(message) {
    const payload = JSON.stringify(message);
    const dead = [];
    for (const ws of this.sessions) {
      try {
        ws.send(payload);
      } catch {
        dead.push(ws);
      }
    }
    // Clean up dead connections
    for (const ws of dead) {
      this.sessions.delete(ws);
    }
  }

  // Called by the runtime when a WebSocket receives a message
  async webSocketMessage(ws, message) {
    // Client can send pings; we respond with pong
    try {
      const data = JSON.parse(message);
      if (data.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
      }
    } catch {
      // Ignore malformed messages
    }
  }

  // Called when a WebSocket connection closes
  async webSocketClose(ws) {
    this.sessions.delete(ws);
  }

  // Called on WebSocket error
  async webSocketError(ws) {
    this.sessions.delete(ws);
  }
}
