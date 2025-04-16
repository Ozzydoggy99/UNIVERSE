package com.robotcontrol.model.axbot;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Represents a command to be sent to the AxBot API
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AxBotCommand {
    
    private String serialNumber;
    private CommandType commandType;
    private Object commandPayload; // Specific command details
    
    // For navigation commands
    private Double targetX;
    private Double targetY;
    private Integer targetFloor;
    
    // For elevator commands
    private Long elevatorId;
    private boolean callElevator;
    private boolean enterElevator;
    private boolean exitElevator;
    private Integer destinationFloor;
    
    // For task commands
    private String taskType;
    private String taskParameters;
    
    // For mode commands
    private String mode; // autonomous, manual, etc.
    
    public enum CommandType {
        MOVE,
        STOP,
        CHARGE,
        CHANGE_MODE,
        NAVIGATE_TO_POSITION,
        NAVIGATE_TO_UNIT,
        CALL_ELEVATOR,
        ENTER_ELEVATOR,
        EXIT_ELEVATOR,
        PERFORM_TASK,
        GET_STATUS,
        RESET
    }
}