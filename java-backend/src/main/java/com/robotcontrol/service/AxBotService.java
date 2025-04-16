package com.robotcontrol.service;

import com.robotcontrol.model.RobotPosition;
import com.robotcontrol.model.RobotStatus;
import com.robotcontrol.model.SensorData;
import com.robotcontrol.model.axbot.AxBotCommand;
import com.robotcontrol.model.axbot.AxBotResponse;
import com.robotcontrol.model.navigation.MapData;

import java.util.List;

/**
 * Service interface for AxBot API operations
 */
public interface AxBotService {
    
    /**
     * Get the status of a robot
     */
    RobotStatus getRobotStatus(String serialNumber);
    
    /**
     * Get the current position of a robot
     */
    RobotPosition getRobotPosition(String serialNumber);
    
    /**
     * Get sensor data from a robot
     */
    SensorData getRobotSensorData(String serialNumber);
    
    /**
     * Get map data for a robot
     */
    MapData getRobotMap(String serialNumber);
    
    /**
     * Send a command to a robot
     */
    AxBotResponse sendCommand(AxBotCommand command);
    
    /**
     * Get a list of all connected robots
     */
    List<RobotStatus> getAllRobotStatuses();
    
    /**
     * Navigate a robot to a specific position
     */
    AxBotResponse navigateToPosition(String serialNumber, double x, double y, int floor);
    
    /**
     * Navigate a robot to a specific unit
     */
    AxBotResponse navigateToUnit(String serialNumber, String unitId);
    
    /**
     * Use elevator to move to another floor
     */
    AxBotResponse useElevator(String serialNumber, String elevatorId, int fromFloor, int toFloor);
}