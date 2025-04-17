package com.robotcontrol.controller;

import com.robotcontrol.ai.assistant.AssistantRequest;
import com.robotcontrol.ai.assistant.AssistantResponse;
import com.robotcontrol.ai.assistant.Conversation;
import com.robotcontrol.ai.assistant.RobotAssistantService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.HashMap;

/**
 * Controller for AI assistant functionality
 */
@RestController
@RequestMapping("/api/assistant")
public class AssistantController {
    
    @Autowired
    private RobotAssistantService assistantService;
    
    /**
     * Process an assistant request
     * @param request Assistant request
     * @return Assistant response
     */
    @PostMapping("/request")
    @PreAuthorize("hasAnyRole('ADMIN', 'USER')")
    public ResponseEntity<AssistantResponse> processRequest(@RequestBody AssistantRequest request) {
        AssistantResponse response = assistantService.processRequest(request);
        return ResponseEntity.ok(response);
    }
    
    /**
     * Get conversations for a user
     * @param userId User ID
     * @return List of conversations
     */
    @GetMapping("/conversations")
    @PreAuthorize("hasAnyRole('ADMIN', 'USER')")
    public ResponseEntity<List<Conversation>> getConversations(@RequestParam String userId) {
        List<Conversation> conversations = assistantService.getConversationsForUser(userId);
        return ResponseEntity.ok(conversations);
    }
    
    /**
     * Get a conversation by ID
     * @param conversationId Conversation ID
     * @return Conversation
     */
    @GetMapping("/conversations/{conversationId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'USER')")
    public ResponseEntity<Conversation> getConversation(@PathVariable String conversationId) {
        Conversation conversation = assistantService.getConversation(conversationId);
        
        if (conversation == null) {
            return ResponseEntity.notFound().build();
        }
        
        return ResponseEntity.ok(conversation);
    }
    
    /**
     * Send a text message to the assistant
     * @param userId User ID
     * @param messageData Message data
     * @return Assistant response
     */
    @PostMapping("/message")
    @PreAuthorize("hasAnyRole('ADMIN', 'USER')")
    public ResponseEntity<AssistantResponse> sendMessage(
            @RequestParam String userId,
            @RequestBody Map<String, Object> messageData) {
        
        String message = (String) messageData.get("message");
        String conversationId = (String) messageData.get("conversationId");
        
        // Create text prompt request
        AssistantRequest request = AssistantRequest.createTextPrompt(
                userId, 
                message, 
                conversationId,
                0, // Will be updated in the service
                conversationId != null ? 
                        assistantService.getConversation(conversationId).getSessionState() : 
                        new HashMap<>());
        
        AssistantResponse response = assistantService.processRequest(request);
        return ResponseEntity.ok(response);
    }
    
    /**
     * Connect a robot to a template
     * @param userId User ID
     * @param data Request data
     * @return Assistant response
     */
    @PostMapping("/connect-robot")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<AssistantResponse> connectRobot(
            @RequestParam String userId,
            @RequestBody Map<String, Object> data) {
        
        String robotId = (String) data.get("robotId");
        String templateId = (String) data.get("templateId");
        String conversationId = (String) data.get("conversationId");
        
        // Create connect robot request
        AssistantRequest request = AssistantRequest.createConnectRobotRequest(
                userId, 
                robotId, 
                templateId, 
                conversationId,
                0, // Will be updated in the service
                conversationId != null ? 
                        assistantService.getConversation(conversationId).getSessionState() : 
                        new HashMap<>());
        
        AssistantResponse response = assistantService.processRequest(request);
        return ResponseEntity.ok(response);
    }
    
    /**
     * Connect a map to a template
     * @param userId User ID
     * @param data Request data
     * @return Assistant response
     */
    @PostMapping("/connect-map")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<AssistantResponse> connectMap(
            @RequestParam String userId,
            @RequestBody Map<String, Object> data) {
        
        String mapId = (String) data.get("mapId");
        String templateId = (String) data.get("templateId");
        String floor = (String) data.get("floor");
        String conversationId = (String) data.get("conversationId");
        
        // Create connect map request
        AssistantRequest request = AssistantRequest.createConnectMapRequest(
                userId, 
                mapId, 
                templateId, 
                floor,
                conversationId,
                0, // Will be updated in the service
                conversationId != null ? 
                        assistantService.getConversation(conversationId).getSessionState() : 
                        new HashMap<>());
        
        AssistantResponse response = assistantService.processRequest(request);
        return ResponseEntity.ok(response);
    }
    
    /**
     * Update a template
     * @param userId User ID
     * @param data Request data
     * @return Assistant response
     */
    @PostMapping("/update-template")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<AssistantResponse> updateTemplate(
            @RequestParam String userId,
            @RequestBody Map<String, Object> data) {
        
        String templateId = (String) data.get("templateId");
        Map<String, Object> updates = (Map<String, Object>) data.get("updates");
        String conversationId = (String) data.get("conversationId");
        
        // Create update template request
        AssistantRequest request = AssistantRequest.createUpdateTemplateRequest(
                userId, 
                templateId, 
                updates, 
                conversationId,
                0, // Will be updated in the service
                conversationId != null ? 
                        assistantService.getConversation(conversationId).getSessionState() : 
                        new HashMap<>());
        
        AssistantResponse response = assistantService.processRequest(request);
        return ResponseEntity.ok(response);
    }
}