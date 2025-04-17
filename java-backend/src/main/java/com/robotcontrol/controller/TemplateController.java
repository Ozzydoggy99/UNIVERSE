package com.robotcontrol.controller;

import com.robotcontrol.model.RobotTemplateAssignment;
import com.robotcontrol.model.UITemplate;
import com.robotcontrol.service.TemplateService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Controller for template management
 */
@RestController
@RequestMapping("/api/templates")
@RequiredArgsConstructor
@Slf4j
public class TemplateController {

    private final TemplateService templateService;
    
    /**
     * Get all templates
     * @return List of templates
     */
    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<UITemplate>> getAllTemplates() {
        return ResponseEntity.ok(templateService.getAllTemplates());
    }
    
    /**
     * Get template by ID
     * @param id Template ID
     * @return Template
     */
    @GetMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<UITemplate> getTemplateById(@PathVariable Long id) {
        return templateService.getTemplateById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }
    
    /**
     * Create a new template
     * @param template Template to create
     * @return Created template
     */
    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<UITemplate> createTemplate(@RequestBody UITemplate template) {
        return ResponseEntity.ok(templateService.createTemplate(template));
    }
    
    /**
     * Update an existing template
     * @param id Template ID
     * @param template Updated template
     * @return Updated template
     */
    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<UITemplate> updateTemplate(@PathVariable Long id, @RequestBody UITemplate template) {
        UITemplate updatedTemplate = templateService.updateTemplate(id, template);
        
        if (updatedTemplate == null) {
            return ResponseEntity.notFound().build();
        }
        
        return ResponseEntity.ok(updatedTemplate);
    }
    
    /**
     * Delete a template
     * @param id Template ID
     * @return Success status
     */
    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Boolean>> deleteTemplate(@PathVariable Long id) {
        boolean deleted = templateService.deleteTemplate(id);
        
        Map<String, Boolean> response = new HashMap<>();
        response.put("success", deleted);
        
        if (!deleted) {
            return ResponseEntity.notFound().build();
        }
        
        return ResponseEntity.ok(response);
    }
    
    /**
     * Get all robot template assignments
     * @return List of assignments
     */
    @GetMapping("/assignments")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<RobotTemplateAssignment>> getAllAssignments() {
        return ResponseEntity.ok(templateService.getAllAssignments());
    }
    
    /**
     * Get active robot template assignments
     * @return List of active assignments
     */
    @GetMapping("/assignments/active")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<RobotTemplateAssignment>> getActiveAssignments() {
        return ResponseEntity.ok(templateService.getActiveAssignments());
    }
    
    /**
     * Get assignments for a specific template
     * @param templateId Template ID
     * @return List of assignments
     */
    @GetMapping("/assignments/by-template/{templateId}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<RobotTemplateAssignment>> getAssignmentsByTemplate(@PathVariable Long templateId) {
        return ResponseEntity.ok(templateService.getAssignmentsByTemplate(templateId));
    }
    
    /**
     * Get assignment for a specific robot
     * @param serialNumber Robot serial number
     * @return Assignment
     */
    @GetMapping("/assignments/by-robot/{serialNumber}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<RobotTemplateAssignment> getAssignmentByRobot(@PathVariable String serialNumber) {
        return templateService.getAssignmentByRobot(serialNumber)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }
    
    /**
     * Create a new robot template assignment
     * @param assignment Assignment to create
     * @return Created assignment
     */
    @PostMapping("/assignments")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<RobotTemplateAssignment> createAssignment(@RequestBody RobotTemplateAssignment assignment) {
        return ResponseEntity.ok(templateService.createAssignment(assignment));
    }
    
    /**
     * Update an existing assignment
     * @param id Assignment ID
     * @param assignment Updated assignment
     * @return Updated assignment
     */
    @PutMapping("/assignments/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<RobotTemplateAssignment> updateAssignment(@PathVariable Long id, @RequestBody RobotTemplateAssignment assignment) {
        RobotTemplateAssignment updatedAssignment = templateService.updateAssignment(id, assignment);
        
        if (updatedAssignment == null) {
            return ResponseEntity.notFound().build();
        }
        
        return ResponseEntity.ok(updatedAssignment);
    }
    
    /**
     * Delete an assignment
     * @param id Assignment ID
     * @return Success status
     */
    @DeleteMapping("/assignments/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Boolean>> deleteAssignment(@PathVariable Long id) {
        boolean deleted = templateService.deleteAssignment(id);
        
        Map<String, Boolean> response = new HashMap<>();
        response.put("success", deleted);
        
        if (!deleted) {
            return ResponseEntity.notFound().build();
        }
        
        return ResponseEntity.ok(response);
    }
}