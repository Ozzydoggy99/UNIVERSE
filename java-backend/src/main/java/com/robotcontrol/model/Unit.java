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
@Table(name = "units")
public class Unit {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    private String unitNumber; // e.g., "101", "A-2", etc.
    private String unitType;   // e.g., "residential", "office", "laundry", "trash", etc.
    
    @ManyToOne
    @JoinColumn(name = "floor_id")
    private Floor floor;
    
    // Position of the unit on the floor
    private double xPosition;
    private double yPosition;
    
    // Custom configuration for templates
    @Column(columnDefinition = "TEXT")
    private String templateConfiguration; // JSON for template configuration
    
    // Access control
    private boolean restrictedAccess;
    
    // For smart access
    private String accessCode;
    private String unitOwnerContact; // For notifications
}