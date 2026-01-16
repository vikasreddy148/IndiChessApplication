package com.example.IndiChessBackend.service;

import com.example.IndiChessBackend.model.Match;
import com.example.IndiChessBackend.model.GameType;
import com.example.IndiChessBackend.model.User;
import com.example.IndiChessBackend.model.DTO.ChallengeResponse;
import com.example.IndiChessBackend.model.DTO.MatchmakingStatusResponse;
import com.example.IndiChessBackend.repo.MatchRepo;
import com.example.IndiChessBackend.repo.UserRepo;
import com.example.IndiChessBackend.service.ChallengeService;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

import static com.example.IndiChessBackend.model.MatchStatus.IN_PROGRESS;

@Service
public class MatchService {

    private static final long WAIT_TIMEOUT_MS = 90_000L;
    // waiting queue per game type: username -> enqueuedAtMillis
    private static final Map<GameType, Map<String, Long>> waitingByType = new ConcurrentHashMap<>();

    private final JwtService jwtService;
    private final UserRepo userRepo;
    private final MatchRepo matchRepo;
    private final GameService gameService;
    private final MatchQueueService matchQueueService;
    private final ChallengeService challengeService;

    @Autowired
    MatchService(JwtService jwtService, UserRepo userRepo, MatchRepo matchRepo, GameService gameService, MatchQueueService matchQueueService, ChallengeService challengeService) {
        this.jwtService = jwtService;
        this.userRepo = userRepo;
        this.matchRepo = matchRepo;
        this.gameService = gameService;
        this.matchQueueService = matchQueueService;
        this.challengeService = challengeService;

        // Clean up old entries periodically (optional)
        new Timer().schedule(new TimerTask() {
            public void run() {
                cleanupOldEntries();
            }
        }, 0, 60000); // Clean up every minute
    }

    public String getJwtFromCookie(HttpServletRequest request) {
        Cookie[] cookies = request.getCookies();
        if (cookies != null) {
            for (Cookie cookie : cookies) {
                if ("JWT".equals(cookie.getName())) {
                    return cookie.getValue();
                }
            }
        }
        return null;
    }

    private void cleanupOldEntries() {
        long cutoff = System.currentTimeMillis() - WAIT_TIMEOUT_MS;
        for (Map<String, Long> waiting : waitingByType.values()) {
            waiting.entrySet().removeIf(e -> e.getValue() < cutoff);
        }
    }

    public MatchmakingStatusResponse createMatch(HttpServletRequest request, GameType gameType) {
        String tk = getJwtFromCookie(request);
        if (tk == null) {
            throw new RuntimeException("Not authenticated");
        }
        String userName = jwtService.extractUsername(tk);

        if (userName == null) {
            throw new RuntimeException("Invalid token");
        }

        if (gameType == null) {
            gameType = GameType.STANDARD;
        }

        synchronized(this) {
            // If the user already has a pending match, return it
            Long already = matchQueueService.getPendingMatchId(userName);
            if (already != null) {
                return new MatchmakingStatusResponse("MATCHED", already, gameType);
            }

            // Ensure user isn't waiting in other queues
            removeFromAllQueues(userName);

            Map<String, Long> waiting = waitingByType.computeIfAbsent(gameType, gt -> new ConcurrentHashMap<>());
            long now = System.currentTimeMillis();

            // Find opponent in same queue (skip expired entries)
            for (Map.Entry<String, Long> entry : waiting.entrySet()) {
                String opponentName = entry.getKey();
                long enqueuedAt = entry.getValue();
                if (now - enqueuedAt > WAIT_TIMEOUT_MS) {
                    waiting.remove(opponentName);
                    continue;
                }
                if (!opponentName.equals(userName)) {
                    User player1 = userRepo.getUserByUsername(opponentName);
                    User player2 = userRepo.getUserByUsername(userName);
                    if (player1 != null && player2 != null) {
                        // Remove opponent from queue
                        waiting.remove(opponentName);

                        // Create match (opponent is player1/white)
                        Match match = new Match(player1, player2, IN_PROGRESS, 0);
                        match.setGameType(gameType);
                        Match saved = matchRepo.save(match);

                        Long matchId = saved.getId();
                        matchQueueService.addPendingMatch(opponentName, userName, matchId);

                        // Initialize game state
                        gameService.getGameDetails(matchId, request);

                        return new MatchmakingStatusResponse("MATCHED", matchId, gameType);
                    }
                }
            }

            // No opponent found, enqueue
            waiting.put(userName, now);
            return new MatchmakingStatusResponse("WAITING", null, gameType);
        }
    }

