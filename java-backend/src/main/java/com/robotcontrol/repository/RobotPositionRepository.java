package com.robotcontrol.repository;

import com.robotcontrol.model.RobotPosition;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface RobotPositionRepository extends JpaRepository<RobotPosition, Long> {
    
    @Query("SELECT p FROM RobotPosition p WHERE p.robotStatus.serialNumber = :serialNumber ORDER BY p.timestamp DESC")
    List<RobotPosition> findLatestPositionsBySerialNumber(String serialNumber, Pageable pageable);
    
    @Query("SELECT p FROM RobotPosition p WHERE p.robotStatus.serialNumber = :serialNumber AND p.floor = :floorLevel ORDER BY p.timestamp DESC")
    List<RobotPosition> findPositionsBySerialNumberAndFloor(String serialNumber, Integer floorLevel, Pageable pageable);
}