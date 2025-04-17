package com.robotcontrol.ai.assistant;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.Map;

/**
 * Class to represent a request to the AI assistant
 */
@Data
@Builder
public class AssistantRequest {
    
    public enum RequestType {
        TEXT_PROMPT,        // Free-text prompt/question
        CONNECT_ROBOT,      // Connect robot to template
        DISCONNECT_ROBOT,   // Disconnect robot from template
        UPDATE_TEMPLATE,    // Update template
        CONNECT_MAP,        // Connect map to template
        UPDATE_MAP,         // Update map
        CREATE_USER,        // Create new user
        CODE_CHANGE,        // Request code change
        TASK_ASSIGNMENT,    // Assign task
        SYSTEM_STATUS,      // Check system status
        TEMPLATE_LIST,      // List templates
        ROBOT_LIST,         // List robots
        MAP_LIST,           // List maps
        CONVERSATION        // Continue conversation
    }
    
    // Basic request info
    private String id;
    private String userId;
    private LocalDateTime timestamp;
    private RequestType type;
    
    // Request content
    private String prompt;
    private Map<String, Object> parameters;
    
    // Conversation context
    private String conversationId;
    private int messageSequence;
    
    // Current session state to maintain context
    private Map<String, Object> sessionState;
    
    /**
     * Factory method for creating a text prompt request
     * @param userId User ID
     * @param prompt Text prompt
     * @param conversationId Conversation ID (null for new conversation)
     * @param messageSequence Message sequence in conversation
     * @param sessionState Current session state
     * @return Text prompt request
     */
    public static AssistantRequest createTextPrompt(
            String userId, String prompt, String conversationId,
            int messageSequence, Map<String, Object> sessionState) {
        
        return AssistantRequest.builder()
                .id(java.util.UUID.randomUUID().toString())
                .userId(userId)
                .timestamp(LocalDateTime.now())
                .type(RequestType.TEXT_PROMPT)
                .prompt(prompt)
                .conversationId(conversationId)
                .messageSequence(messageSequence)
                .sessionState(sessionState != null ? sessionState : new java.util.HashMap<>())
                .build();
    }
    
    /**
     * Factory method for creating a robot connection request
     * @param userId User ID
     * @param robotId Robot ID to connect
     * @param templateId Template ID to connect to
     * @param conversationId Conversation ID
     * @param messageSequence Message sequence in conversation
     * @param sessionState Current session state
     * @return Robot connection request
     */
    public static AssistantRequest createConnectRobotRequest(
            String userId, String robotId, String templateId, String conversationId,
            int messageSequence, Map<String, Object> sessionState) {
        
        Map<String, Object> params = new java.util.HashMap<>();
        params.put("robotId", robotId);
        params.put("templateId", templateId);
        
        return AssistantRequest.builder()
                .id(java.util.UUID.randomUUID().toString())
                .userId(userId)
                .timestamp(LocalDateTime.now())
                .type(RequestType.CONNECT_ROBOT)
                .parameters(params)
                .conversationId(conversationId)
                .messageSequence(messageSequence)
                .sessionState(sessionState != null ? sessionState : new java.util.HashMap<>())
                .build();
    }
    
    /**
     * Factory method for creating a map connection request
     * @param userId User ID
     * @param mapId Map ID to connect
     * @param templateId Template ID to connect to
     * @param floor Floor identifier
     * @param conversationId Conversation ID
     * @param messageSequence Message sequence in conversation
     * @param sessionState Current session state
     * @return Map connection request
     */
    public static AssistantRequest createConnectMapRequest(
            String userId, String mapId, String templateId, String floor, String conversationId,
            int messageSequence, Map<String, Object> sessionState) {
        
        Map<String, Object> params = new java.util.HashMap<>();
        params.put("mapId", mapId);
        params.put("templateId", templateId);
        params.put("floor", floor);
        
        return AssistantRequest.builder()
                .id(java.util.UUID.randomUUID().toString())
                .userId(userId)
                .timestamp(LocalDateTime.now())
                .type(RequestType.CONNECT_MAP)
                .parameters(params)
                .conversationId(conversationId)
                .messageSequence(messageSequence)
                .sessionState(sessionState != null ? sessionState : new java.util.HashMap<>())
                .build();
    }
    
    /**
     * Factory method for creating a template update request
     * @param userId User ID
     * @param templateId Template ID to update
     * @param updates Template updates
     * @param conversationId Conversation ID
     * @param messageSequence Message sequence in conversation
     * @param sessionState Current session state
     * @return Template update request
     */
    public static AssistantRequest createUpdateTemplateRequest(
            String userId, String templateId, Map<String, Object> updates, String conversationId,
            int messageSequence, Map<String, Object> sessionState) {
        
        Map<String, Object> params = new java.util.HashMap<>();
        params.put("templateId", templateId);
        params.put("updates", updates);
        
        return AssistantRequest.builder()
                .id(java.util.UUID.randomUUID().toString())
                .userId(userId)
                .timestamp(LocalDateTime.now())
                .type(RequestType.UPDATE_TEMPLATE)
                .parameters(params)
                .conversationId(conversationId)
                .messageSequence(messageSequence)
                .sessionState(sessionState != null ? sessionState : new java.util.HashMap<>())
                .build();
    }
}