    public MatchmakingStatusResponse checkMatch(HttpServletRequest request, GameType gameType) {
        String tk = getJwtFromCookie(request);
        if (tk == null) {
            throw new RuntimeException("Not authenticated");
        }
        String userName = jwtService.extractUsername(tk);

        if (userName == null) {
            throw new RuntimeException("Invalid token");
        }

        synchronized(this) {
            Long matchId = matchQueueService.getPendingMatchId(userName);
            if (matchId != null) {
                return new MatchmakingStatusResponse("MATCHED", matchId, gameType);
            }

            if (gameType == null) {
                // If gameType isn't provided, check if user is waiting in any queue
                for (Map.Entry<GameType, Map<String, Long>> e : waitingByType.entrySet()) {
                    MatchmakingStatusResponse resp = checkWaiting(e.getKey(), e.getValue(), userName);
                    if (resp != null) return resp;
                }
                return new MatchmakingStatusResponse("TIMEOUT", null, null);
            }

            Map<String, Long> waiting = waitingByType.computeIfAbsent(gameType, gt -> new ConcurrentHashMap<>());
            MatchmakingStatusResponse resp = checkWaiting(gameType, waiting, userName);
            if (resp != null) return resp;
        }

        return new MatchmakingStatusResponse("TIMEOUT", null, gameType);
    }

    // Method to cancel waiting
    public boolean cancelWaiting(HttpServletRequest request, GameType gameType) {
        String tk = getJwtFromCookie(request);
        String userName = jwtService.extractUsername(tk);

        if (userName == null) {
            return false;
        }

        synchronized(this) {
            boolean removed;
            if (gameType == null) {
                removed = removeFromAllQueues(userName);
            } else {
                Map<String, Long> waiting = waitingByType.computeIfAbsent(gameType, gt -> new ConcurrentHashMap<>());
                removed = waiting.remove(userName) != null;
            }
            if (removed) {
                System.out.println("User " + userName + " cancelled waiting");
            }
            return removed;
        }
    }

    private boolean removeFromAllQueues(String userName) {
        boolean removed = false;
        for (Map<String, Long> waiting : waitingByType.values()) {
            removed |= (waiting.remove(userName) != null);
        }
        return removed;
    }

    private MatchmakingStatusResponse checkWaiting(GameType gameType, Map<String, Long> waiting, String userName) {
        Long enqueuedAt = waiting.get(userName);
        if (enqueuedAt == null) {
            return null;
        }
        long now = System.currentTimeMillis();
        if (now - enqueuedAt > WAIT_TIMEOUT_MS) {
            waiting.remove(userName);
            return new MatchmakingStatusResponse("TIMEOUT", null, gameType);
        }
        return new MatchmakingStatusResponse("WAITING", null, gameType);
    }

    private Map<String, Object> createPlayerInfo(User user) {
        Map<String, Object> playerInfo = new HashMap<>();
        playerInfo.put("id", user.getUserId());
        playerInfo.put("username", user.getUsername());
        // Add other user info if needed
        return playerInfo;
    }

    private boolean determineIfMyTurn(Match match, boolean isPlayer1) {
        // Simple logic: if currentPly is even, it's white's turn
        // You may need more sophisticated logic based on your game state
        Integer currentPly = match.getCurrentPly();
        if (currentPly == null) {
            currentPly = 0;
        }

        // Even ply = white's turn, odd ply = black's turn
        boolean isWhiteTurn = currentPly % 2 == 0;

        // Player1 is white, Player2 is black
        return (isPlayer1 && isWhiteTurn) || (!isPlayer1 && !isWhiteTurn);
    }

    public Map<String, Object> getGameDetailsForFrontend(Long matchId, HttpServletRequest request) {
        String token = getJwtFromCookie(request);
        if (token == null) {
            throw new RuntimeException("Not authenticated");
        }

        String username = jwtService.extractUsername(token);
        if (username == null) {
            throw new RuntimeException("Invalid token");
        }

        // Find the match
        Optional<Match> matchOpt = matchRepo.findById(matchId);
        if (matchOpt.isEmpty()) {
            throw new RuntimeException("Game not found");
        }

        Match match = matchOpt.get();

        // Check if user is part of this match
        User player1 = match.getPlayer1();
        User player2 = match.getPlayer2();

        boolean isPlayer1 = player1.getUsername().equals(username);
        boolean isPlayer2 = player2 != null && player2.getUsername().equals(username);

        if (!isPlayer1 && !isPlayer2) {
            throw new RuntimeException("Not authorized to view this game");
        }

        // Determine player color
        String playerColor = isPlayer1 ? "white" : "black";

        // Determine if it's this player's turn
        // For initial implementation: white starts, then alternate based on currentPly
        boolean isMyTurn = determineIfMyTurn(match, isPlayer1);

        // Create response
        Map<String, Object> response = new HashMap<>();
        response.put("matchId", match.getId());
        response.put("player1", createPlayerInfo(player1));

        if (player2 != null) {
            response.put("player2", createPlayerInfo(player2));
        }

        response.put("status", match.getStatus() != null ? match.getStatus().toString() : "IN_PROGRESS");
        response.put("playerColor", playerColor);
        response.put("isMyTurn", isMyTurn);
        response.put("createdAt", match.getCreatedAt());
        response.put("startedAt", match.getStartedAt());
        response.put("currentPly", match.getCurrentPly());
        response.put("fenCurrent", match.getFenCurrent());

        return response;
    }

