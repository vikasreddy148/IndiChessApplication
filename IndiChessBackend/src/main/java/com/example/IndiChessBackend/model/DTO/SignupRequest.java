package com.example.IndiChessBackend.model.DTO;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record SignupRequest(
        @NotBlank(message = "Username is required")
        @Size(min = 4, max = 50, message = "Username must have characters between 4 and 50")
        String username,

        @NotBlank(message = "Email is required")
        @Email(message = "Email must be valid")
        String emailId,

        @NotBlank(message = "Password is required")
        @Size(min = 6, max = 512, message = "Password must have characters between 6 and 512")
        String password
) {}


