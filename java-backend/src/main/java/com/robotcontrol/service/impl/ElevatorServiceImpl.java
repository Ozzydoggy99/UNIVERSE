package com.robotcontrol.service.impl;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.robotcontrol.model.Elevator;
import com.robotcontrol.model.ElevatorAccess;
import com.robotcontrol.model.navigation.MapPoint;
import com.robotcontrol.service.ElevatorService;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.client.methods.CloseableHttpResponse;
import org.apache.http.client.methods.HttpGet;
import org.apache.http.client.methods.HttpPost;
import org.apache.http.entity.StringEntity;
import org.apache.http.impl.client.CloseableHttpClient;
import org.apache.http.impl.client.HttpClients;
import org.apache.http.util.EntityUtils;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

@Service
@Slf4j
public class ElevatorServiceImpl implements ElevatorService {
    
    @Value("${elevator.api.baseUrl:#{null}}")
    private String elevatorApiBaseUrl;
    
    @Value("${elevator.api.key:#{null}}")
    private String elevatorApiKey;
    
    // Currently reserved elevators (elevatorId -> robotSerialNumber)
    private final Map<Long, String> elevatorReservations = new ConcurrentHashMap<>();
    
    // Currently active elevators and their statuses
    private final Map<Long, Elevator> activeElevators = new ConcurrentHashMap<>();
    
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final CloseableHttpClient httpClient = HttpClients.createDefault();
    
    @Override
    public List<Elevator> getElevatorsByBuilding(Long buildingId) {
        // This could come from a database or external API
        // For simplicity, we're returning active elevators from our in-memory store
        return activeElevators.values().stream()
                .filter(elevator -> elevator.getBuilding() != null && 
                        elevator.getBuilding().getId().equals(buildingId))
                .collect(Collectors.toList());
    }
    
    @Override
    public List<ElevatorAccess> getElevatorAccessPointsByFloor(Long floorId) {
        // This would typically come from a database
        // For simplicity, we're mocking the implementation
        // In a real implementation, we would query the database for elevator access points
        // on the specified floor
        return new ArrayList<>();
    }
    
    @Override
    public boolean reserveElevator(Long elevatorId, String robotSerialNumber, Integer fromFloor, Integer toFloor) {
        // Check if elevator is already reserved
        if (elevatorReservations.containsKey(elevatorId)) {
            log.warn("Elevator {} is already reserved by robot {}", 
                    elevatorId, elevatorReservations.get(elevatorId));
            return false;
        }
        
        try {
            if (elevatorApiBaseUrl != null) {
                // Call external elevator API to reserve
                HttpPost request = new HttpPost(elevatorApiBaseUrl + "/elevators/" + elevatorId + "/reserve");
                request.addHeader("X-API-Key", elevatorApiKey);
                request.addHeader("Content-Type", "application/json");
                
                Map<String, Object> payload = new HashMap<>();
                payload.put("robotSerialNumber", robotSerialNumber);
                payload.put("fromFloor", fromFloor);
                payload.put("toFloor", toFloor);
                
                StringEntity entity = new StringEntity(objectMapper.writeValueAsString(payload));
                request.setEntity(entity);
                
                try (CloseableHttpResponse response = httpClient.execute(request)) {
                    int statusCode = response.getStatusLine().getStatusCode();
                    if (statusCode >= 200 && statusCode < 300) {
                        // Successfully reserved
                        elevatorReservations.put(elevatorId, robotSerialNumber);
                        return true;
                    } else {
                        log.error("Failed to reserve elevator: HTTP {}", statusCode);
                        return false;
                    }
                }
            } else {
                // No external API configured, just reserve locally
                elevatorReservations.put(elevatorId, robotSerialNumber);
                return true;
            }
        } catch (Exception e) {
            log.error("Error reserving elevator: {}", e.getMessage(), e);
            return false;
        }
    }
    
    @Override
    public boolean releaseElevator(Long elevatorId, String robotSerialNumber) {
        // Check if elevator is reserved by this robot
        if (!elevatorReservations.containsKey(elevatorId) || 
                !elevatorReservations.get(elevatorId).equals(robotSerialNumber)) {
            log.warn("Elevator {} is not reserved by robot {}", elevatorId, robotSerialNumber);
            return false;
        }
        
        try {
            if (elevatorApiBaseUrl != null) {
                // Call external elevator API to release
                HttpPost request = new HttpPost(elevatorApiBaseUrl + "/elevators/" + elevatorId + "/release");
                request.addHeader("X-API-Key", elevatorApiKey);
                request.addHeader("Content-Type", "application/json");
                
                Map<String, Object> payload = new HashMap<>();
                payload.put("robotSerialNumber", robotSerialNumber);
                
                StringEntity entity = new StringEntity(objectMapper.writeValueAsString(payload));
                request.setEntity(entity);
                
                try (CloseableHttpResponse response = httpClient.execute(request)) {
                    int statusCode = response.getStatusLine().getStatusCode();
                    if (statusCode >= 200 && statusCode < 300) {
                        // Successfully released
                        elevatorReservations.remove(elevatorId);
                        return true;
                    } else {
                        log.error("Failed to release elevator: HTTP {}", statusCode);
                        return false;
                    }
                }
            } else {
                // No external API configured, just release locally
                elevatorReservations.remove(elevatorId);
                return true;
            }
        } catch (Exception e) {
            log.error("Error releasing elevator: {}", e.getMessage(), e);
            return false;
        }
    }
    
