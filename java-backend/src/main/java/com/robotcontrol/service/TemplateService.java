package com.robotcontrol.service;

import com.robotcontrol.model.RobotTemplateAssignment;
import com.robotcontrol.model.UITemplate;
import com.robotcontrol.repository.RobotTemplateAssignmentRepository;
import com.robotcontrol.repository.UITemplateRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import javax.transaction.Transactional;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/**
 * Service for managing UI templates and robot assignments
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class TemplateService {

    private final UITemplateRepository templateRepository;
    private final RobotTemplateAssignmentRepository assignmentRepository;
    
    /**
     * Get all UI templates
     * @return List of templates
     */
    public List<UITemplate> getAllTemplates() {
        return templateRepository.findAll();
    }
    
    /**
     * Get a specific template by ID
     * @param id Template ID
     * @return Optional containing the template if found
     */
    public Optional<UITemplate> getTemplateById(Long id) {
        return templateRepository.findById(id);
    }
    
    /**
     * Create a new template
     * @param template Template to create
     * @return Created template
     */
    @Transactional
    public UITemplate createTemplate(UITemplate template) {
        template.setCreatedAt(LocalDateTime.now());
        template.setUpdatedAt(LocalDateTime.now());
        return templateRepository.save(template);
    }
    
    /**
     * Update an existing template
     * @param id Template ID
     * @param templateDetails Updated template details
     * @return Updated template or null if not found
     */
    @Transactional
    public UITemplate updateTemplate(Long id, UITemplate templateDetails) {
        return templateRepository.findById(id)
                .map(template -> {
                    template.setName(templateDetails.getName());
                    template.setDescription(templateDetails.getDescription());
                    template.setConfiguration(templateDetails.getConfiguration());
                    template.setUpdatedAt(LocalDateTime.now());
                    return templateRepository.save(template);
                })
                .orElse(null);
    }
    
    /**
     * Delete a template
     * @param id Template ID
     * @return true if deleted, false if not found
     */
    @Transactional
    public boolean deleteTemplate(Long id) {
        return templateRepository.findById(id)
                .map(template -> {
                    templateRepository.delete(template);
                    return true;
                })
                .orElse(false);
    }
    
    /**
     * Get all robot template assignments
     * @return List of assignments
     */
    public List<RobotTemplateAssignment> getAllAssignments() {
        return assignmentRepository.findAll();
    }
    
    /**
     * Get active robot template assignments
     * @return List of active assignments
     */
    public List<RobotTemplateAssignment> getActiveAssignments() {
        return assignmentRepository.findAllActiveAssignments();
    }
    
    /**
     * Get assignments for a specific template
     * @param templateId Template ID
     * @return List of assignments
     */
    public List<RobotTemplateAssignment> getAssignmentsByTemplate(Long templateId) {
        return assignmentRepository.findByTemplateId(templateId);
    }
    
    /**
     * Get assignment for a specific robot
     * @param serialNumber Robot serial number
     * @return Optional containing the assignment if found
     */
    public Optional<RobotTemplateAssignment> getAssignmentByRobot(String serialNumber) {
        return assignmentRepository.findBySerialNumber(serialNumber);
    }
    
    /**
     * Create a new robot template assignment
     * @param assignment Assignment to create
     * @return Created assignment
     */
    @Transactional
    public RobotTemplateAssignment createAssignment(RobotTemplateAssignment assignment) {
        assignment.setAssignedAt(LocalDateTime.now());
        assignment.setIsActive(true);
        return assignmentRepository.save(assignment);
    }
    
    /**
     * Update an existing assignment
     * @param id Assignment ID
     * @param assignmentDetails Updated assignment details
     * @return Updated assignment or null if not found
     */
    @Transactional
    public RobotTemplateAssignment updateAssignment(Long id, RobotTemplateAssignment assignmentDetails) {
        return assignmentRepository.findById(id)
                .map(assignment -> {
                    assignment.setTemplate(assignmentDetails.getTemplate());
                    assignment.setCustomization(assignmentDetails.getCustomization());
                    assignment.setIsActive(assignmentDetails.getIsActive());
                    return assignmentRepository.save(assignment);
                })
                .orElse(null);
    }
    
    /**
     * Delete an assignment
     * @param id Assignment ID
     * @return true if deleted, false if not found
     */
    @Transactional
    public boolean deleteAssignment(Long id) {
        return assignmentRepository.findById(id)
                .map(assignment -> {
                    assignmentRepository.delete(assignment);
                    return true;
                })
                .orElse(false);
    }
    
    /**
     * Check if a robot has an active template assignment
     * @param serialNumber Robot serial number
     * @return true if assigned, false otherwise
     */
    public boolean isRobotAssigned(String serialNumber) {
        return assignmentRepository.findBySerialNumber(serialNumber)
                .map(RobotTemplateAssignment::getIsActive)
                .orElse(false);
    }
}