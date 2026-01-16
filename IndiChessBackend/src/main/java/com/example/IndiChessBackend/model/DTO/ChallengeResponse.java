package com.example.IndiChessBackend.model.DTO;

import com.example.IndiChessBackend.model.GameType;

public record ChallengeResponse(
        String challengeId,
        String fromUsername,
        String toUsername,
        GameType gameType,
        Long timestamp
) {}

