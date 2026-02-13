# SSE Authentication & Private Event Channels Plan

## Overview

Secure the SSE (Server-Sent Events) connections to prevent unauthorized access, session hijacking, and private event leaks in the multiplayer deception game.

## Problem Statement

Currently, SSE connections are completely unauthenticated:

- Anyone can connect to `/api/stream/actions` without any credentials
- Session IDs are just UUIDs with no validation
- The `registerPlayerSession()` method allows anyone to register any `playerId`
- Private events (`ROLE_REVEALED`, `YOU_DIED`, per-player state) can be intercepted
- Player sessions can be hijacked by malicious connections

This is unacceptable for a deception game where secret information (roles, private events) is core to gameplay.

## Requirements

### HAR-61: JWT/Session Token Generation on Player Join
When a player joins the lobby via `POST /api/lobby/join`:
- Generate a secure JWT (JSON Web Token) containing:
  - `playerId`: The player's unique identifier
  - `exp`: Expiration timestamp (e.g., 24 hours or game session duration)
  - `iat`: Issued at timestamp
- Sign the token with a secret key (stored in environment variable)
- Return the token in the join response: `{ success: true, player, token }`
- Token must be sent back by client on SSE connection

### HAR-62: Require Authentication Token on SSE Connection
The SSE endpoint `/api/stream/actions` must require authentication:
- Extract token from connection query string (e.g., `?token=...`) or headers
- Reject connections without a valid token with `401 Unauthorized`
- Pass validated token to `handleConnection()` for player association
- Document authentication flow in API documentation

### HAR-63: Validate Token and Associate with Authenticated Player
When SSE connection provides a token:
- Verify JWT signature and expiration
- Extract `playerId` from token payload
- Ensure player exists in game state
- Store authenticated `playerId` in session context
- Reject invalid/expired tokens with `401 Unauthorized`
- Log authentication attempts for security monitoring

### HAR-64: Add Access Control to `registerPlayerSession()`
Prevent session hijacking:
- Remove public `registerPlayerSession()` method or add authentication check
- Only allow session registration during authenticated SSE connection (`handleConnection`)
- Validate that session is associated with authenticated `playerId` before mapping
- Log suspicious registration attempts

### HAR-65: Ensure Private Events Only Sent to Authenticated Sessions
Private events must not be broadcast to all players:
- Update `sendTo()` to validate session is authenticated
- Do not broadcast private events; use `sendTo()` only
- Log when `sendTo()` fails (session not found or not authenticated)
- Consider returning error instead of fallback broadcast for private events
- Ensure `ROLE_REVEALED`, `YOU_DIED`, and per-player state are private

## Implementation Plan

### 1. Create JWT Utility (`src/utils/jwt.ts`)
- `generateToken(playerId: string): string` - Generate JWT for player
- `validateToken(token: string): { playerId: string } | null` - Validate and decode JWT
- Use environment variable `JWT_SECRET` for signing
- Handle errors (invalid signature, expired token, etc.)

### 2. Update Lobby Manager (`src/lobby/manager.ts`)
- Import JWT utility
- In `join()` method: Generate token and include in player object
- Return token in response (server layer needs to expose it)

### 3. Update SSE Manager (`src/sse/manager.ts`)
- Add `authenticatedPlayers: Map<string, string>` (playerId -> sessionId)
- Update `handleConnection()` to:
  - Extract token from request query string: `?token=xxx`
  - Validate token using JWT utility
  - Associate session with authenticated `playerId`
  - Reject invalid tokens with `401 Unauthorized` (return error response)
- Update `sendTo()` to:
  - Remove fallback to `broadcast()` for private events
  - Return `false` and log warning if session not found
- Update `registerPlayerSession()` to:
  - Only allow internal calls (not public)
  - Validate playerId is authenticated
- Remove or make `unregisterPlayerSession()` private

### 4. Update Server (`src/server/index.ts`)
- Update `POST /api/lobby/join` endpoint to:
  - Generate token via LobbyManager
  - Return token in response: `{ success: true, player, token }`
- Update `handleSSE()` to pass request to SSEManager

### 5. Update Game State and Event Broadcasters
- Review all `sendTo()` calls to ensure they're for private events
- Ensure public events use `broadcast()`
- Ensure private events use `sendTo()`

### 6. Add Tests
- Test JWT generation and validation
- Test token expiration
- Test SSE connection with valid token
- Test SSE connection rejection with invalid token
- Test SSE connection rejection with no token
- Test `sendTo()` only reaches authenticated session
- Test `registerPlayerSession()` access control

### 7. Update Documentation
- Document authentication flow in API docs
- Document environment variables (`JWT_SECRET`)
- Update SSE connection documentation

## Security Considerations

- **JWT Secret**: Must be stored in environment variable, never committed
- **Token Expiration**: Tokens should expire after reasonable time (24h or game session)
- **Token Transport**: Use query string for SSE (SSE doesn't support custom headers well)
- **Logging**: Log authentication failures for security monitoring (without exposing secrets)
- **Rate Limiting**: Consider rate limiting SSE connection attempts (future enhancement)

## Migration Notes

This is a breaking change for existing clients:
- Clients must now include `?token=xxx` in SSE connection URL
- Old clients without tokens will be rejected with `401 Unauthorized`
- Token is obtained from `/api/lobby/join` response

## Success Criteria

- All SSE connections require valid JWT token
- Private events only delivered to authenticated players
- Session hijacking is impossible
- Token generation works on player join
- All tests pass
- No regression in public event broadcasting

## Related Files

- `src/utils/jwt.ts` (new)
- `src/sse/manager.ts` (modified)
- `src/lobby/manager.ts` (modified)
- `src/server/index.ts` (modified)
- Tests in `src/**/*.test.ts` (new/modified)
