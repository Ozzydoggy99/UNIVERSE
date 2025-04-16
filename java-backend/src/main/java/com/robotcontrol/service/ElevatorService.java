package com.robotcontrol.service;

import com.robotcontrol.model.Elevator;
import com.robotcontrol.model.ElevatorAccess;
import com.robotcontrol.model.navigation.MapPoint;

import java.util.List;

/**
 * Service interface for elevator-related operations
 */
public interface ElevatorService {
    
    /**
     * Get a list of all elevators in a building
     */
    List<Elevator> getElevatorsByBuilding(Long buildingId);
    
    /**
     * Get a list of all elevator access points on a floor
     */
    List<ElevatorAccess> getElevatorAccessPointsByFloor(Long floorId);
    
    /**
     * Reserve an elevator for robot use
     */
    boolean reserveElevator(Long elevatorId, String robotSerialNumber, Integer fromFloor, Integer toFloor);
    
    /**
     * Release an elevator reservation
     */
    boolean releaseElevator(Long elevatorId, String robotSerialNumber);
    
    /**
     * Get the current status of an elevator
     */
    Elevator getElevatorStatus(Long elevatorId);
    
    /**
     * Call an elevator to a specific floor
     */
    boolean callElevator(Long elevatorId, Integer floorNumber);
    
    /**
     * Command elevator to go to a specific floor
     */
    boolean sendElevatorToFloor(Long elevatorId, Integer floorNumber);
    
    /**
     * Hold elevator doors open for robot entry/exit
     */
    boolean holdElevatorDoors(Long elevatorId);
    
    /**
     * Find the optimal route for a robot to go from one floor to another using elevators
     */
    List<MapPoint> calculateMultiFloorPath(String robotSerialNumber, Long startFloorId, MapPoint startPoint, 
                                           Long endFloorId, MapPoint endPoint);
    
    /**
     * Calculate the optimal elevator to use for a given multi-floor journey
     */
    Elevator findOptimalElevator(Long buildingId, Integer fromFloor, Integer toFloor);
}