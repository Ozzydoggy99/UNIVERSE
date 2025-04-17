package com.robotcontrol.ai;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.Map;

/**
 * Class to represent a human interaction event
 */
@Data
@Builder
public class HumanInteractionEvent {
    
    public enum InteractionType {
        DETECTION,           // Human was detected by sensors
        PROXIMITY_WARNING,   // Human came too close to robot
        PATH_CROSSING,       // Human crossed robot's path
        FOLLOWING,           // Human appeared to follow the robot
        BLOCKING,            // Human blocked robot's path
        APPROACH             // Human approached the robot
    }
    
    public enum ResponseType {
        STOP,                // Robot stopped
        SLOW_DOWN,           // Robot reduced speed
        REROUTE,             // Robot changed path
        WAIT,                // Robot waited for human to pass
        SIGNAL,              // Robot signaled presence (light/sound)
        NO_RESPONSE          // No action was taken
    }
    
    // Robot involved in the interaction
    private String robotSerialNumber;
    
    // Location where interaction occurred
    private double x;
    private double y;
    private double z;
    
    // When the interaction occurred
    private LocalDateTime timestamp;
    
    // Type of interaction
    private InteractionType interactionType;
    
    // How the robot responded
    private ResponseType responseType;
    
    // Estimated distance to human at closest point
    private double minimumDistance;
    
    // How long the interaction lasted (seconds)
    private double durationSeconds;
    
    // Whether the response was appropriate
    private boolean appropriateResponse;
    
    // Additional data about the interaction
    private Map<String, Object> interactionDetails;
    
    // Whether human behavior changed in response to robot
    private boolean humanResponseDetected;
    
    // Description of human response, if detected
    private String humanResponseDescription;
}