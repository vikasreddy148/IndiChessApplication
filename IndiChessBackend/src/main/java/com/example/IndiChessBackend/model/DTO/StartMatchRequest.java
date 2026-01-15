package com.example.IndiChessBackend.model.DTO;

import com.example.IndiChessBackend.model.GameType;
import jakarta.validation.constraints.NotNull;

public record StartMatchRequest(
        @NotNull(message = "gameType is required")
        GameType gameType
) {}


