package com.robotcontrol.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import javax.persistence.*;
import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "robot_positions")
public class RobotPosition {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    private String serialNumber;
    private double x;
    private double y;
    private double z;
    private double orientation; // in degrees
    private double speed;
    private LocalDateTime timestamp;
    
    // Floor information
    private int floor;
    
    // References to map elements (optional)
    private Long mapId;
    private String locationName; // e.g., "Elevator 1", "Room 302", etc.
}