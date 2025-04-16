package com.robotcontrol.repository;

import com.robotcontrol.model.Floor;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface FloorRepository extends JpaRepository<Floor, Long> {
    
    List<Floor> findByBuildingIdOrderByLevel(Long buildingId);
    
    Optional<Floor> findByBuildingIdAndLevel(Long buildingId, Integer level);
}