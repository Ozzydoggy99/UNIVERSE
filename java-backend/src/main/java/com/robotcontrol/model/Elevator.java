package com.robotcontrol.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import javax.persistence.*;
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
    
    @ManyToOne
    @JoinColumn(name = "building_id", nullable = false)
    private Building building;
    
    @Column(nullable = false)
    private String name;
    
    @Column(nullable = false)
    private String controlSystem;
    
    @Column
    private String apiEndpoint;
    
    @Column
    private String apiKey;
    
    @Column
    private Integer capacity;
    
    @Column(name = "is_operational")
    private Boolean isOperational;
    
    @OneToMany(mappedBy = "elevator", cascade = CascadeType.ALL, orphanRemoval = true)
    private Set<ElevatorAccess> accessPoints;
}