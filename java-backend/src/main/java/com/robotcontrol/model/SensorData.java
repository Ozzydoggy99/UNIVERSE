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
@Table(name = "sensor_readings")
public class SensorData {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    private String serialNumber;
    private double temperature;
    private double humidity;
    
    @ElementCollection
    @CollectionTable(name = "proximity_readings", joinColumns = @JoinColumn(name = "sensor_reading_id"))
    @Column(name = "reading")
    private double[] proximity;
    
    private double battery;
    private LocalDateTime timestamp;
    
    // Environmental data that may be relevant for elevator navigation
    private double tilt;
    private double acceleration;
    private boolean doorDetected;
    private boolean obstacleDetected;
}