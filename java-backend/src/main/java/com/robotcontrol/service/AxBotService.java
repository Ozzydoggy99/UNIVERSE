package com.robotcontrol.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.robotcontrol.model.RobotPosition;
import com.robotcontrol.model.RobotStatus;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.Map;

/**
 * Service for interacting with the AxBot API
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AxBotService {

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;
    
    @Value("${axbot.api.url}")
    private String axbotApiUrl;
    
    @Value("${axbot.api.key}")
    private String axbotApiKey;
    
    /**
     * Get robot status from AxBot API
     * @param serialNumber Robot serial number
     * @return Robot status
     */
    public RobotStatus getRobotStatus(String serialNumber) {
        try {
            HttpHeaders headers = createApiHeaders();
            HttpEntity<String> entity = new HttpEntity<>(headers);
            
            ResponseEntity<Map> response = restTemplate.exchange(
                    axbotApiUrl + "/robots/" + serialNumber + "/status", 
                    HttpMethod.GET, 
                    entity, 
                    Map.class);
            
            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                Map<String, Object> statusData = response.getBody();
                return mapToRobotStatus(serialNumber, statusData);
            } else {
                log.error("Failed to get robot status for {}: {}", serialNumber, response.getStatusCode());
                return null;
            }
        } catch (Exception e) {
            log.error("Error fetching robot status for {}: {}", serialNumber, e.getMessage());
            return null;
        }
    }
    
    /**
     * Get robot position from AxBot API
     * @param serialNumber Robot serial number
     * @return Robot position
     */
    public RobotPosition getRobotPosition(String serialNumber) {
        try {
            HttpHeaders headers = createApiHeaders();
            HttpEntity<String> entity = new HttpEntity<>(headers);
            
            ResponseEntity<Map> response = restTemplate.exchange(
                    axbotApiUrl + "/robots/" + serialNumber + "/position", 
                    HttpMethod.GET, 
                    entity, 
                    Map.class);
            
            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                Map<String, Object> positionData = response.getBody();
                return mapToRobotPosition(serialNumber, positionData);
            } else {
                log.error("Failed to get robot position for {}: {}", serialNumber, response.getStatusCode());
                return null;
            }
        } catch (Exception e) {
            log.error("Error fetching robot position for {}: {}", serialNumber, e.getMessage());
            return null;
        }
    }
    
    /**
     * Send a navigation command to the robot
     * @param serialNumber Robot serial number
     * @param destination Destination coordinates
     * @return Success status
     */
    public boolean sendNavigationCommand(String serialNumber, Map<String, Object> destination) {
        try {
            HttpHeaders headers = createApiHeaders();
            HttpEntity<Map<String, Object>> requestEntity = new HttpEntity<>(destination, headers);
            
            ResponseEntity<Map> response = restTemplate.exchange(
                    axbotApiUrl + "/robots/" + serialNumber + "/navigate", 
                    HttpMethod.POST, 
                    requestEntity, 
                    Map.class);
            
            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                Map<String, Object> responseBody = response.getBody();
                return responseBody.containsKey("success") && (boolean) responseBody.get("success");
            } else {
                log.error("Failed to send navigation command for {}: {}", serialNumber, response.getStatusCode());
                return false;
            }
        } catch (Exception e) {
            log.error("Error sending navigation command for {}: {}", serialNumber, e.getMessage());
            return false;
        }
    }
    
    /**
     * Create API headers with authentication
     * @return HTTP headers
     */
    private HttpHeaders createApiHeaders() {
        HttpHeaders headers = new HttpHeaders();
        headers.set("Authorization", "Bearer " + axbotApiKey);
        headers.set("Content-Type", "application/json");
        return headers;
    }
    
    /**
     * Map API response to RobotStatus object
     * @param serialNumber Robot serial number
     * @param statusData Status data from API
     * @return RobotStatus object
     */
    private RobotStatus mapToRobotStatus(String serialNumber, Map<String, Object> statusData) {
        // Implement mapping logic based on API response structure
        return RobotStatus.builder()
                .serialNumber(serialNumber)
                .model(statusData.getOrDefault("model", "Unknown").toString())
                .battery((Integer) statusData.getOrDefault("battery", 0))
                .status(statusData.getOrDefault("status", "Unknown").toString())
                .mode(statusData.getOrDefault("mode", "Unknown").toString())
                .build();
    }
    
    /**
     * Map API response to RobotPosition object
     * @param serialNumber Robot serial number
     * @param positionData Position data from API
     * @return RobotPosition object
     */
    private RobotPosition mapToRobotPosition(String serialNumber, Map<String, Object> positionData) {
        // Implement mapping logic based on API response structure
        return RobotPosition.builder()
                .x(Double.valueOf(positionData.getOrDefault("x", 0.0).toString()))
                .y(Double.valueOf(positionData.getOrDefault("y", 0.0).toString()))
                .z(Double.valueOf(positionData.getOrDefault("z", 0.0).toString()))
                .orientation(Double.valueOf(positionData.getOrDefault("orientation", 0.0).toString()))
                .speed(Double.valueOf(positionData.getOrDefault("speed", 0.0).toString()))
                .floor((Integer) positionData.getOrDefault("floor", 1))
                .build();
    }
}