# IndiChess — Implementation Plan (Frontend rewrite + minimal backend changes)

## Goals (based on your notes)

- **Delete and rebuild the entire frontend from scratch** (new UI + new structure).
- **Keep backend as-is** wherever possible; **make backend changes first** only when the new frontend needs different contracts/behavior.
- **Auth**: username/password signup + login (JWT), plus **OAuth2 (Google/GitHub)** login where we **save user** in DB.
- **Security**: stateless JWT APIs (pragmatic handling for OAuth2 which needs session for state).
- **Gameplay**: fully functional chess board + move rules including **capture, check, en-passant, castling, promotion**, plus **checkmate/stalemate**.
- **Multiplayer**: start match button(s) → **matchmaking wait ≤ 90 seconds**, then start game.
- **Match types**:
  - **Standard**: no clock
  - **Rapid**: 10 min
  - **Blitz**: 3+1 (first 3 min, then +1 increment)
- **Realtime**: use WebSocket/STOMP for moves/events; moves also persisted/relayed to backend.
- **UX rules**:
  - If not logged in → any protected page redirects to login/signup
  - If logged in → attempting login/signup redirects to home/lobby
- **Exception handling**: all invalid requests/custom errors handled consistently.

---

## Current repo reality check (what already exists)

### Auth & Security already present

- `SecurityConfig` already has:
  - `SecurityFilterChain` (JWT filter, CORS, OAuth2 optional enable)
  - `DaoAuthenticationProvider` using `MyUserDetailsService` + BCrypt
  - public endpoints: `/login`, `/signup`, `/logout`, `/api/auth/me`, `/oauth2/**`, `/login/oauth2/**`
- JWT is cookie-based in REST (`JWT` httpOnly cookie) via `JwtFilter`.
- OAuth2 success handler sets the same JWT cookie and redirects to `http://localhost:3000/home`.

### WebSocket already present

- STOMP endpoint: `/ws` (SockJS + native), broker prefixes `/app`, topics `/topic`, user `/user`.
- Inbound channel interceptor tries to authenticate on `CONNECT` via `Authorization: Bearer <jwt>`.

### Matchmaking already present (but missing your constraints)

- `MatchService` has a simple waiting queue and creates a `Match` when opponent found.
- **No 90-second timeout** yet.
- **No multiple queues per game type** yet.

### Gameplay state already partially present

- `GameService` maintains **in-memory board** and accepts moves over WS.
- Backend currently trusts the client’s `board` in `MoveRequest` (frontend must be honest).

---

## Phase 0 — Contracts & constraints (do this before writing new frontend)

### Decide & lock the contracts the new frontend will use

- **Auth**
  - `POST /signup` → creates user
  - `POST /login` → authenticates + sets `JWT` cookie
  - `GET /api/auth/me` → authenticated check (already exists)
  - `POST /logout` → clears cookie (already exists)
  - OAuth2: `/oauth2/authorization/{provider}` → redirects back to frontend

- **Matchmaking**
  - `POST /game` (currently creates/queues standard match) → we’ll extend to accept `gameType`
  - `GET /game/check-match` (polling) → returns matchId or waiting status
  - `POST /game/cancel-waiting`

- **Game**
  - `GET /api/games/{matchId}` → returns game details (board + fen + players)
  - WebSocket:
    - client send: `/app/game/{matchId}/move`
    - server broadcast: `/topic/moves/{matchId}`
    - join: `/app/game/{matchId}/join` → `/topic/game/{matchId}`
    - state events: `/topic/game-state/{matchId}`
    - chat: `/topic/chat/{matchId}`
    - draw offers: `/user/queue/draw-offers`

### Implementation constraints to enforce

- **Duplicate username/email must be blocked** with clear error messages.
- OAuth2: if user logs in with Google/GitHub, we **create** user if missing.
- All invalid requests should return consistent JSON error response.

---

## Phase 1 — Backend hardening (minimal changes, but do these first)

### 1) Fix correctness gaps in existing auth

- **`JwtService` secret handling**
  - Currently `Decoders.BASE64.decode(SECRET)` assumes SECRET is base64.
  - Change to one of:
    - store a real base64 secret in env (recommended), or
    - use UTF-8 bytes directly.
  - Move secret to `application.properties` with env override.

- **`MyUserDetailsService` null user**
  - `userRepo.getUserByUsername(username)` can return null → `new UserPrincipal(null)` causes NPE.
  - Throw `UsernameNotFoundException` when user not found.

### 2) Enforce duplicate username/email on signup with clear errors

- In `AuthService.save(...)`:
  - check `userRepo.findByUsername(username)` and `userRepo.getUserByEmailId(email)`
  - if exists → throw custom exception (e.g., `DuplicateResourceException`)
- Add DB-level safety: unique constraints already exist; still catch `DataIntegrityViolationException` as fallback.

### 3) Global exception handling (API-wide)

- Add `@RestControllerAdvice` (e.g., `GlobalExceptionHandler`) returning:
  - `400` validation errors (`MethodArgumentNotValidException`)
  - `409` duplicate resource
  - `401/403` auth failures
  - `404` not found
  - `500` fallback
- Standardize response shape, e.g.:
  - `{ "error": { "code": "...", "message": "...", "details": {...} } }`

### 4) CORS + cookie strategy for the new frontend

- Current CORS allows `http://localhost:*` and credentials.
- For production, plan a config switch:
  - allow only your deployed frontend origin(s)
  - set cookie `secure=true`, `sameSite=None` if cross-site

### 5) WebSocket authentication (make it work without exposing JWT to JS)

Problem:
- REST uses **httpOnly cookie** (good), but WS interceptor currently expects `Authorization: Bearer ...` header (client can’t read httpOnly cookie to set header).

