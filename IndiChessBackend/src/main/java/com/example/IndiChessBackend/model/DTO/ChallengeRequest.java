package com.example.IndiChessBackend.model.DTO;

import com.example.IndiChessBackend.model.GameType;

public record ChallengeRequest(
        String opponentUsername,
        GameType gameType
) {}

