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
@Table(name = "robot_status")
public class RobotStatus {
    
    @Id
    @Column(name = "serial_number")
    private String serialNumber;
    
    @Column(nullable = false)
    private String model;
    
    @Column(nullable = false)
    private Integer battery;
    
    @Column(nullable = false)
    private String status;
    
    @Column(nullable = false)
    private String mode;
    
    @Column(name = "last_update", nullable = false)
    private LocalDateTime lastUpdate;
    
    @OneToOne(mappedBy = "robotStatus", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private RobotPosition currentPosition;
    
    @OneToOne(mappedBy = "robotStatus", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private RobotSensor currentSensor;
}