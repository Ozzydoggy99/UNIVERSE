package com.robotcontrol.controller;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * REST controller for template management endpoints
 * Mimics the existing Node.js endpoints to ensure compatibility with the frontend
 */
@RestController
@RequiredArgsConstructor
@Slf4j
public class TemplateController {
    
    @GetMapping("/admin/templates")
    public ResponseEntity<List<Map<String, Object>>> getAllTemplates() {
        // In a real implementation, this would retrieve templates from the database
        // For now, we'll return placeholder data
        List<Map<String, Object>> templates = new ArrayList<>();
        
        Map<String, Object> template1 = new HashMap<>();
        template1.put("id", 1);
        template1.put("name", "Basic Template");
        template1.put("description", "A basic template for robot control");
        template1.put("components", new Object[]{"laundry", "trash", "delivery"});
        template1.put("createdAt", "2023-04-16T10:00:00Z");
        templates.add(template1);
        
        Map<String, Object> template2 = new HashMap<>();
        template2.put("id", 2);
        template2.put("name", "Advanced Template");
        template2.put("description", "An advanced template with all features");
        template2.put("components", new Object[]{"laundry", "trash", "delivery", "navigation", "custom"});
        template2.put("createdAt", "2023-04-16T11:00:00Z");
        templates.add(template2);
        
        return ResponseEntity.ok(templates);
    }
    
    @GetMapping("/admin/templates/{id}")
    public ResponseEntity<Map<String, Object>> getTemplateById(@PathVariable Long id) {
        // In a real implementation, this would retrieve the template from the database
        // For now, we'll return placeholder data
        Map<String, Object> template = new HashMap<>();
        template.put("id", id);
        template.put("name", "Template " + id);
        template.put("description", "Template description for " + id);
        template.put("components", new Object[]{"laundry", "trash", "delivery"});
        template.put("createdAt", "2023-04-16T10:00:00Z");
        template.put("configuration", new HashMap<String, Object>());
        
        return ResponseEntity.ok(template);
    }
    
    @PostMapping("/admin/templates")
    public ResponseEntity<Map<String, Object>> createTemplate(@RequestBody Map<String, Object> templateData) {
        // In a real implementation, this would save the template to the database
        // For now, we'll return the input data with an ID added
        templateData.put("id", 3);
        templateData.put("createdAt", "2023-04-16T12:00:00Z");
        
        return ResponseEntity.ok(templateData);
    }
    
    @PutMapping("/admin/templates/{id}")
    public ResponseEntity<Map<String, Object>> updateTemplate(
            @PathVariable Long id, 
            @RequestBody Map<String, Object> templateData) {
        
        // In a real implementation, this would update the template in the database
        // For now, we'll return the input data with the ID
        templateData.put("id", id);
        
        return ResponseEntity.ok(templateData);
    }
    
    @DeleteMapping("/admin/templates/{id}")
    public ResponseEntity<Map<String, Object>> deleteTemplate(@PathVariable Long id) {
        // In a real implementation, this would delete the template from the database
        // For now, we'll return a success response
        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("message", "Template " + id + " deleted successfully");
        
        return ResponseEntity.ok(response);
    }
    
    @GetMapping("/admin/robot-assignments")
    public ResponseEntity<List<Map<String, Object>>> getAllRobotAssignments() {
        // In a real implementation, this would retrieve robot assignments from the database
        // For now, we'll return placeholder data
        List<Map<String, Object>> assignments = new ArrayList<>();
        
        Map<String, Object> assignment1 = new HashMap<>();
        assignment1.put("id", 1);
        assignment1.put("serialNumber", "ROBOT-001");
        assignment1.put("templateId", 1);
        assignment1.put("createdAt", "2023-04-16T10:00:00Z");
        assignments.add(assignment1);
        
        Map<String, Object> assignment2 = new HashMap<>();
        assignment2.put("id", 2);
        assignment2.put("serialNumber", "ROBOT-002");
        assignment2.put("templateId", 2);
        assignment2.put("createdAt", "2023-04-16T11:00:00Z");
        assignments.add(assignment2);
        
        return ResponseEntity.ok(assignments);
    }
    
    @PostMapping("/admin/robot-assignments")
    public ResponseEntity<Map<String, Object>> createRobotAssignment(@RequestBody Map<String, Object> assignmentData) {
        // In a real implementation, this would save the assignment to the database
        // For now, we'll return the input data with an ID added
        assignmentData.put("id", 3);
        assignmentData.put("createdAt", "2023-04-16T12:00:00Z");
        
        return ResponseEntity.ok(assignmentData);
    }
    
    @PutMapping("/admin/robot-assignments/{id}")
    public ResponseEntity<Map<String, Object>> updateRobotAssignment(
            @PathVariable Long id, 
            @RequestBody Map<String, Object> assignmentData) {
        
        // In a real implementation, this would update the assignment in the database
        // For now, we'll return the input data with the ID
        assignmentData.put("id", id);
        
        return ResponseEntity.ok(assignmentData);
    }
    
    @DeleteMapping("/admin/robot-assignments/{id}")
    public ResponseEntity<Map<String, Object>> deleteRobotAssignment(@PathVariable Long id) {
        // In a real implementation, this would delete the assignment from the database
        // For now, we'll return a success response
        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("message", "Robot assignment " + id + " deleted successfully");
        
        return ResponseEntity.ok(response);
    }
    
    @GetMapping("/api/robot-assignments/by-serial/{serialNumber}")
    public ResponseEntity<Map<String, Object>> getRobotAssignmentBySerial(@PathVariable String serialNumber) {
        // In a real implementation, this would retrieve the assignment from the database
        // For now, we'll return placeholder data
        Map<String, Object> assignment = new HashMap<>();
        assignment.put("id", 1);
        assignment.put("serialNumber", serialNumber);
        assignment.put("templateId", 1);
        assignment.put("createdAt", "2023-04-16T10:00:00Z");
        
        // Include template details
        Map<String, Object> template = new HashMap<>();
        template.put("id", 1);
        template.put("name", "Basic Template");
        template.put("description", "A basic template for robot control");
        template.put("components", new Object[]{"laundry", "trash", "delivery"});
        
        assignment.put("template", template);
        
        return ResponseEntity.ok(assignment);
    }
}