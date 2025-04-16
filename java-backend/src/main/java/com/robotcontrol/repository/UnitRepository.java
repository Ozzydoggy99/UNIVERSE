package com.robotcontrol.repository;

import com.robotcontrol.model.Unit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface UnitRepository extends JpaRepository<Unit, Long> {
    
    List<Unit> findByFloorId(Long floorId);
    
    Optional<Unit> findByFloorIdAndNumber(Long floorId, String number);
    
    List<Unit> findByType(String type);
}