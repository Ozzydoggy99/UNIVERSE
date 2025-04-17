package com.robotcontrol.ai.language;

import lombok.Builder;
import lombok.Data;

import java.util.Map;

/**
 * Class to represent a detected user intent from natural language
 */
@Data
@Builder
public class Intent {
    
    public enum IntentType {
        MOVE_TO,         // Command to move to a location
        PICK_UP,         // Command to pick up an item
        DELIVER_TO,      // Command to deliver an item
        CLEAN,           // Command to clean
        FOLLOW,          // Command to follow the user
        STOP,            // Command to stop
        PAUSE,           // Command to pause
        RESUME,          // Command to resume
        STATUS,          // Request for status information
        BATTERY,         // Request for battery information
        HELP,            // Request for help
        LOCATION,        // Request for location information
        UNKNOWN          // Unrecognized intent
    }
    
    // The identified intent type
    private IntentType type;
    
    // Confidence score (0.0 to 1.0)
    private double confidence;
    
    // Original text that was analyzed
    private String rawText;
    
    // Extracted entities from the text (location, object, person, etc.)
    private Map<String, String> entities;
    
    // Any additional parameters extracted from the text
    private Map<String, Object> parameters;
    
    // Context under which this intent was detected (conversation history, etc.)
    private String context;
    
    // Whether the intent is actionable (has all required parameters)
    private boolean actionable;
    
    // If not actionable, what's missing
    private String missingInformation;
}