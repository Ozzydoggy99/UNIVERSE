package com.robotcontrol.service.impl;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.robotcontrol.model.RobotPosition;
import com.robotcontrol.model.RobotStatus;
import com.robotcontrol.model.SensorData;
import com.robotcontrol.model.axbot.AxBotCommand;
import com.robotcontrol.model.axbot.AxBotResponse;
import com.robotcontrol.model.navigation.MapData;
import com.robotcontrol.service.AxBotService;
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

import java.util.ArrayList;
import java.util.List;

@Service
@Slf4j
public class AxBotServiceImpl implements AxBotService {
    
    @Value("${axbot.api.baseUrl}")
    private String baseUrl;
    
    @Value("${axbot.api.key}")
    private String apiKey;
    
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final CloseableHttpClient httpClient = HttpClients.createDefault();
    
    @Override
    public RobotStatus getRobotStatus(String serialNumber) {
        try {
            HttpGet request = new HttpGet(baseUrl + "/robots/status/" + serialNumber);
            request.addHeader("X-API-Key", apiKey);
            
            try (CloseableHttpResponse response = httpClient.execute(request)) {
                String jsonResponse = EntityUtils.toString(response.getEntity());
                return objectMapper.readValue(jsonResponse, RobotStatus.class);
            }
        } catch (Exception e) {
            log.error("Error getting robot status: {}", e.getMessage(), e);
            return null;
        }
    }
    
    @Override
    public RobotPosition getRobotPosition(String serialNumber) {
        try {
            HttpGet request = new HttpGet(baseUrl + "/robots/position/" + serialNumber);
            request.addHeader("X-API-Key", apiKey);
            
            try (CloseableHttpResponse response = httpClient.execute(request)) {
                String jsonResponse = EntityUtils.toString(response.getEntity());
                return objectMapper.readValue(jsonResponse, RobotPosition.class);
            }
        } catch (Exception e) {
            log.error("Error getting robot position: {}", e.getMessage(), e);
            return null;
        }
    }
    
    @Override
    public SensorData getRobotSensorData(String serialNumber) {
        try {
            HttpGet request = new HttpGet(baseUrl + "/robots/sensors/" + serialNumber);
            request.addHeader("X-API-Key", apiKey);
            
            try (CloseableHttpResponse response = httpClient.execute(request)) {
                String jsonResponse = EntityUtils.toString(response.getEntity());
                return objectMapper.readValue(jsonResponse, SensorData.class);
            }
        } catch (Exception e) {
            log.error("Error getting robot sensor data: {}", e.getMessage(), e);
            return null;
        }
    }
    
    @Override
    public MapData getRobotMap(String serialNumber) {
        try {
            HttpGet request = new HttpGet(baseUrl + "/robots/map/" + serialNumber);
            request.addHeader("X-API-Key", apiKey);
            
            try (CloseableHttpResponse response = httpClient.execute(request)) {
                String jsonResponse = EntityUtils.toString(response.getEntity());
                return objectMapper.readValue(jsonResponse, MapData.class);
            }
        } catch (Exception e) {
            log.error("Error getting robot map: {}", e.getMessage(), e);
            return null;
        }
    }
    
    @Override
    public AxBotResponse sendCommand(AxBotCommand command) {
        try {
            HttpPost request = new HttpPost(baseUrl + "/robots/command");
            request.addHeader("X-API-Key", apiKey);
            request.addHeader("Content-Type", "application/json");
            
            String jsonCommand = objectMapper.writeValueAsString(command);
            StringEntity entity = new StringEntity(jsonCommand);
            request.setEntity(entity);
            
            try (CloseableHttpResponse response = httpClient.execute(request)) {
                String jsonResponse = EntityUtils.toString(response.getEntity());
                return objectMapper.readValue(jsonResponse, AxBotResponse.class);
            }
        } catch (Exception e) {
            log.error("Error sending command to robot: {}", e.getMessage(), e);
            return AxBotResponse.error("Error sending command: " + e.getMessage());
        }
    }
    
    @Override
    public List<RobotStatus> getAllRobotStatuses() {
        try {
            HttpGet request = new HttpGet(baseUrl + "/robots/statuses");
            request.addHeader("X-API-Key", apiKey);
            
            try (CloseableHttpResponse response = httpClient.execute(request)) {
                String jsonResponse = EntityUtils.toString(response.getEntity());
                return objectMapper.readValue(jsonResponse, 
                        objectMapper.getTypeFactory().constructCollectionType(List.class, RobotStatus.class));
            }
        } catch (Exception e) {
            log.error("Error getting all robot statuses: {}", e.getMessage(), e);
            return new ArrayList<>();
        }
    }
    
    @Override
    public AxBotResponse navigateToPosition(String serialNumber, double x, double y, int floor) {
        AxBotCommand command = AxBotCommand.builder()
                .serialNumber(serialNumber)
                .commandType(AxBotCommand.CommandType.NAVIGATE_TO_POSITION)
                .targetX(x)
                .targetY(y)
                .targetFloor(floor)
                .build();
        
        return sendCommand(command);
    }
    
    @Override
    public AxBotResponse navigateToUnit(String serialNumber, String unitId) {
        AxBotCommand command = AxBotCommand.builder()
                .serialNumber(serialNumber)
                .commandType(AxBotCommand.CommandType.NAVIGATE_TO_UNIT)
                .commandPayload(unitId)
                .build();
        
        return sendCommand(command);
    }
    
    @Override
    public AxBotResponse useElevator(String serialNumber, String elevatorId, int fromFloor, int toFloor) {
        // This is a multi-step process:
        // 1. Navigate to elevator on current floor
        // 2. Call elevator
        // 3. Enter elevator
        // 4. Select destination floor
        // 5. Exit elevator at destination floor
        
        // Step 1: Navigate to elevator (simplified)
        AxBotCommand navigateCommand = AxBotCommand.builder()
                .serialNumber(serialNumber)
                .commandType(AxBotCommand.CommandType.CALL_ELEVATOR)
                .elevatorId(Long.parseLong(elevatorId))
                .build();
        
        AxBotResponse navigateResponse = sendCommand(navigateCommand);
        if (!navigateResponse.isSuccess()) {
            return navigateResponse;
        }
        
        // Step 2: Enter elevator
        AxBotCommand enterCommand = AxBotCommand.builder()
                .serialNumber(serialNumber)
                .commandType(AxBotCommand.CommandType.ENTER_ELEVATOR)
                .elevatorId(Long.parseLong(elevatorId))
                .enterElevator(true)
                .build();
        
        AxBotResponse enterResponse = sendCommand(enterCommand);
        if (!enterResponse.isSuccess()) {
            return enterResponse;
        }
        
        // Step 3: Select destination floor (Exit elevator)
        AxBotCommand exitCommand = AxBotCommand.builder()
                .serialNumber(serialNumber)
                .commandType(AxBotCommand.CommandType.EXIT_ELEVATOR)
                .elevatorId(Long.parseLong(elevatorId))
                .exitElevator(true)
                .destinationFloor(toFloor)
                .build();
        
        return sendCommand(exitCommand);
    }
}