import { serve } from 'bun';
import { GameState } from '@/game/state';
import { GameCoordinator } from '@/game/coordinator';
import { LobbyManager } from '@/lobby/manager';
import { Player, PlayerRole, PlayerStatus } from '@/types/game';
import { RoomManager } from '@/game/rooms';
import { TaskManager } from '@/game/tasks';
import { logger } from '@/utils/logger';

/**
 * Bun HTTP Server
 *
 * Serves the game API and SSE streaming endpoint
 */
export class GameServer {
  private gameState: GameState;
  private lobbyManager: LobbyManager;
  private gameCoordinator: GameCoordinator;
  private port: number;
  private hostname: string;
  private server: ReturnType<typeof serve> | null = null;

  constructor(port: number = 3000, hostname: string = '0.0.0.0') {
    this.port = port;
    this.hostname = hostname;
    this.gameState = new GameState();
    this.lobbyManager = new LobbyManager(this.gameState.getSSEManager());
    this.gameCoordinator = new GameCoordinator(
      this.lobbyManager,
      this.gameState,
      this.gameState.getSSEManager(),
    );
    // Wire up countdown to trigger game start
    this.lobbyManager.setOnCountdownComplete(() => {
      this.gameCoordinator.startGame();
    });
  }

  /**
   * Get the task manager from game state
   */
  private get taskManager(): TaskManager {
    return this.gameState.getTaskManager();
  }

