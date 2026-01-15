package com.example.IndiChessBackend.oauth;

import com.example.IndiChessBackend.model.User;
import com.example.IndiChessBackend.repo.UserRepo;
import com.example.IndiChessBackend.service.JwtService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.web.authentication.AuthenticationSuccessHandler;
import org.springframework.stereotype.Component;

import java.io.IOException;

@Component
@RequiredArgsConstructor
public class OAuth2SuccessHandler implements AuthenticationSuccessHandler {

    private final JwtService jwtService;
    private final UserRepo userRepo;


    @Override
    public void onAuthenticationSuccess(
            HttpServletRequest request,
            HttpServletResponse response,
            Authentication authentication) throws IOException {

        OAuth2User oauthUser = (OAuth2User) authentication.getPrincipal();

        String email = oauthUser.getAttribute("email");
        String name = oauthUser.getAttribute("name");
        String login = oauthUser.getAttribute("login"); // GitHub
        String sub = oauthUser.getAttribute("sub");     // Google

        // Choose a stable unique username for our system.
        // Prefer email (unique), then GitHub login, then display name.
        String desiredUsername = email != null ? email : (login != null ? login : name);
        if (desiredUsername == null) {
            desiredUsername = authentication.getName();
        }

        // Create or get user from the database
        User user = email != null ? userRepo.getUserByEmailId(email) : userRepo.findByUsername(desiredUsername);
        if (user == null) {
            // User doesn't exist, create the user
            User existing = userRepo.findByUsername(desiredUsername);
            if (existing != null) {
                // Extremely rare (name/login collision). Disambiguate using provider subject if present.
                String suffix = (sub != null && !sub.isBlank()) ? sub : String.valueOf(System.currentTimeMillis());
                desiredUsername = desiredUsername + "-" + suffix;
            }

            user = new User();
            user.setEmailId(email);
            user.setUsername(desiredUsername);
            userRepo.save(user); // Save the new user to the database
        }

        // Generate JWT token using our system username (must match what UserDetailsService expects)
        String jwt = jwtService.generateToken(user.getUsername());

        // Store JWT in HTTP-only cookie (dev-friendly: secure=false on http://localhost)
        ResponseCookie cookie = ResponseCookie.from("JWT", jwt)
                .httpOnly(true)
                .secure(false)
                .sameSite("lax")
                .path("/")
                .maxAge(3600)
                .build();
        response.setHeader(HttpHeaders.SET_COOKIE, cookie.toString());

        response.sendRedirect("http://localhost:3000/home");

    }

}
