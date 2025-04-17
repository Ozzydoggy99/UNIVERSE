package com.robotcontrol.service;

import com.robotcontrol.model.*;
import com.robotcontrol.repository.FloorRepository;
import com.robotcontrol.repository.UnitRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.*;

/**
 * Service for robot navigation and path planning across floors
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class NavigationService {
    
    private final AxBotService axBotService;
    private final ElevatorService elevatorService;
    private final FloorRepository floorRepository;
    private final UnitRepository unitRepository;
    
    /**
     * Plan a path for a robot to navigate to a destination unit
     * @param robotSerialNumber Robot serial number
     * @param unitId Destination unit ID
     * @return Path information or null if planning failed
     */
    public Map<String, Object> planPath(String robotSerialNumber, Long unitId) {
        // Get robot's current position
        RobotPosition currentPosition = axBotService.getRobotPosition(robotSerialNumber);
        
        if (currentPosition == null) {
            log.error("Unable to get current position for robot {}", robotSerialNumber);
            return null;
        }
        
        // Get destination unit
        Optional<Unit> destinationOpt = unitRepository.findById(unitId);
        
        if (destinationOpt.isEmpty()) {
            log.error("Destination unit with ID {} not found", unitId);
            return null;
        }
        
        Unit destination = destinationOpt.get();
        
        // Check if robot is on the same floor as the destination
        if (currentPosition.getFloor().equals(destination.getFloor().getLevel())) {
            // Plan single-floor path
            return planSingleFloorPath(robotSerialNumber, currentPosition, destination);
        } else {
            // Plan multi-floor path using elevators
            return planMultiFloorPath(robotSerialNumber, currentPosition, destination);
        }
    }
    
    /**
     * Plan a path for a robot to navigate within a single floor
     * @param robotSerialNumber Robot serial number
     * @param currentPosition Robot's current position
     * @param destination Destination unit
     * @return Path information or null if planning failed
     */
    private Map<String, Object> planSingleFloorPath(String robotSerialNumber, RobotPosition currentPosition, Unit destination) {
        Map<String, Object> navigationCommand = new HashMap<>();
        navigationCommand.put("x", destination.getX());
        navigationCommand.put("y", destination.getY());
        navigationCommand.put("z", 0.0);  // Assuming z=0 for standard floor navigation
        
        // Send navigation command to robot
        boolean success = axBotService.sendNavigationCommand(robotSerialNumber, navigationCommand);
        
        if (!success) {
            log.error("Failed to send navigation command to robot {}", robotSerialNumber);
            return null;
        }
        
        Map<String, Object> pathInfo = new HashMap<>();
        pathInfo.put("robotId", robotSerialNumber);
        pathInfo.put("destination", Map.of(
                "unitId", destination.getId(),
                "unitNumber", destination.getNumber(),
                "x", destination.getX(),
                "y", destination.getY()
        ));
        pathInfo.put("multiFloor", false);
        pathInfo.put("status", "in_progress");
        
        return pathInfo;
    }
    
    /**
     * Plan a path for a robot to navigate across multiple floors using elevators
     * @param robotSerialNumber Robot serial number
     * @param currentPosition Robot's current position
     * @param destination Destination unit
     * @return Path information or null if planning failed
     */
    private Map<String, Object> planMultiFloorPath(String robotSerialNumber, RobotPosition currentPosition, Unit destination) {
        // Get current floor data
        Optional<Floor> currentFloorOpt = floorRepository.findByBuildingIdAndLevel(
                destination.getFloor().getBuilding().getId(), 
                currentPosition.getFloor());
        
        if (currentFloorOpt.isEmpty()) {
            log.error("Current floor data not found for robot {}", robotSerialNumber);
            return null;
        }
        
        Floor currentFloor = currentFloorOpt.get();
        
        // Find available elevators
        List<Elevator> availableElevators = findAvailableElevators(currentFloor, destination.getFloor());
        
        if (availableElevators.isEmpty()) {
            log.error("No available elevators found between floors");
            return null;
        }
        
        // Select the first available elevator (could implement a more sophisticated selection algorithm)
        Elevator selectedElevator = availableElevators.get(0);
        
        // Create multi-floor navigation plan
        Map<String, Object> pathInfo = new HashMap<>();
        pathInfo.put("robotId", robotSerialNumber);
        pathInfo.put("destination", Map.of(
                "unitId", destination.getId(),
                "unitNumber", destination.getNumber(),
                "floor", destination.getFloor().getLevel(),
                "x", destination.getX(),
                "y", destination.getY()
        ));
        pathInfo.put("multiFloor", true);
        pathInfo.put("currentFloor", currentPosition.getFloor());
        pathInfo.put("destinationFloor", destination.getFloor().getLevel());
        pathInfo.put("elevator", Map.of(
                "id", selectedElevator.getId(),
                "name", selectedElevator.getName()
        ));
        pathInfo.put("status", "planning");
        
        // Reserve the elevator
        Map<String, Object> reservation = elevatorService.reserveElevator(
                selectedElevator.getId(), 
                robotSerialNumber, 
                300);  // 5 minutes reservation
        
        if (reservation == null) {
            log.error("Failed to reserve elevator for robot {}", robotSerialNumber);
            pathInfo.put("status", "failed");
            pathInfo.put("error", "Elevator reservation failed");
            return pathInfo;
        }
        
        pathInfo.put("elevatorReservation", reservation);
        pathInfo.put("status", "reserved");
        
        // Plan is complete, return the information for execution
        return pathInfo;
    }
    
    /**
     * Find elevators that can be used to navigate between two floors
     * @param fromFloor Source floor
     * @param toFloor Destination floor
     * @return List of available elevators
     */
    private List<Elevator> findAvailableElevators(Floor fromFloor, Floor toFloor) {
        // Get elevators that are operational and have access to both floors
        List<Elevator> operationalElevators = new ArrayList<>();
        
        // Get elevators accessible from source floor
        List<Elevator> sourceElevators = fromFloor.getElevatorAccesses().stream()
                .map(ElevatorAccess::getElevator)
                .filter(Elevator::getIsOperational)
                .toList();
        
        // Filter elevators that also have access to destination floor
        for (Elevator elevator : sourceElevators) {
            boolean hasDestinationAccess = elevator.getAccessPoints().stream()
                    .anyMatch(access -> access.getFloor().getId().equals(toFloor.getId()) && 
                                       Boolean.TRUE.equals(access.getIsActive()));
            
            if (hasDestinationAccess) {
                operationalElevators.add(elevator);
            }
        }
        
        return operationalElevators;
    }
    
    /**
     * Execute a path segment for multi-floor navigation
     * @param robotSerialNumber Robot serial number
     * @param pathSegment Path segment details
     * @return Execution status
     */
    public boolean executePathSegment(String robotSerialNumber, Map<String, Object> pathSegment) {
        String segmentType = (String) pathSegment.get("type");
        
        switch (segmentType) {
            case "move_to_elevator":
                return executeElevatorApproach(robotSerialNumber, pathSegment);
            case "use_elevator":
                return executeElevatorTransit(robotSerialNumber, pathSegment);
            case "move_to_destination":
                return executeFinalApproach(robotSerialNumber, pathSegment);
            default:
                log.error("Unknown path segment type: {}", segmentType);
                return false;
        }
    }
    
    /**
     * Execute the elevator approach segment of a multi-floor path
     * @param robotSerialNumber Robot serial number
     * @param pathSegment Path segment details
     * @return Execution status
     */
    private boolean executeElevatorApproach(String robotSerialNumber, Map<String, Object> pathSegment) {
        Map<String, Object> coordinates = (Map<String, Object>) pathSegment.get("coordinates");
        
        Map<String, Object> navigationCommand = new HashMap<>();
        navigationCommand.put("x", coordinates.get("x"));
        navigationCommand.put("y", coordinates.get("y"));
        navigationCommand.put("z", coordinates.get("z"));
        
        return axBotService.sendNavigationCommand(robotSerialNumber, navigationCommand);
    }
    
    /**
     * Execute the elevator transit segment of a multi-floor path
     * @param robotSerialNumber Robot serial number
     * @param pathSegment Path segment details
     * @return Execution status
     */
    private boolean executeElevatorTransit(String robotSerialNumber, Map<String, Object> pathSegment) {
        Long elevatorId = Long.valueOf(pathSegment.get("elevatorId").toString());
        Long fromFloorId = Long.valueOf(pathSegment.get("fromFloorId").toString());
        Long toFloorId = Long.valueOf(pathSegment.get("toFloorId").toString());
        
        return elevatorService.callElevator(elevatorId, fromFloorId, toFloorId);
    }
    
    /**
     * Execute the final approach segment of a multi-floor path
     * @param robotSerialNumber Robot serial number
     * @param pathSegment Path segment details
     * @return Execution status
     */
    private boolean executeFinalApproach(String robotSerialNumber, Map<String, Object> pathSegment) {
        Map<String, Object> coordinates = (Map<String, Object>) pathSegment.get("coordinates");
        
        Map<String, Object> navigationCommand = new HashMap<>();
        navigationCommand.put("x", coordinates.get("x"));
        navigationCommand.put("y", coordinates.get("y"));
        navigationCommand.put("z", coordinates.get("z"));
        
        return axBotService.sendNavigationCommand(robotSerialNumber, navigationCommand);
    }
}