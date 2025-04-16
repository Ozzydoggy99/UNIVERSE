package com.robotcontrol.repository;

import com.robotcontrol.model.RobotStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface RobotStatusRepository extends JpaRepository<RobotStatus, String> {
    
    Optional<RobotStatus> findBySerialNumber(String serialNumber);
    
    void deleteBySerialNumber(String serialNumber);
}