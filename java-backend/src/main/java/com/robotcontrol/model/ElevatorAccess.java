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
    @JoinColumn(name = "elevator_id", nullable = false)
    private Elevator elevator;
    
    @ManyToOne
    @JoinColumn(name = "floor_id", nullable = false)
    private Floor floor;
    
    @Column
    private Double x;
    
    @Column
    private Double y;
    
    @Column(name = "access_code")
    private String accessCode;
    
    @Column(name = "is_active")
    private Boolean isActive;
}