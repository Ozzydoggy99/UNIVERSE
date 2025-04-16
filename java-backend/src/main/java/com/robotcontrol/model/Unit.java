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
    
    @ManyToOne
    @JoinColumn(name = "floor_id", nullable = false)
    private Floor floor;
    
    @Column(nullable = false)
    private String number;
    
    @Column
    private String type;
    
    @Column
    private Double x;
    
    @Column
    private Double y;
    
    @Column
    private String customization;
    
    @Column(name = "is_accessible")
    private Boolean isAccessible;
}