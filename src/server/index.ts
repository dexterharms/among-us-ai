import { serve } from 'bun';
import { GameState } from '@/game/state';
import { Player, PlayerRole, PlayerStatus } from '@/types/game';
import { RoomManager } from '@/game/rooms';

/**
 * Bun HTTP Server
 *
 * Serves the game API and SSE streaming endpoint
 */
export class GameServer {
  private gameState: GameState;
  private port: number;

  constructor(port: number = 3000) {
    this.port = port;
    this.gameState = new GameState();
  }

  /**
   * Start the HTTP server
   */
  async start(): Promise<void> {
    const server = serve({
      port: this.port,
      fetch: async (req) => {
        const url = new URL(req.url);

        // CORS headers helper
        const corsHeaders = {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Cache-Control',
        };

        // Handle OPTIONS preflight requests
        if (req.method === 'OPTIONS') {
          return new Response(null, { headers: corsHeaders });
        }

        // Serve static files from React app
        if (url.pathname === '/' || url.pathname.startsWith('/assets/')) {
          try {
            const filePath =
              url.pathname === '/'
                ? new URL('../../web/dist/index.html', import.meta.url).pathname
                : new URL(`../../web/dist${url.pathname}`, import.meta.url).pathname;

            const file = Bun.file(filePath);
            const fileType = filePath.endsWith('.css')
              ? 'text/css'
              : filePath.endsWith('.js')
                ? 'application/javascript'
                : 'text/html';

            return new Response(file, {
              headers: {
                'Content-Type': fileType,
                ...corsHeaders,
              },
            });
          } catch (err) {
            console.error('Error serving static file:', err);
            return new Response('Not Found', { status: 404, headers: corsHeaders });
          }
        }

        // SSE streaming endpoint
        if (url.pathname === '/api/stream/actions') {
          return this.handleSSE(req);
        }

        // API: Get all actions
        if (url.pathname === '/api/actions' && req.method === 'GET') {
          return Response.json(this.gameState.getActionLogger().getAllActions(), {
            headers: corsHeaders,
          });
        }

        // API: Get recent actions
        if (url.pathname.startsWith('/api/actions/recent') && req.method === 'GET') {
          const count = parseInt(url.searchParams.get('count') || '100', 10);
          return Response.json(this.gameState.getActionLogger().getRecentActions(count), {
            headers: corsHeaders,
          });
        }

        // API: Get actions since timestamp
        if (url.pathname.startsWith('/api/actions/since') && req.method === 'GET') {
          const timestamp = parseInt(url.searchParams.get('timestamp') || '0', 10);
          return Response.json(this.gameState.getActionLogger().getActionsSince(timestamp), {
            headers: corsHeaders,
          });
        }

        // API: Get game state
        if (url.pathname === '/api/game/state' && req.method === 'GET') {
          return Response.json(this.gameState, { headers: corsHeaders });
        }

        // API: Get action stats
        if (url.pathname === '/api/actions/stats' && req.method === 'GET') {
          return Response.json(this.gameState.getActionLogger().getStats(), {
            headers: corsHeaders,
          });
        }

        // API: Health check
        if (url.pathname === '/health' && req.method === 'GET') {
          return Response.json({ status: 'ok', timestamp: Date.now() }, { headers: corsHeaders });
        }

        // 404
        return new Response('Not Found', { status: 404, headers: corsHeaders });
      },
    });

    console.log(`🚀 Game server started on http://localhost:${this.port}`);
  }

  /**
   * Handle SSE connections
   */
  private async handleSSE(req: Request): Promise<Response> {
    const sseManager = this.gameState.getSSEManager();
    const response = await sseManager.handleConnection(req);

    // Add CORS headers to SSE response
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Cache-Control',
    };

    // Create new Response with CORS headers
    const sseHeaders = new Headers(response.headers);
    Object.entries(corsHeaders).forEach(([key, value]) => {
      sseHeaders.set(key, value);
    });

    const body = await response.text();

    return new Response(body, {
      status: response.status,
      statusText: response.statusText,
      headers: sseHeaders,
    });
  }

  /**
   * Get the game state instance
   */
  getGameState(): GameState {
    return this.gameState;
  }

  /**
   * Create demo players for testing
   */
  async createDemoGame(): Promise<void> {
    const roomManager = new RoomManager();
    const rooms = roomManager.getRooms();

    // Create some demo players
    const players: Player[] = [
      {
        id: 'p1',
        name: 'Alice',
        role: PlayerRole.CREWMATE,
        status: PlayerStatus.ALIVE,
        location: {
          roomId: rooms[0]?.id || 'room1',
          x: rooms[0]?.position.x || 0,
          y: rooms[0]?.position.y || 0,
        },
        taskProgress: 25,
      },
      {
        id: 'p2',
        name: 'Bob',
        role: PlayerRole.IMPOSTER,
        status: PlayerStatus.ALIVE,
        location: {
          roomId: rooms[0]?.id || 'room1',
          x: rooms[0]?.position.x || 0,
          y: rooms[0]?.position.y || 0,
        },
        killCooldown: 10,
      },
      {
        id: 'p3',
        name: 'Charlie',
        role: PlayerRole.CREWMATE,
        status: PlayerStatus.ALIVE,
        location: {
          roomId: rooms[0]?.id || 'room1',
          x: rooms[0]?.position.x || 0,
          y: rooms[0]?.position.y || 0,
        },
        taskProgress: 50,
      },
    ];

    players.forEach((player) => this.gameState.addPlayer(player));

    console.log(`🎮 Created demo game with ${players.length} players`);
  }
}
