package com.example.IndiChessBackend.controller;

import com.example.IndiChessBackend.model.DTO.LoginDto;
import com.example.IndiChessBackend.model.DTO.LoginResponseDto;
import com.example.IndiChessBackend.model.DTO.SignupRequest;
import com.example.IndiChessBackend.model.DTO.UserResponseDto;
import com.example.IndiChessBackend.model.User;
import com.example.IndiChessBackend.service.AuthService;
import com.example.IndiChessBackend.service.JwtService;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.time.Duration;
import java.util.HashMap;
import java.util.Map;
import jakarta.validation.Valid;

@RestController
@RequestMapping("/")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authservice;
    private final AuthenticationManager authenticationManager;
    private final JwtService jwtService;


    @PostMapping("signup")
    public ResponseEntity<UserResponseDto> handleSignup(@Valid @RequestBody SignupRequest signupRequest){
        User saved = authservice.signup(signupRequest);
        UserResponseDto dto = new UserResponseDto(
                saved.getUserId(),
                saved.getUsername(),
                saved.getEmailId(),
                saved.getRating(),
                saved.getPfpUrl(),
                saved.getCountry()
        );
        return new ResponseEntity<>(dto, HttpStatus.CREATED);
    }

    @PostMapping("login")
    public ResponseEntity<?> handleLogin(HttpServletRequest request,
                                                        HttpServletResponse response,
                                                        @RequestBody LoginDto loginDto) throws IOException {


        Authentication authObject = authenticationManager.
                authenticate(new
                        UsernamePasswordAuthenticationToken
                        (loginDto.getUsername(), loginDto.getPassword()));
        if(authObject.isAuthenticated()) {
            String tk = jwtService.generateToken(loginDto.getUsername());
            System.out.println("Inside Auth controller");
            System.out.println(tk);



            ResponseCookie cookie = ResponseCookie.from("JWT", tk).httpOnly(true).
                    secure(false).sameSite("lax").path("/").maxAge(3600).build();
            response.setHeader(HttpHeaders.SET_COOKIE, cookie.toString());



            return ResponseEntity.ok(tk);
        }

        return new ResponseEntity<>(new LoginResponseDto(null, "Auth Failed"), HttpStatus.BAD_REQUEST);
    }

    @GetMapping("home")
    public ResponseEntity<?> handleHome(){
        System.out.println("Home");
        return ResponseEntity.ok("Home");
    }

    /**
     * SPA-friendly auth check endpoint.
     * - 200 if authenticated (JWT cookie present/valid)
     * - 401 handled by SecurityConfig entrypoint if unauthenticated
     */
    @GetMapping("api/auth/me")
    public ResponseEntity<?> me() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || "anonymousUser".equals(auth.getPrincipal())) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("authenticated", false));
        }

        return ResponseEntity.ok(Map.of(
                "authenticated", true,
                "username", auth.getName()
        ));
    }

    @PostMapping("logout")
    public ResponseEntity<?> logout(HttpServletRequest request, HttpServletResponse response) {
        // Clear JWT cookie
        ResponseCookie cookie = ResponseCookie.from("JWT", "")
                .httpOnly(true)
                .secure(false)
                .sameSite("lax")
                .path("/")
                .maxAge(0)
                .build();
        response.setHeader(HttpHeaders.SET_COOKIE, cookie.toString());

        // Clear security context
        SecurityContextHolder.clearContext();

        // Invalidate any session (used by OAuth2 login state)
        HttpSession session = request.getSession(false);
        if (session != null) {
            session.invalidate();
        }

        return ResponseEntity.ok(Map.of("loggedOut", true));
    }





}
