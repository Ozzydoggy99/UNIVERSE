package com.robotcontrol.repository;

import com.robotcontrol.model.ElevatorAccess;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ElevatorAccessRepository extends JpaRepository<ElevatorAccess, Long> {
    
    List<ElevatorAccess> findByElevatorId(Long elevatorId);
    
    List<ElevatorAccess> findByFloorId(Long floorId);
    
    Optional<ElevatorAccess> findByElevatorIdAndFloorId(Long elevatorId, Long floorId);
}