package com.example.IndiChessBackend.model;

import jakarta.persistence.*;
import jakarta.validation.constraints.FutureOrPresent;
import jakarta.validation.constraints.PastOrPresent;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "matches")
@Data
public class Match {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "player1_id", nullable = false)
    private User player1;

    @ManyToOne
    @JoinColumn(name = "player2_id", nullable = false)
    private User player2;

    @Enumerated(EnumType.STRING)
    private MatchStatus status; // PLAYER1_WON, DRAW, PLAYER2_WON

    private Integer currentPly; // helps with sync & validation

    @Column(name = "fen_current", length = 200)
    private String fenCurrent;

    @Column(name = "last_move_uci", length = 10)
    private String lastMoveUci;

    @OneToMany(
            mappedBy = "match",
            cascade = CascadeType.ALL,
            orphanRemoval = true,
            fetch = FetchType.LAZY
    )
    @OrderBy("ply ASC") // VERY IMPORTANT
    private List<Move> moves = new ArrayList<>();

    @Enumerated(EnumType.STRING)
    private GameType gameType;

    @PastOrPresent
    private LocalDateTime startedAt;

    @FutureOrPresent
    private LocalDateTime finishedAt;

    // ADD THESE FIELDS:
    @Column(name = "created_at", nullable = false, updatable = false)
    @PastOrPresent
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    // Update constructor
    public Match(User player1, User player2, MatchStatus matchStatus, int i) {
        this.player1 = player1;
        this.player2 = player2;
        this.status = matchStatus;
        this.currentPly = i;
        this.createdAt = LocalDateTime.now();
        this.startedAt = LocalDateTime.now();
    }

    public Match(){}

    // Add @PrePersist and @PreUpdate annotations
    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
        this.startedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = LocalDateTime.now();
    }
}