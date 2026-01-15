package com.example.IndiChessBackend.config;

import com.example.IndiChessBackend.filters.JwtFilter;
import com.example.IndiChessBackend.oauth.OAuth2SuccessHandler;
import com.example.IndiChessBackend.service.MyUserDetailsService;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.AuthenticationProvider;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.util.StringUtils;

import java.util.List;

@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final MyUserDetailsService userDetailService;
    private final JwtFilter jwtFilter;
    private final OAuth2SuccessHandler oAuth2SuccessHandler;
    private final Environment environment;

    @Bean
    PasswordEncoder passwordEncoder(){
        return new BCryptPasswordEncoder();
    }

    @Bean
    public AuthenticationProvider authenticationProvider(){
        // user details service
        DaoAuthenticationProvider auth = new DaoAuthenticationProvider(userDetailService);
        auth.setPasswordEncoder(passwordEncoder());
        return auth;
    }

    @Bean
    public AuthenticationManager authenticationManager(
            AuthenticationConfiguration authenticationConfiguration) throws Exception {
        return authenticationConfiguration.getAuthenticationManager();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        // Allow any localhost port (covers CRA dev server, etc.)
        configuration.setAllowedOriginPatterns(List.of("http://localhost:*", "http://127.0.0.1:*"));
        configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS"));  // Allow all HTTP methods (GET, POST, PUT, DELETE, etc.)
        configuration.setAllowedHeaders(List.of("*"));
        configuration.setAllowCredentials(true); // Allow credentials (cookies, JWT tokens)

        configuration.setMaxAge(3600L);

        // Register this configuration for all endpoints
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }



    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                .cors(c -> c.configurationSource(corsConfigurationSource()))
                .csrf(csrf -> csrf.disable())
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                        // Public endpoints (SPA auth-check must be public to avoid noisy 401 network errors)
                        .requestMatchers("/login", "/signup", "/logout", "/api/auth/me", "/oauth2/**", "/login/oauth2/**").permitAll()
                        .anyRequest().authenticated()
                )
                // OAuth2 login needs a session (for state); JWT APIs still work fine with IF_REQUIRED.
                .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.IF_REQUIRED))
                .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class);

        // We implement our own JSON logout endpoint in AuthController; disable Spring Security's default
        // logout behavior (which redirects to /login?logout and causes 405s in our API-style setup).
        http.logout(logout -> logout.disable());

        // For SPA fetch/XHR calls we never want redirect loops; respond with 401 instead.
        http.exceptionHandling(eh -> eh.authenticationEntryPoint((request, response, authException) -> {
            response.sendError(401, "Unauthorized");
        }));

        // Only enable OAuth2 login if client registration is configured (prevents startup failure with blank env vars)
        String googleClientId = environment.getProperty("spring.security.oauth2.client.registration.google.client-id");
        if (StringUtils.hasText(googleClientId)) {
            http.oauth2Login(oauth -> oauth
                    .successHandler(oAuth2SuccessHandler)
            );
        }

        return http.build();
    }


}