  /**
   * Start the HTTP server
   */
  async start(): Promise<void> {
    const server = serve({
      port: this.port,
      hostname: this.hostname,
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
            logger.error('Error serving static file', { error: err });
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

        // ==================== LOBBY API ====================

        // API: Join lobby
        if (url.pathname === '/api/lobby/join' && req.method === 'POST') {
          try {
            const body = await req.json();
            const { id, name } = body as { id: string; name: string };

            if (!id || !name) {
              return Response.json(
                { error: 'Missing required fields: id, name' },
                { status: 400, headers: corsHeaders },
              );
            }

            const roomManager = new RoomManager();
            const rooms = roomManager.getRooms();
            const startRoom = rooms[0];

            const player: Player = {
              id,
              name,
              role: PlayerRole.LOYALIST,
              status: PlayerStatus.ALIVE,
              location: {
                roomId: startRoom?.id || 'cafeteria',
                x: startRoom?.position.x || 0,
                y: startRoom?.position.y || 0,
              },
            };

            this.lobbyManager.join(player);

            // Generate authentication token for the player
            const token = await this.lobbyManager.generatePlayerToken(player.id);

            return Response.json({ success: true, player, token }, { headers: corsHeaders });
          } catch (err) {
            logger.error('Error joining lobby', { error: err });
            return Response.json(
              { error: 'Failed to join lobby' },
              { status: 500, headers: corsHeaders },
            );
          }
        }

        // API: Leave lobby
        if (url.pathname === '/api/lobby/leave' && req.method === 'POST') {
          try {
            const body = await req.json();
            const { playerId } = body as { playerId: string };

            if (!playerId) {
              return Response.json(
                { error: 'Missing required field: playerId' },
                { status: 400, headers: corsHeaders },
              );
            }

            this.lobbyManager.leave(playerId);

            return Response.json({ success: true }, { headers: corsHeaders });
          } catch (err) {
            logger.error('Error leaving lobby', { error: err });
            return Response.json(
              { error: 'Failed to leave lobby' },
              { status: 500, headers: corsHeaders },
            );
          }
        }

        // API: Set ready status
        if (url.pathname === '/api/lobby/ready' && req.method === 'POST') {
          try {
            const body = await req.json();
            const { playerId, ready } = body as { playerId: string; ready: boolean };

            if (!playerId || typeof ready !== 'boolean') {
              return Response.json(
                { error: 'Missing required fields: playerId, ready' },
                { status: 400, headers: corsHeaders },
              );
            }

            this.lobbyManager.setReady(playerId, ready);

            return Response.json({ success: true }, { headers: corsHeaders });
          } catch (err) {
            logger.error('Error setting ready status', { error: err });
            return Response.json(
              { error: 'Failed to set ready status' },
              { status: 500, headers: corsHeaders },
            );
          }
        }

        // API: Get lobby state
        if (url.pathname === '/api/lobby/state' && req.method === 'GET') {
          return Response.json(
            {
              players: this.lobbyManager.getWaitingPlayers(),
              readyPlayers: Array.from(this.lobbyManager.getReadyPlayers()),
              playerCount: this.lobbyManager.getPlayerCount(),
              isCountdownActive: this.lobbyManager.getCountdownStatus(),
            },
            { headers: corsHeaders },
          );
        }

        // ==================== GAME API ====================

        // API: Start game
        if (url.pathname === '/api/game/start' && req.method === 'POST') {
          try {
            if (!this.lobbyManager.checkStartCondition()) {
              return Response.json(
                { error: 'Not enough players or not all players ready' },
                { status: 400, headers: corsHeaders },
              );
            }

            this.gameCoordinator.startGame();

            return Response.json({ success: true }, { headers: corsHeaders });
          } catch (err) {
            logger.error('Error starting game', { error: err });
            return Response.json(
              { error: 'Failed to start game' },
              { status: 500, headers: corsHeaders },
            );
          }
        }

        // API: Move player
        if (url.pathname === '/api/game/move' && req.method === 'POST') {
          try {
            const body = await req.json();
            const { playerId, targetRoomId } = body as {
              playerId: string;
              targetRoomId: string;
            };

            if (!playerId || !targetRoomId) {
              return Response.json(
                { error: 'Missing required fields: playerId, targetRoomId' },
                { status: 400, headers: corsHeaders },
              );
            }

            const success = this.gameState.movePlayer(playerId, targetRoomId);

            return Response.json({ success }, { headers: corsHeaders });
          } catch (err) {
            logger.error('Error moving player', { error: err });
            return Response.json(
              { error: 'Failed to move player' },
              { status: 500, headers: corsHeaders },
            );
          }
        }

        // API: Cast vote
        if (url.pathname === '/api/game/vote' && req.method === 'POST') {
          try {
            const body = await req.json();
            const { voterId, targetId } = body as {
              voterId: string;
              targetId: string | null;
            };

            if (!voterId) {
              return Response.json(
                { error: 'Missing required field: voterId' },
                { status: 400, headers: corsHeaders },
              );
            }

            this.gameState.getVotingSystem().castVote(voterId, targetId ?? null);

            return Response.json({ success: true }, { headers: corsHeaders });
          } catch (err) {
            logger.error('Error casting vote', { error: err });
            return Response.json(
              { error: 'Failed to cast vote' },
              { status: 500, headers: corsHeaders },
            );
          }
        }

        // API: Start a task (initialize minigame)
        if (url.pathname === '/api/game/task/start' && req.method === 'POST') {
          try {
            const body = await req.json();
            const { playerId, taskId } = body as { playerId: string; taskId: string };

            if (!playerId || !taskId) {
              return Response.json(
                { error: 'Missing required fields: playerId, taskId' },
                { status: 400, headers: corsHeaders },
              );
            }

            const result = this.taskManager.startTask(playerId, taskId);

            return Response.json(result, { headers: corsHeaders });
          } catch (err) {
            logger.error('Error starting task', { error: err });
            return Response.json(
              { error: 'Failed to start task' },
              { status: 500, headers: corsHeaders },
            );
          }
        }

        // API: Submit task action (HAR-94 - minigame validation)
        if (url.pathname === '/api/game/action' && req.method === 'POST') {
          try {
            const body = await req.json();
            const { playerId, taskId, action } = body as {
              playerId: string;
              taskId: string;
              action: any;
            };

            if (!playerId || !taskId || action === undefined) {
              return Response.json(
                { error: 'Missing required fields: playerId, taskId, action' },
                { status: 400, headers: corsHeaders },
              );
            }

            const result = this.taskManager.submitTaskAction(playerId, taskId, action);

            return Response.json(result, { headers: corsHeaders });
          } catch (err) {
            logger.error('Error submitting task action', { error: err });
            return Response.json(
              { error: 'Failed to submit task action' },
              { status: 500, headers: corsHeaders },
            );
          }
        }

        // API: Attempt task (legacy - for backward compatibility)
        if (url.pathname === '/api/game/task' && req.method === 'POST') {
          try {
            const body = await req.json();
            const { playerId, taskId, minigameResult } = body as {
              playerId: string;
              taskId: string;
              minigameResult?: boolean;
            };

            if (!playerId || !taskId) {
              return Response.json(
                { error: 'Missing required fields: playerId, taskId' },
                { status: 400, headers: corsHeaders },
              );
            }

            const result = this.taskManager.attemptTask(playerId, taskId, minigameResult);

            return Response.json(result, { headers: corsHeaders });
          } catch (err) {
            logger.error('Error attempting task', { error: err });
            return Response.json(
              { error: 'Failed to attempt task' },
              { status: 500, headers: corsHeaders },
            );
          }
        }

        // API: Report dead body
        if (url.pathname === '/api/game/report' && req.method === 'POST') {
          try {
            const body = await req.json();
            const { playerId, bodyId } = body as { playerId: string; bodyId: number };

            if (!playerId || bodyId === undefined) {
              return Response.json(
                { error: 'Missing required fields: playerId, bodyId' },
                { status: 400, headers: corsHeaders },
              );
            }

            this.gameState.discoverBody(playerId, bodyId);

            return Response.json({ success: true }, { headers: corsHeaders });
          } catch (err) {
            logger.error('Error reporting body', { error: err });
            return Response.json(
              { error: 'Failed to report body' },
              { status: 500, headers: corsHeaders },
            );
          }
        }

        // API: Fix sabotage
        if (url.pathname === '/api/game/fix' && req.method === 'POST') {
          try {
            const body = await req.json();
            const { playerId, fixType, fixData } = body as {
              playerId: string;
              fixType: string;
              fixData?: any;
            };

            if (!playerId) {
              return Response.json(
                { error: 'Missing required field: playerId' },
                { status: 400, headers: corsHeaders },
              );
            }

            if (!fixType) {
              return Response.json(
                { error: 'Missing required field: fixType' },
                { status: 400, headers: corsHeaders },
              );
            }

            const player = this.gameState.players.get(playerId);
            if (!player) {
              return Response.json(
                { error: 'Player not found' },
                { status: 400, headers: corsHeaders },
              );
            }

            const sabotageSystem = this.gameState.getSabotageSystem();
            const result = sabotageSystem.fixSabotage(playerId, fixType, fixData);

            return Response.json(result, { headers: corsHeaders });
          } catch (err) {
            logger.error('Error fixing sabotage', { error: err });
            return Response.json(
              { error: 'Failed to fix sabotage' },
              { status: 500, headers: corsHeaders },
            );
          }
        }

        // API: Trigger sabotage
        if (url.pathname === '/api/game/sabotage' && req.method === 'POST') {
          try {
            const body = await req.json();
            const { playerId, sabotageType, targetRoomId } = body as {
              playerId: string;
              sabotageType: string;
              targetRoomId?: string;
            };

            if (!playerId) {
              return Response.json(
                { error: 'Missing required field: playerId' },
                { status: 400, headers: corsHeaders },
              );
            }

            if (!sabotageType) {
              return Response.json(
                { error: 'Missing required field: sabotageType' },
                { status: 400, headers: corsHeaders },
              );
            }

            const player = this.gameState.players.get(playerId);
            if (!player) {
              return Response.json(
                { error: 'Player not found' },
                { status: 400, headers: corsHeaders },
              );
            }

            const sabotageSystem = this.gameState.getSabotageSystem();
            const result = sabotageSystem.triggerSabotage(playerId, {
              type: sabotageType as any,
              target: targetRoomId,
            });

            return Response.json(result, { headers: corsHeaders });
          } catch (err) {
            logger.error('Error triggering sabotage', { error: err });
            return Response.json(
              { error: 'Failed to trigger sabotage' },
              { status: 500, headers: corsHeaders },
            );
          }
        }

        // API: Call emergency meeting
        if (url.pathname === '/api/game/emergency' && req.method === 'POST') {
          try {
            const body = await req.json();
            const { playerId } = body as { playerId: string };

            if (!playerId) {
              return Response.json(
                { error: 'Missing required field: playerId' },
                { status: 400, headers: corsHeaders },
              );
            }

            const result = this.gameState.callEmergency(playerId);

            return Response.json(result, { headers: corsHeaders });
          } catch (err) {
            logger.error('Error calling emergency', { error: err });
            return Response.json(
              { error: 'Failed to call emergency meeting' },
              { status: 500, headers: corsHeaders },
            );
          }
        }

        // API: Vent travel
        if (url.pathname === '/api/game/vent' && req.method === 'POST') {
          try {
            const body = await req.json();
            const { playerId, targetRoomId } = body as {
              playerId: string;
              targetRoomId: string;
            };

            if (!playerId || !targetRoomId) {
              return Response.json(
                { error: 'Missing required fields: playerId, targetRoomId' },
                { status: 400, headers: corsHeaders },
              );
            }

            this.gameState.getMoleAbilities().attemptVent(playerId, targetRoomId);

            return Response.json({ success: true }, { headers: corsHeaders });
          } catch (err) {
            logger.error('Error venting', { error: err });
            return Response.json(
              { error: 'Failed to vent' },
              { status: 500, headers: corsHeaders },
            );
          }
        }

        // 404
        return new Response('Not Found', { status: 404, headers: corsHeaders });
      },
    });

    // Store server reference and update port if using port 0
    this.server = server;
    this.port = server.port ?? this.port;

    logger.info(`Game server started on http://${this.hostname}:${this.port}`);
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

    // Create new Response with CORS headers, preserving the streaming body
    const sseHeaders = new Headers(response.headers);
    Object.entries(corsHeaders).forEach(([key, value]) => {
      sseHeaders.set(key, value);
    });

    return new Response(response.body, {
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
   * Get the lobby manager instance
   */
  getLobbyManager(): LobbyManager {
    return this.lobbyManager;
  }

  /**
   * Get the game coordinator instance
   */
  getGameCoordinator(): GameCoordinator {
    return this.gameCoordinator;
  }

  /**
   * Get the actual port the server is listening on
   */
  getPort(): number {
    return this.port;
  }

  /**
   * Stop the HTTP server
   */
  stop(): void {
    // Clean up any active countdown timer
    this.lobbyManager.cancelCountdown();
    if (this.server) {
      this.server.stop();
      this.server = null;
    }
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
        role: PlayerRole.LOYALIST,
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
        role: PlayerRole.MOLE,
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
        role: PlayerRole.LOYALIST,
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

    logger.info(`Created demo game with ${players.length} players`);
  }
}
