package com.example.IndiChessBackend.controller;

import com.example.IndiChessBackend.model.DTO.MatchmakingStatusResponse;
import com.example.IndiChessBackend.model.DTO.StartMatchRequest;
import com.example.IndiChessBackend.model.GameType;
import com.example.IndiChessBackend.service.MatchService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import jakarta.validation.Valid;

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

}
