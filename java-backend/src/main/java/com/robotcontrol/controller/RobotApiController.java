package com.robotcontrol.controller;

import com.robotcontrol.model.RobotPosition;
import com.robotcontrol.model.RobotStatus;
import com.robotcontrol.model.SensorData;
import com.robotcontrol.model.axbot.AxBotCommand;
import com.robotcontrol.model.axbot.AxBotResponse;
import com.robotcontrol.model.navigation.MapData;
import com.robotcontrol.service.AxBotService;
import com.robotcontrol.service.ElevatorService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * REST controller for robot API endpoints
 * Mimics the existing Node.js endpoints to ensure compatibility with the frontend
 */
@RestController
@RequestMapping("/api/robots")
@RequiredArgsConstructor
@Slf4j
public class RobotApiController {
    
    private final AxBotService axBotService;
    private final ElevatorService elevatorService;
    
    @GetMapping("/statuses")
    public ResponseEntity<List<RobotStatus>> getAllRobotStatuses() {
        List<RobotStatus> statuses = axBotService.getAllRobotStatuses();
        return ResponseEntity.ok(statuses);
    }
    
    @GetMapping("/status/{serialNumber}")
    public ResponseEntity<RobotStatus> getRobotStatus(@PathVariable String serialNumber) {
        RobotStatus status = axBotService.getRobotStatus(serialNumber);
        if (status == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(status);
    }
    
    @GetMapping("/position/{serialNumber}")
    public ResponseEntity<RobotPosition> getRobotPosition(@PathVariable String serialNumber) {
        RobotPosition position = axBotService.getRobotPosition(serialNumber);
        if (position == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(position);
    }
    
    @GetMapping("/sensors/{serialNumber}")
    public ResponseEntity<SensorData> getRobotSensorData(@PathVariable String serialNumber) {
        SensorData sensorData = axBotService.getRobotSensorData(serialNumber);
        if (sensorData == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(sensorData);
    }
    
    @GetMapping("/map/{serialNumber}")
    public ResponseEntity<MapData> getRobotMap(@PathVariable String serialNumber) {
        MapData mapData = axBotService.getRobotMap(serialNumber);
        if (mapData == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(mapData);
    }
    
    @PostMapping("/command")
    public ResponseEntity<AxBotResponse> sendCommand(@RequestBody AxBotCommand command) {
        AxBotResponse response = axBotService.sendCommand(command);
        return ResponseEntity.ok(response);
    }
    
    @PostMapping("/navigate/{serialNumber}")
    public ResponseEntity<AxBotResponse> navigateRobot(
            @PathVariable String serialNumber,
            @RequestParam double x,
            @RequestParam double y,
            @RequestParam(required = false, defaultValue = "0") int floor) {
        
        AxBotResponse response = axBotService.navigateToPosition(serialNumber, x, y, floor);
        return ResponseEntity.ok(response);
    }
    
    @PostMapping("/navigate-to-unit/{serialNumber}")
    public ResponseEntity<AxBotResponse> navigateToUnit(
            @PathVariable String serialNumber,
            @RequestParam String unitId) {
        
        AxBotResponse response = axBotService.navigateToUnit(serialNumber, unitId);
        return ResponseEntity.ok(response);
    }
    
    @PostMapping("/use-elevator/{serialNumber}")
    public ResponseEntity<Map<String, Object>> useElevator(
            @PathVariable String serialNumber,
            @RequestParam String elevatorId,
            @RequestParam int fromFloor,
            @RequestParam int toFloor) {
        
        AxBotResponse response = axBotService.useElevator(serialNumber, elevatorId, fromFloor, toFloor);
        
        Map<String, Object> result = new HashMap<>();
        result.put("success", response.isSuccess());
        result.put("message", response.getMessage());
        if (response.getData() != null) {
            result.put("data", response.getData());
        }
        
        return ResponseEntity.ok(result);
    }
    
    @GetMapping("/task/{serialNumber}")
    public ResponseEntity<Map<String, Object>> getRobotTask(@PathVariable String serialNumber) {
        // In a real implementation, this would retrieve the current task assignment for the robot
        // For now, we'll return a placeholder response
        Map<String, Object> task = new HashMap<>();
        task.put("serialNumber", serialNumber);
        task.put("taskType", "idle");
        task.put("status", "no active task");
        
        return ResponseEntity.ok(task);
    }
    
    @PostMapping("/stop/{serialNumber}")
    public ResponseEntity<AxBotResponse> stopRobot(@PathVariable String serialNumber) {
        AxBotCommand command = AxBotCommand.builder()
                .serialNumber(serialNumber)
                .commandType(AxBotCommand.CommandType.STOP)
                .build();
        
        AxBotResponse response = axBotService.sendCommand(command);
        return ResponseEntity.ok(response);
    }
}