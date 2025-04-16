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
@Table(name = "floors")
public class Floor {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    private int floorNumber;
    private String name; // e.g., "Ground Floor", "Basement", etc.
    
    @ManyToOne
    @JoinColumn(name = "building_id")
    private Building building;
    
    // Map data for this floor
    @Column(columnDefinition = "TEXT")
    private String mapData; // JSON representation of the floor map
    
    @OneToMany(mappedBy = "floor", cascade = CascadeType.ALL, orphanRemoval = true)
    private Set<ElevatorAccess> elevatorAccesses = new HashSet<>();
    
    @OneToMany(mappedBy = "floor", cascade = CascadeType.ALL, orphanRemoval = true)
    private Set<Unit> units = new HashSet<>();
}