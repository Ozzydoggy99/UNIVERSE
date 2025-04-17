package com.robotcontrol.ai.task;

import lombok.Builder;
import lombok.Data;

/**
 * Class to represent robot capabilities
 */
@Data
@Builder
public class RobotCapabilities {
    
    // Robot identification
    private String serialNumber;
    private String model;
    
    // Movement capabilities
    private double maxSpeed; // meters per second
    private double maxAcceleration;
    private double maxDeceleration;
    private double maxClimbAngle; // degrees
    private double maxPayloadWeight; // kg
    
    // Feature capabilities
    private boolean hasArm;
    private boolean hasCamera;
    private boolean hasCleaning;
    private boolean hasVacuum;
    private boolean hasMicrophone;
    private boolean hasSpeaker;
    
    // Battery capabilities
    private double maxBatteryCapacity; // Wh
    private double typicalRuntime; // hours
    private double chargingRate; // percent per minute
    
    // Sensors
    private boolean hasProximitySensors;
    private boolean hasTemperatureSensor;
    private boolean hasHumiditySensor;
    private boolean hasInfraredCamera;
    private boolean hasLidar;
    
    // Navigation
    private boolean canUseElevators;
    private boolean canOpenDoors;
    private boolean canNavigateOutdoors;
    
    // Communications
    private boolean hasWifi;
    private boolean hasBluetooth;
    private boolean hasCellular;
    
    // Software capabilities
    private boolean hasVoiceRecognition;
    private boolean hasObjectRecognition;
    private boolean hasFaceRecognition;
    private boolean hasAutonomousNavigation;
}