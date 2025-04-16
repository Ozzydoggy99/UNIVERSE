package com.robotcontrol.repository;

import com.robotcontrol.model.RobotTemplateAssignment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface RobotTemplateAssignmentRepository extends JpaRepository<RobotTemplateAssignment, Long> {
    
    Optional<RobotTemplateAssignment> findBySerialNumber(String serialNumber);
    
    List<RobotTemplateAssignment> findByTemplateId(Long templateId);
    
    @Query("SELECT a FROM RobotTemplateAssignment a WHERE a.isActive = true")
    List<RobotTemplateAssignment> findAllActiveAssignments();
    
    boolean existsBySerialNumber(String serialNumber);
}