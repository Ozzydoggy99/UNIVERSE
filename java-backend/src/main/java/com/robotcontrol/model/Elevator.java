package com.robotcontrol.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import javax.persistence.*;
import java.util.HashSet;
import java.util.Set;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "elevators")
public class Elevator {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    private String name; // e.g., "Elevator A", "Service Elevator", etc.
    
    @ManyToOne
    @JoinColumn(name = "building_id")
    private Building building;
    
    // Elevator capabilities
    private boolean requiresAuthentication;
    private String apiEndpoint; // For controlling the elevator
    private String apiKey;      // For authentication with the elevator system
    
    // Floors this elevator can access
    @OneToMany(mappedBy = "elevator", cascade = CascadeType.ALL, orphanRemoval = true)
    private Set<ElevatorAccess> accessPoints = new HashSet<>();
    
    // Current status
    private int currentFloor;
    private String status; // available, in_use, maintenance, etc.
    private boolean doorOpen;
    
    // For scheduling/reservation
    private boolean reservable;
    
    // For communication
    private String communicationProtocol; // REST, MQTT, etc.
}