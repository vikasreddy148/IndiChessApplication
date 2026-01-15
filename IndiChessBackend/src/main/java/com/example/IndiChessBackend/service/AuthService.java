package com.example.IndiChessBackend.service;


import com.example.IndiChessBackend.model.User;
import com.example.IndiChessBackend.exception.DuplicateResourceException;
import com.example.IndiChessBackend.model.DTO.SignupRequest;
import com.example.IndiChessBackend.repo.UserRepo;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepo userRepo;
    private final PasswordEncoder passwordEncoder;

    public User signup(SignupRequest req){
        if (userRepo.findByUsername(req.username()) != null) {
            throw new DuplicateResourceException("Username already exists");
        }
        if (userRepo.getUserByEmailId(req.emailId()) != null) {
            throw new DuplicateResourceException("Email already exists");
        }

        User user = new User();
        user.setUsername(req.username());
        user.setEmailId(req.emailId());
        user.setPassword(passwordEncoder.encode(req.password()));
        user.setRating(250); // default rating

        User savedUser = userRepo.save(user);

        System.out.println(savedUser);
        return savedUser;
    }


}
