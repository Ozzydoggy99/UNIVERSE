package com.robotcontrol.model.axbot;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Represents a response from the AxBot API
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AxBotResponse {
    
    private boolean success;
    private String message;
    private String errorCode;
    private Object data; // Can be a status, position, or any other response data
    
    // Common response types
    public static AxBotResponse success(Object data) {
        return AxBotResponse.builder()
                .success(true)
                .data(data)
                .build();
    }
    
    public static AxBotResponse success(String message, Object data) {
        return AxBotResponse.builder()
                .success(true)
                .message(message)
                .data(data)
                .build();
    }
    
    public static AxBotResponse error(String message) {
        return AxBotResponse.builder()
                .success(false)
                .message(message)
                .build();
    }
    
    public static AxBotResponse error(String message, String errorCode) {
        return AxBotResponse.builder()
                .success(false)
                .message(message)
                .errorCode(errorCode)
                .build();
    }
}