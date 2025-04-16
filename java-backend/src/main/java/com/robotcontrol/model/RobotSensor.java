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
@Table(name = "robot_sensors")
public class RobotSensor {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @OneToOne
    @JoinColumn(name = "serial_number", referencedColumnName = "serial_number")
    private RobotStatus robotStatus;
    
    @Column(nullable = false)
    private Double temperature;
    
    @Column(nullable = false)
    private Double humidity;
    
    @Column(name = "proximity_data", columnDefinition = "text")
    private String proximityData;
    
    @Column(nullable = false)
    private Integer battery;
    
    @Column(nullable = false)
    private LocalDateTime timestamp;
}