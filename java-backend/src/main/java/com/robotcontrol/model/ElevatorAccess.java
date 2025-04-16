package com.robotcontrol.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import javax.persistence.*;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "elevator_access_points")
public class ElevatorAccess {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @ManyToOne
    @JoinColumn(name = "elevator_id")
    private Elevator elevator;
    
    @ManyToOne
    @JoinColumn(name = "floor_id")
    private Floor floor;
    
    // Position of the elevator access point on the floor
    private double xPosition;
    private double yPosition;
    
    // Access control
    private boolean restrictedAccess;
    private String accessCode; // Encrypted access code if required
    
    // Navigation information for robots
    private double approachAngle; // Preferred angle to approach the elevator
    private double waitingDistance; // How far to wait from the door
}