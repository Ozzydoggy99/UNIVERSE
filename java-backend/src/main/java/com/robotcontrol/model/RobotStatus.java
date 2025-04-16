package com.robotcontrol.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import javax.persistence.Entity;
import javax.persistence.Id;
import javax.persistence.Table;
import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "robot_status")
public class RobotStatus {
    
    @Id
    private String serialNumber;
    
    private String model;
    private int battery;
    private String status; // active, idle, error, charging, etc.
    private String mode;   // autonomous, manual, sleep, etc.
    private LocalDateTime lastUpdate;
    
    // Additional fields for floor/elevator tracking
    private int currentFloor;
    private boolean inElevator;
    private Integer targetFloor; // Null if not currently going to another floor
}