package com.example.IndiChessBackend.service;

import com.example.IndiChessBackend.model.DTO.ChallengeResponse;
import com.example.IndiChessBackend.model.GameType;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class ChallengeService {
    // Store challenges: challengeId -> ChallengeData
    private static final Map<String, ChallengeData> challenges = new ConcurrentHashMap<>();
    // Store challenges by recipient: username -> Set<challengeId>
    private static final Map<String, Set<String>> challengesByRecipient = new ConcurrentHashMap<>();
    // Store challenges by sender: username -> Set<challengeId>
    private static final Map<String, Set<String>> challengesBySender = new ConcurrentHashMap<>();
    
    private static final long CHALLENGE_TIMEOUT_MS = 300_000L; // 5 minutes

    public static class ChallengeData {
        public String challengeId;
        public String fromUsername;
        public String toUsername;
        public GameType gameType;
        public long createdAt;
        
        ChallengeData(String challengeId, String fromUsername, String toUsername, GameType gameType) {
            this.challengeId = challengeId;
            this.fromUsername = fromUsername;
            this.toUsername = toUsername;
            this.gameType = gameType;
            this.createdAt = System.currentTimeMillis();
        }
        
        boolean isExpired() {
            return System.currentTimeMillis() - createdAt > CHALLENGE_TIMEOUT_MS;
        }
    }

    public String createChallenge(String fromUsername, String toUsername, GameType gameType) {
        // Clean up expired challenges first
        cleanupExpired();
        
        // Check if user already has a pending challenge to this opponent
        Set<String> senderChallenges = challengesBySender.getOrDefault(fromUsername, new HashSet<>());
        for (String challengeId : senderChallenges) {
            ChallengeData existing = challenges.get(challengeId);
            if (existing != null && existing.toUsername.equals(toUsername) && !existing.isExpired()) {
                return challengeId; // Return existing challenge
            }
        }
        
        String challengeId = UUID.randomUUID().toString();
        ChallengeData challenge = new ChallengeData(challengeId, fromUsername, toUsername, gameType);
        
        challenges.put(challengeId, challenge);
        challengesByRecipient.computeIfAbsent(toUsername, k -> ConcurrentHashMap.newKeySet()).add(challengeId);
        challengesBySender.computeIfAbsent(fromUsername, k -> ConcurrentHashMap.newKeySet()).add(challengeId);
        
        return challengeId;
    }

    public ChallengeData getChallenge(String challengeId) {
        cleanupExpired();
        ChallengeData challenge = challenges.get(challengeId);
        if (challenge != null && challenge.isExpired()) {
            removeChallenge(challengeId);
            return null;
        }
        return challenge;
    }

    public List<ChallengeResponse> getIncomingChallenges(String username) {
        cleanupExpired();
        Set<String> recipientChallenges = challengesByRecipient.getOrDefault(username, new HashSet<>());
        List<ChallengeResponse> result = new ArrayList<>();
        
        for (String challengeId : recipientChallenges) {
            ChallengeData challenge = challenges.get(challengeId);
            if (challenge != null && !challenge.isExpired()) {
                result.add(new ChallengeResponse(
                    challenge.challengeId,
                    challenge.fromUsername,
                    challenge.toUsername,
                    challenge.gameType,
                    challenge.createdAt
                ));
            }
        }
        
        return result;
    }

    public List<ChallengeResponse> getOutgoingChallenges(String username) {
        cleanupExpired();
        Set<String> senderChallenges = challengesBySender.getOrDefault(username, new HashSet<>());
        List<ChallengeResponse> result = new ArrayList<>();
        
        for (String challengeId : senderChallenges) {
            ChallengeData challenge = challenges.get(challengeId);
            if (challenge != null && !challenge.isExpired()) {
                result.add(new ChallengeResponse(
                    challenge.challengeId,
                    challenge.fromUsername,
                    challenge.toUsername,
                    challenge.gameType,
                    challenge.createdAt
                ));
            }
        }
        
        return result;
    }

    public ChallengeData acceptChallenge(String challengeId, String acceptingUsername) {
        cleanupExpired();
        ChallengeData challenge = challenges.get(challengeId);
        if (challenge == null || challenge.isExpired()) {
            return null;
        }
        if (!challenge.toUsername.equals(acceptingUsername)) {
            return null; // Only the recipient can accept
        }
        
        // Remove challenge after acceptance
        removeChallenge(challengeId);
        return challenge;
    }

    public boolean declineChallenge(String challengeId, String decliningUsername) {
        cleanupExpired();
        ChallengeData challenge = challenges.get(challengeId);
        if (challenge == null || challenge.isExpired()) {
            return false;
        }
        if (!challenge.toUsername.equals(decliningUsername)) {
            return false; // Only the recipient can decline
        }
        
        removeChallenge(challengeId);
        return true;
    }

    public boolean cancelChallenge(String challengeId, String cancellingUsername) {
        cleanupExpired();
        ChallengeData challenge = challenges.get(challengeId);
        if (challenge == null || challenge.isExpired()) {
            return false;
        }
        if (!challenge.fromUsername.equals(cancellingUsername)) {
            return false; // Only the sender can cancel
        }
        
        removeChallenge(challengeId);
        return true;
    }

    private void removeChallenge(String challengeId) {
        ChallengeData challenge = challenges.remove(challengeId);
        if (challenge != null) {
            challengesByRecipient.getOrDefault(challenge.toUsername, new HashSet<>()).remove(challengeId);
            challengesBySender.getOrDefault(challenge.fromUsername, new HashSet<>()).remove(challengeId);
        }
    }

    private void cleanupExpired() {
        List<String> expiredIds = new ArrayList<>();
        for (Map.Entry<String, ChallengeData> entry : challenges.entrySet()) {
            if (entry.getValue().isExpired()) {
                expiredIds.add(entry.getKey());
            }
        }
        for (String challengeId : expiredIds) {
            removeChallenge(challengeId);
        }
    }
}

