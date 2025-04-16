package com.robotcontrol.repository;

import com.robotcontrol.model.Elevator;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ElevatorRepository extends JpaRepository<Elevator, Long> {
    
    List<Elevator> findByBuildingId(Long buildingId);
    
    List<Elevator> findByControlSystem(String controlSystem);
    
    @Query("SELECT e FROM Elevator e WHERE e.isOperational = true")
    List<Elevator> findAllOperationalElevators();
    
    @Query("""
           SELECT e FROM Elevator e 
           JOIN e.accessPoints a 
           WHERE a.floor.id = :floorId AND e.isOperational = true
           """)
    List<Elevator> findOperationalElevatorsForFloor(Long floorId);
}