    @Override
    public Elevator getElevatorStatus(Long elevatorId) {
        try {
            if (elevatorApiBaseUrl != null) {
                // Call external elevator API to get status
                HttpGet request = new HttpGet(elevatorApiBaseUrl + "/elevators/" + elevatorId);
                request.addHeader("X-API-Key", elevatorApiKey);
                
                try (CloseableHttpResponse response = httpClient.execute(request)) {
                    String jsonResponse = EntityUtils.toString(response.getEntity());
                    Elevator elevator = objectMapper.readValue(jsonResponse, Elevator.class);
                    
                    // Update our local cache
                    activeElevators.put(elevatorId, elevator);
                    
                    return elevator;
                }
            } else {
                // No external API configured, return from local cache if available
                return activeElevators.get(elevatorId);
            }
        } catch (Exception e) {
            log.error("Error getting elevator status: {}", e.getMessage(), e);
            return null;
        }
    }
    
    @Override
    public boolean callElevator(Long elevatorId, Integer floorNumber) {
        try {
            if (elevatorApiBaseUrl != null) {
                // Call external elevator API to call elevator
                HttpPost request = new HttpPost(elevatorApiBaseUrl + "/elevators/" + elevatorId + "/call");
                request.addHeader("X-API-Key", elevatorApiKey);
                request.addHeader("Content-Type", "application/json");
                
                Map<String, Object> payload = new HashMap<>();
                payload.put("floorNumber", floorNumber);
                
                StringEntity entity = new StringEntity(objectMapper.writeValueAsString(payload));
                request.setEntity(entity);
                
                try (CloseableHttpResponse response = httpClient.execute(request)) {
                    int statusCode = response.getStatusLine().getStatusCode();
                    return statusCode >= 200 && statusCode < 300;
                }
            } else {
                // No external API configured, just simulate success
                return true;
            }
        } catch (Exception e) {
            log.error("Error calling elevator: {}", e.getMessage(), e);
            return false;
        }
    }
    
    @Override
    public boolean sendElevatorToFloor(Long elevatorId, Integer floorNumber) {
        try {
            if (elevatorApiBaseUrl != null) {
                // Call external elevator API to send elevator to floor
                HttpPost request = new HttpPost(elevatorApiBaseUrl + "/elevators/" + elevatorId + "/send");
                request.addHeader("X-API-Key", elevatorApiKey);
                request.addHeader("Content-Type", "application/json");
                
                Map<String, Object> payload = new HashMap<>();
                payload.put("floorNumber", floorNumber);
                
                StringEntity entity = new StringEntity(objectMapper.writeValueAsString(payload));
                request.setEntity(entity);
                
                try (CloseableHttpResponse response = httpClient.execute(request)) {
                    int statusCode = response.getStatusLine().getStatusCode();
                    return statusCode >= 200 && statusCode < 300;
                }
            } else {
                // No external API configured, just simulate success
                return true;
            }
        } catch (Exception e) {
            log.error("Error sending elevator to floor: {}", e.getMessage(), e);
            return false;
        }
    }
    
    @Override
    public boolean holdElevatorDoors(Long elevatorId) {
        try {
            if (elevatorApiBaseUrl != null) {
                // Call external elevator API to hold doors
                HttpPost request = new HttpPost(elevatorApiBaseUrl + "/elevators/" + elevatorId + "/holdDoors");
                request.addHeader("X-API-Key", elevatorApiKey);
                
                try (CloseableHttpResponse response = httpClient.execute(request)) {
                    int statusCode = response.getStatusLine().getStatusCode();
                    return statusCode >= 200 && statusCode < 300;
                }
            } else {
                // No external API configured, just simulate success
                return true;
            }
        } catch (Exception e) {
            log.error("Error holding elevator doors: {}", e.getMessage(), e);
            return false;
        }
    }
    
    @Override
    public List<MapPoint> calculateMultiFloorPath(String robotSerialNumber, Long startFloorId, MapPoint startPoint, 
                                                 Long endFloorId, MapPoint endPoint) {
        // This is a complex operation that would require:
        // 1. Find the optimal elevator to use
        // 2. Calculate path from startPoint to elevator access point on startFloor
        // 3. Calculate path from elevator exit point on endFloor to endPoint
        // 4. Combine these paths with elevator transition
        
        // For simplicity, we're returning a basic implementation
        List<MapPoint> path = new ArrayList<>();
        
        // Add start point
        path.add(startPoint);
        
        // In a real implementation, we would add additional waypoints for:
        // - Path to elevator on start floor
        // - Elevator entry point
        // - Elevator exit point on destination floor
        // - Path to destination
        
        // Add end point
        path.add(endPoint);
        
        return path;
    }
    
    @Override
    public Elevator findOptimalElevator(Long buildingId, Integer fromFloor, Integer toFloor) {
        // In a real implementation, this would:
        // 1. Find all elevators in the building that can access both floors
        // 2. Check their current status, position, and direction
        // 3. Calculate estimated wait time for each
        // 4. Return the one with shortest estimated wait time
        
        // For simplicity, we're returning the first active elevator that can reach both floors
        return activeElevators.values().stream()
                .filter(elevator -> elevator.getBuilding() != null && 
                        elevator.getBuilding().getId().equals(buildingId))
                .filter(elevator -> elevator.getAccessPoints().stream()
                        .anyMatch(ap -> ap.getFloor().getFloorNumber() == fromFloor) &&
                        elevator.getAccessPoints().stream()
                        .anyMatch(ap -> ap.getFloor().getFloorNumber() == toFloor))
                .findFirst()
                .orElse(null);
    }
}