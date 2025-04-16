package com.robotcontrol.controller;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

/**
 * REST controller for authentication endpoints
 * Mimics the existing Node.js endpoints to ensure compatibility with the frontend
 */
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
@Slf4j
public class AuthController {
    
    private final AuthenticationManager authenticationManager;
    
    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody Map<String, String> loginRequest) {
        try {
            String username = loginRequest.get("username");
            String password = loginRequest.get("password");
            
            Authentication authentication = authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(username, password));
            
            SecurityContextHolder.getContext().setAuthentication(authentication);
            
            // Return user data similar to the Node.js backend
            Map<String, Object> userData = new HashMap<>();
            userData.put("id", 1);
            userData.put("username", username);
            userData.put("role", "admin"); // This should come from the authenticated user
            
            return ResponseEntity.ok(userData);
        } catch (AuthenticationException e) {
            log.error("Authentication failed: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("message", "Invalid username or password"));
        }
    }
    
    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody Map<String, String> registerRequest) {
        try {
            String username = registerRequest.get("username");
            String password = registerRequest.get("password");
            String role = registerRequest.getOrDefault("role", "user");
            
            // In a real implementation, this would create a new user in the database
            // For now, we'll return a placeholder response
            
            // Return user data similar to the Node.js backend
            Map<String, Object> userData = new HashMap<>();
            userData.put("id", 2);
            userData.put("username", username);
            userData.put("role", role);
            
            return ResponseEntity.ok(userData);
        } catch (Exception e) {
            log.error("Registration failed: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("message", "Registration failed: " + e.getMessage()));
        }
    }
    
    @PostMapping("/logout")
    public ResponseEntity<?> logout() {
        SecurityContextHolder.clearContext();
        return ResponseEntity.ok(Map.of("success", true));
    }
    
    @GetMapping("/user")
    public ResponseEntity<?> getCurrentUser(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("message", "Not authenticated"));
        }
        
        // Return user data similar to the Node.js backend
        Map<String, Object> userData = new HashMap<>();
        userData.put("id", 1);
        userData.put("username", authentication.getName());
        userData.put("role", "admin"); // This should come from the authenticated user
        
        return ResponseEntity.ok(userData);
    }
}