package com.example.IndiChessBackend.service;

import com.example.IndiChessBackend.model.DTO.UserSearchResponse;
import com.example.IndiChessBackend.model.User;
import com.example.IndiChessBackend.repo.UserRepo;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepo userRepo;
    private final JwtService jwtService;

    public List<UserSearchResponse> searchUsers(String query, HttpServletRequest request) {
        // Get current user to exclude from search results
        final String currentUsername = extractCurrentUsername(request);

        String searchQuery = query.toLowerCase().trim();
        if (searchQuery.isEmpty()) {
            return new ArrayList<>();
        }

        // Simple search: get all users and filter by username containing query
        // In production, you'd want to use a proper search with pagination
        List<User> allUsers = userRepo.findAll();
        return allUsers.stream()
                .filter(user -> {
                    String username = user.getUsername().toLowerCase();
                    return username.contains(searchQuery) && 
                           !Objects.equals(user.getUsername(), currentUsername);
                })
                .limit(10) // Limit to 10 results
                .map(user -> new UserSearchResponse(user.getUserId(), user.getUsername()))
                .collect(Collectors.toList());
    }

    private String extractCurrentUsername(HttpServletRequest request) {
        try {
            String token = getJwtFromCookie(request);
            if (token != null) {
                return jwtService.extractUsername(token);
            }
        } catch (Exception e) {
            // Ignore auth errors for search
        }
        return null;
    }

    private String getJwtFromCookie(HttpServletRequest request) {
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

}
