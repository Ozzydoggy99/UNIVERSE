package com.robotcontrol.repository;

import com.robotcontrol.model.RobotSensor;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface RobotSensorRepository extends JpaRepository<RobotSensor, Long> {
    
    @Query("SELECT s FROM RobotSensor s WHERE s.robotStatus.serialNumber = :serialNumber ORDER BY s.timestamp DESC")
    List<RobotSensor> findLatestSensorDataBySerialNumber(String serialNumber, Pageable pageable);
    
    @Query("SELECT AVG(s.temperature) FROM RobotSensor s WHERE s.robotStatus.serialNumber = :serialNumber")
    Double findAverageTemperatureBySerialNumber(String serialNumber);
    
    @Query("SELECT AVG(s.humidity) FROM RobotSensor s WHERE s.robotStatus.serialNumber = :serialNumber")
    Double findAverageHumidityBySerialNumber(String serialNumber);
}