Plan:
- Add a **HandshakeInterceptor** (or custom `HandshakeHandler`) to:
  - read `JWT` from the **Cookie header** during `/ws` handshake
  - validate token, set authenticated `Principal`
- Keep existing `WebSocketAuthInterceptor` (CONNECT header auth) as a secondary option.

### 6) Matchmaking upgrades (90s + multiple queues)

- Add `GameType` selection to matchmaking:
  - Standard, Rapid10, Blitz3p1
- Maintain **separate waiting queues per `GameType`**.
- Store waiting entries as `(username, enqueueTime)`.
- Implement 90-second timeout:
  - On `check-match` or scheduled cleanup: if waiting > 90s → remove + return “timed out”.
  - Frontend should show “no opponent found” and stop polling.

### 7) Time controls (Rapid / Blitz)

Backend approach (recommended for fairness):
- Store in `Match`:
  - `gameType`, `initialTimeMs`, `incrementMs`
  - `whiteTimeMs`, `blackTimeMs`
  - `lastMoveAt`
- On each accepted move:
  - compute elapsed since `lastMoveAt` for side to move, decrement their clock
  - add increment to mover after move (for Blitz 3+1)
  - if time <= 0 → game over
- Broadcast clock updates on `/topic/game-state/{matchId}`.

---

## Phase 2 — New Frontend (delete old code, rebuild clean)

### Tech choices (recommended defaults)

- Vite + React + TypeScript
- Styling: Tailwind (or MUI if you prefer)
- State: React Query (server state) + simple context/store for auth
- WebSocket: `@stomp/stompjs` + SockJS fallback

### Routing + auth guards (required UX rule)

- Public routes: `/login`, `/signup`
- Protected routes: `/home` (lobby), `/game/:matchId`
- Guard logic:
  - call `GET /api/auth/me` on boot
  - if unauthenticated → redirect to `/login`
  - if authenticated and route is login/signup → redirect to `/home`

### Pages

- **Login/Signup**
  - username/password forms
  - OAuth buttons: Google/GitHub (link to backend OAuth2 endpoints)
- **Home/Lobby**
  - Start Match buttons:
    - Standard
    - Rapid 10
    - Blitz 3+1
  - show status: waiting / matched / timed out
- **Game**
  - chess board
  - move list (RHS)
  - game status (turn, check/checkmate/stalemate)
  - resign, offer draw, accept draw
  - chat (optional early)
  - clocks (for timed modes)

---

## Phase 3 — Chess rules implementation approach

### Decide “source of truth” for legality

Two viable strategies:

1) **Frontend is source of truth** (fast dev, but weaker anti-cheat)
   - frontend enforces legal moves, backend stores/broadcasts

2) **Backend validates moves** (more secure)
   - client sends move (from,to,promotion)
   - backend validates using game state (FEN/board + rules), rejects invalid

Given your current backend already accepts `board` from client, the plan is:
- **Step 1**: Implement full legality in frontend (works quickly).
- **Step 2 (upgrade)**: Move legality to backend (optional, later).

### Chess rules checklist

- Turn-based play (white then black)
- Move generation for each piece
- Capture logic
- Check detection
- King cannot move into check (simulate king moves / attacked squares)
- Castling rules (no check through/into check, rook/king unmoved, squares empty)
- En passant (track last double pawn push + target square)
- Promotion (modal choose piece; default queen)
- Checkmate:
  - if in check and no legal moves → checkmate
- Stalemate:
  - not in check and no legal moves → stalemate

---

## Phase 4 — Realtime flows (WS)

### Client connect flow

- Connect to `/ws` (SockJS preferred for dev).
- Subscribe:
  - `/topic/moves/{matchId}`
  - `/topic/game-state/{matchId}`
  - `/topic/chat/{matchId}` (optional)
  - `/user/queue/draw-offers`
- Send join:
  - `/app/game/{matchId}/join`

### Move flow

- On move:
  - compute legality + resulting board/fen locally
  - send to `/app/game/{matchId}/move`
  - server broadcasts to `/topic/moves/{matchId}`
  - client applies move from broadcast (single source to keep both clients synced)

---

## Deliverables checklist (what “done” means)

- Auth:
  - signup/login/logout + oauth2
  - duplicate username/email blocked with 409 + clear message
  - `/api/auth/me` working for route-guards
- Matchmaking:
  - Standard/Rapid/Blitz queues
  - 90s timeout behavior
- Game:
  - full rules in frontend
  - move list, resign/draw
  - timed games decrement + increment
- Realtime:
  - WS auth works even with httpOnly JWT cookie
  - move broadcast sync stable

---

## Backend changes list (anticipated files)

- `IndiChessBackend/src/main/java/.../service/JwtService.java` (secret handling)
- `.../service/MyUserDetailsService.java` (null handling)
- `.../service/AuthService.java` (duplicate checks)
- `.../config/WebSocketConfig.java` (+ handshake interceptor/handler)
- `.../config/WebSocketAuthInterceptor.java` (optional: keep as secondary)
- `.../controller/MatchController.java` and `.../service/MatchService.java` (gameType + 90s timeout)
- Add:
  - `.../exception/*` + `GlobalExceptionHandler`
  - possibly DTOs: `StartMatchRequest`, `ErrorResponse`

---

## Frontend rewrite list (anticipated structure)

- Delete old `Indichessfrontend/src/*`
- New structure (example):
  - `src/app/` (routing + auth)
  - `src/api/` (fetch wrappers + types)
  - `src/ws/` (stomp client)
  - `src/chess/` (rules engine)
  - `src/pages/` (`Login`, `Signup`, `Home`, `Game`)
  - `src/components/` (board, clock, move list, modal)


