package com.robotcontrol.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.robotcontrol.model.Elevator;
import com.robotcontrol.model.ElevatorAccess;
import com.robotcontrol.repository.ElevatorAccessRepository;
import com.robotcontrol.repository.ElevatorRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

/**
 * Service for interacting with elevators through their control systems
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ElevatorService {

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;
    private final ElevatorRepository elevatorRepository;
    private final ElevatorAccessRepository elevatorAccessRepository;
    
    /**
     * Call an elevator to a specific floor
     * @param elevatorId Elevator ID
     * @param fromFloorId Floor ID to call from
     * @param toFloorId Floor ID to go to
     * @return Success status
     */
    public boolean callElevator(Long elevatorId, Long fromFloorId, Long toFloorId) {
        Optional<Elevator> elevatorOpt = elevatorRepository.findById(elevatorId);
        
        if (elevatorOpt.isEmpty()) {
            log.error("Elevator with ID {} not found", elevatorId);
            return false;
        }
        
        Elevator elevator = elevatorOpt.get();
        
        if (!elevator.getIsOperational()) {
            log.error("Elevator {} is not operational", elevator.getName());
            return false;
        }
        
        Optional<ElevatorAccess> fromAccessOpt = elevatorAccessRepository.findByElevatorIdAndFloorId(elevatorId, fromFloorId);
        Optional<ElevatorAccess> toAccessOpt = elevatorAccessRepository.findByElevatorIdAndFloorId(elevatorId, toFloorId);
        
        if (fromAccessOpt.isEmpty() || toAccessOpt.isEmpty()) {
            log.error("No elevator access found for elevator {} on floors {} and {}", elevatorId, fromFloorId, toFloorId);
            return false;
        }
        
        return sendElevatorCommand(elevator, fromAccessOpt.get(), toAccessOpt.get());
    }
    
    /**
     * Reserve an elevator for robot use
     * @param elevatorId Elevator ID
     * @param robotSerialNumber Robot serial number
     * @param durationSeconds Duration in seconds
     * @return Reservation confirmation or null if failed
     */
    public Map<String, Object> reserveElevator(Long elevatorId, String robotSerialNumber, int durationSeconds) {
        Optional<Elevator> elevatorOpt = elevatorRepository.findById(elevatorId);
        
        if (elevatorOpt.isEmpty()) {
            log.error("Elevator with ID {} not found", elevatorId);
            return null;
        }
        
        Elevator elevator = elevatorOpt.get();
        
        if (!elevator.getIsOperational()) {
            log.error("Elevator {} is not operational", elevator.getName());
            return null;
        }
        
        HttpHeaders headers = createApiHeaders(elevator.getApiKey());
        
        Map<String, Object> requestData = new HashMap<>();
        requestData.put("robotId", robotSerialNumber);
        requestData.put("duration", durationSeconds);
        
        HttpEntity<Map<String, Object>> requestEntity = new HttpEntity<>(requestData, headers);
        
        try {
            ResponseEntity<Map> response = restTemplate.exchange(
                    elevator.getApiEndpoint() + "/reserve", 
                    HttpMethod.POST, 
                    requestEntity, 
                    Map.class);
            
            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                return response.getBody();
            } else {
                log.error("Failed to reserve elevator {}: {}", elevator.getName(), response.getStatusCode());
                return null;
            }
        } catch (Exception e) {
            log.error("Error reserving elevator {}: {}", elevator.getName(), e.getMessage());
            return null;
        }
    }
    
    /**
     * Release an elevator reservation
     * @param elevatorId Elevator ID
     * @param reservationId Reservation ID
     * @return Success status
     */
    public boolean releaseElevator(Long elevatorId, String reservationId) {
        Optional<Elevator> elevatorOpt = elevatorRepository.findById(elevatorId);
        
        if (elevatorOpt.isEmpty()) {
            log.error("Elevator with ID {} not found", elevatorId);
            return false;
        }
        
        Elevator elevator = elevatorOpt.get();
        
        HttpHeaders headers = createApiHeaders(elevator.getApiKey());
        
        Map<String, Object> requestData = new HashMap<>();
        requestData.put("reservationId", reservationId);
        
        HttpEntity<Map<String, Object>> requestEntity = new HttpEntity<>(requestData, headers);
        
        try {
            ResponseEntity<Map> response = restTemplate.exchange(
                    elevator.getApiEndpoint() + "/release", 
                    HttpMethod.POST, 
                    requestEntity, 
                    Map.class);
            
            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                Map<String, Object> responseBody = response.getBody();
                return responseBody.containsKey("success") && (boolean) responseBody.get("success");
            } else {
                log.error("Failed to release elevator {}: {}", elevator.getName(), response.getStatusCode());
                return false;
            }
        } catch (Exception e) {
            log.error("Error releasing elevator {}: {}", elevator.getName(), e.getMessage());
            return false;
        }
    }
    
    /**
     * Get elevator status
     * @param elevatorId Elevator ID
     * @return Status information
     */
    public Map<String, Object> getElevatorStatus(Long elevatorId) {
        Optional<Elevator> elevatorOpt = elevatorRepository.findById(elevatorId);
        
        if (elevatorOpt.isEmpty()) {
            log.error("Elevator with ID {} not found", elevatorId);
            return null;
        }
        
        Elevator elevator = elevatorOpt.get();
        
        HttpHeaders headers = createApiHeaders(elevator.getApiKey());
        HttpEntity<String> entity = new HttpEntity<>(headers);
        
        try {
            ResponseEntity<Map> response = restTemplate.exchange(
                    elevator.getApiEndpoint() + "/status", 
                    HttpMethod.GET, 
                    entity, 
                    Map.class);
            
            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                return response.getBody();
            } else {
                log.error("Failed to get elevator status for {}: {}", elevator.getName(), response.getStatusCode());
                return null;
            }
        } catch (Exception e) {
            log.error("Error getting elevator status for {}: {}", elevator.getName(), e.getMessage());
            return null;
        }
    }
    
    /**
     * Send command to elevator control system
     * @param elevator Elevator
     * @param fromAccess From access point
     * @param toAccess To access point
     * @return Success status
     */
    private boolean sendElevatorCommand(Elevator elevator, ElevatorAccess fromAccess, ElevatorAccess toAccess) {
        HttpHeaders headers = createApiHeaders(elevator.getApiKey());
        
        Map<String, Object> requestData = new HashMap<>();
        requestData.put("action", "call");
        requestData.put("fromFloor", fromAccess.getFloor().getLevel());
        requestData.put("toFloor", toAccess.getFloor().getLevel());
        
        if (fromAccess.getAccessCode() != null) {
            requestData.put("accessCode", fromAccess.getAccessCode());
        }
        
        HttpEntity<Map<String, Object>> requestEntity = new HttpEntity<>(requestData, headers);
        
        try {
            ResponseEntity<Map> response = restTemplate.exchange(
                    elevator.getApiEndpoint() + "/control", 
                    HttpMethod.POST, 
                    requestEntity, 
                    Map.class);
            
            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                Map<String, Object> responseBody = response.getBody();
                return responseBody.containsKey("success") && (boolean) responseBody.get("success");
            } else {
                log.error("Failed to call elevator {}: {}", elevator.getName(), response.getStatusCode());
                return false;
            }
        } catch (Exception e) {
            log.error("Error calling elevator {}: {}", elevator.getName(), e.getMessage());
            return false;
        }
    }
    
    /**
     * Create API headers with authentication
     * @param apiKey API key
     * @return HTTP headers
     */
    private HttpHeaders createApiHeaders(String apiKey) {
        HttpHeaders headers = new HttpHeaders();
        headers.set("Authorization", "Bearer " + apiKey);
        headers.set("Content-Type", "application/json");
        return headers;
    }
}