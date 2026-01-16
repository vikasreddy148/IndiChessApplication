package com.example.IndiChessBackend.controller;

import com.example.IndiChessBackend.model.DTO.*;
import com.example.IndiChessBackend.model.GameType;
import com.example.IndiChessBackend.service.MatchService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import jakarta.validation.Valid;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/game")
@RequiredArgsConstructor
public class MatchController {

    private final MatchService matchService;

    @PostMapping
    public ResponseEntity<MatchmakingStatusResponse> createMatch(
            HttpServletRequest request,
            @RequestBody(required = false) @Valid StartMatchRequest body,
            @RequestParam(value = "type", required = false) GameType type
    ) {
        GameType gameType = body != null ? body.gameType() : type;
        return ResponseEntity.ok(matchService.createMatch(request, gameType));
    }

    @GetMapping("/check-match")
    public ResponseEntity<MatchmakingStatusResponse> checkMatch(
            HttpServletRequest request,
            @RequestParam(value = "type", required = false) GameType type
    ) {
        return ResponseEntity.ok(matchService.checkMatch(request, type));
    }

    @PostMapping("/cancel-waiting")
    public ResponseEntity<?> cancelWaiting(
            HttpServletRequest request,
            @RequestParam(value = "type", required = false) GameType type
    ) {
        boolean cancelled = matchService.cancelWaiting(request, type);
        return ResponseEntity.ok(java.util.Map.of("cancelled", cancelled));
    }

    @GetMapping("/{matchId}")
    public ResponseEntity<Map<String, Object>> getGameDetails(
            @PathVariable Long matchId,
            HttpServletRequest request) {
        // Delegate to MatchService (errors are handled centrally in GlobalExceptionHandler)
        Map<String, Object> response = matchService.getGameDetailsForFrontend(matchId, request);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/challenge")
    public ResponseEntity<Map<String, Object>> sendChallenge(
            HttpServletRequest request,
            @RequestBody @Valid ChallengeRequest challengeRequest) {
        String challengeId = matchService.sendChallenge(request, challengeRequest.opponentUsername(), challengeRequest.gameType());
        return ResponseEntity.ok(Map.of("challengeId", challengeId, "status", "sent"));
    }

    @GetMapping("/challenges/incoming")
    public ResponseEntity<List<ChallengeResponse>> getIncomingChallenges(HttpServletRequest request) {
        List<ChallengeResponse> challenges = matchService.getIncomingChallenges(request);
        return ResponseEntity.ok(challenges);
    }

    @GetMapping("/challenges/outgoing")
    public ResponseEntity<List<ChallengeResponse>> getOutgoingChallenges(HttpServletRequest request) {
        List<ChallengeResponse> challenges = matchService.getOutgoingChallenges(request);
        return ResponseEntity.ok(challenges);
    }

    @PostMapping("/challenge/{challengeId}/accept")
    public ResponseEntity<MatchmakingStatusResponse> acceptChallenge(
            HttpServletRequest request,
            @PathVariable String challengeId) {
        MatchmakingStatusResponse response = matchService.acceptChallenge(request, challengeId);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/challenge/{challengeId}/decline")
    public ResponseEntity<Map<String, Object>> declineChallenge(
            HttpServletRequest request,
            @PathVariable String challengeId) {
        boolean declined = matchService.declineChallenge(request, challengeId);
        return ResponseEntity.ok(Map.of("declined", declined));
    }

    @PostMapping("/challenge/{challengeId}/cancel")
    public ResponseEntity<Map<String, Object>> cancelChallenge(
            HttpServletRequest request,
            @PathVariable String challengeId) {
        boolean cancelled = matchService.cancelChallenge(request, challengeId);
        return ResponseEntity.ok(Map.of("cancelled", cancelled));
    }

}
