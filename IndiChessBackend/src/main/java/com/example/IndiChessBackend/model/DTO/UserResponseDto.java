package com.example.IndiChessBackend.model.DTO;

public record UserResponseDto(
        Long userId,
        String username,
        String emailId,
        Integer rating,
        String pfpUrl,
        String country
) {}


