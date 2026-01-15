package com.example.IndiChessBackend.model.DTO;

import com.example.IndiChessBackend.model.GameType;

public record MatchmakingStatusResponse(
        String status, // WAITING | MATCHED | TIMEOUT
        Long matchId,
        GameType gameType
) {}


