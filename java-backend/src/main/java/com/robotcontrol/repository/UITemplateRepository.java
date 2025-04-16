package com.robotcontrol.repository;

import com.robotcontrol.model.UITemplate;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface UITemplateRepository extends JpaRepository<UITemplate, Long> {
    
    Optional<UITemplate> findByName(String name);
    
    List<UITemplate> findByNameContaining(String partialName);
}