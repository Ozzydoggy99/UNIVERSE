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
@Table(name = "robot_template_assignments")
public class RobotTemplateAssignment {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(name = "serial_number", nullable = false, unique = true)
    private String serialNumber;
    
    @ManyToOne
    @JoinColumn(name = "template_id", nullable = false)
    private UITemplate template;
    
    @Column(name = "assigned_at")
    private LocalDateTime assignedAt;
    
    @Column(columnDefinition = "json")
    private String customization;
    
    @Column(name = "is_active")
    private Boolean isActive;
}