    public String sendChallenge(HttpServletRequest request, String opponentUsername, GameType gameType) {
        String tk = getJwtFromCookie(request);
        if (tk == null) {
            throw new RuntimeException("Not authenticated");
        }
        String userName = jwtService.extractUsername(tk);
        if (userName == null) {
            throw new RuntimeException("Invalid token");
        }

        if (userName.equals(opponentUsername)) {
            throw new RuntimeException("Cannot challenge yourself");
        }

        User opponent = userRepo.getUserByUsername(opponentUsername);
        if (opponent == null) {
            throw new RuntimeException("User not found");
        }

        if (gameType == null) {
            gameType = GameType.STANDARD;
        }

        return challengeService.createChallenge(userName, opponentUsername, gameType);
    }

    public List<ChallengeResponse> getIncomingChallenges(HttpServletRequest request) {
        String tk = getJwtFromCookie(request);
        if (tk == null) {
            throw new RuntimeException("Not authenticated");
        }
        String userName = jwtService.extractUsername(tk);
        if (userName == null) {
            throw new RuntimeException("Invalid token");
        }
        return challengeService.getIncomingChallenges(userName);
    }

    public List<ChallengeResponse> getOutgoingChallenges(HttpServletRequest request) {
        String tk = getJwtFromCookie(request);
        if (tk == null) {
            throw new RuntimeException("Not authenticated");
        }
        String userName = jwtService.extractUsername(tk);
        if (userName == null) {
            throw new RuntimeException("Invalid token");
        }
        return challengeService.getOutgoingChallenges(userName);
    }

    public MatchmakingStatusResponse acceptChallenge(HttpServletRequest request, String challengeId) {
        String tk = getJwtFromCookie(request);
        if (tk == null) {
            throw new RuntimeException("Not authenticated");
        }
        String userName = jwtService.extractUsername(tk);
        if (userName == null) {
            throw new RuntimeException("Invalid token");
        }

        ChallengeService.ChallengeData challenge = challengeService.acceptChallenge(challengeId, userName);
        if (challenge == null) {
            throw new RuntimeException("Challenge not found or expired");
        }

        // Create direct match
        User player1 = userRepo.getUserByUsername(challenge.fromUsername);
        User player2 = userRepo.getUserByUsername(challenge.toUsername);
        if (player1 == null || player2 == null) {
            throw new RuntimeException("User not found");
        }

        Match match = new Match(player1, player2, IN_PROGRESS, 0);
        match.setGameType(challenge.gameType);
        Match saved = matchRepo.save(match);

        Long matchId = saved.getId();
        matchQueueService.addPendingMatch(challenge.fromUsername, challenge.toUsername, matchId);

        // Initialize game state
        gameService.getGameDetails(matchId, request);

        return new MatchmakingStatusResponse("MATCHED", matchId, challenge.gameType);
    }

    public boolean declineChallenge(HttpServletRequest request, String challengeId) {
        String tk = getJwtFromCookie(request);
        if (tk == null) {
            throw new RuntimeException("Not authenticated");
        }
        String userName = jwtService.extractUsername(tk);
        if (userName == null) {
            throw new RuntimeException("Invalid token");
        }
        return challengeService.declineChallenge(challengeId, userName);
    }

    public boolean cancelChallenge(HttpServletRequest request, String challengeId) {
        String tk = getJwtFromCookie(request);
        if (tk == null) {
            throw new RuntimeException("Not authenticated");
        }
        String userName = jwtService.extractUsername(tk);
        if (userName == null) {
            throw new RuntimeException("Invalid token");
        }
        return challengeService.cancelChallenge(challengeId, userName);
    }
}