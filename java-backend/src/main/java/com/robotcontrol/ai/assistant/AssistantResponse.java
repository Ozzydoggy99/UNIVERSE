package com.robotcontrol.ai.assistant;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * Class to represent a response from the AI assistant
 */
@Data
@Builder
public class AssistantResponse {
    
    public enum ResponseType {
        TEXT,               // Simple text response
        ACTION_RESULT,      // Result of an action
        ERROR,              // Error message
        OPTION_LIST,        // List of options to choose from
        DATA_VISUALIZATION, // Data visualization (chart, etc.)
        MAP_VISUALIZATION,  // Map visualization
        FORM_REQUEST,       // Request for additional information
        CONFIRMATION,       // Request for confirmation
        CODE_SNIPPET,       // Code snippet
        STATUS_UPDATE       // Status update
    }
    
    // Basic response info
    private String id;
    private String requestId;
    private LocalDateTime timestamp;
    private ResponseType type;
    
    // Response content
    private String message;
    private boolean success;
    private Map<String, Object> data;
    
    // For option lists, confirmations, etc.
    private List<ResponseOption> options;
    
    // For form requests
    private List<FormField> formFields;
    
    // Conversation context
    private String conversationId;
    private int messageSequence;
    
    // Updated session state
    private Map<String, Object> sessionState;
    
    /**
     * Class to represent an option in a list of options
     */
    @Data
    @Builder
    public static class ResponseOption {
        private String id;
        private String label;
        private String description;
        private Map<String, Object> metadata;
    }
    
    /**
     * Class to represent a form field in a form request
     */
    @Data
    @Builder
    public static class FormField {
        
        public enum FieldType {
            TEXT,
            NUMBER,
            SELECT,
            CHECKBOX,
            RADIO,
            DATE,
            FILE
        }
        
        private String id;
        private String label;
        private FieldType type;
        private boolean required;
        private String placeholder;
        private String defaultValue;
        private List<ResponseOption> options; // For SELECT, RADIO
        private Map<String, Object> validation;
    }
    
    /**
     * Factory method for creating a simple text response
     * @param requestId Request ID
     * @param message Text message
     * @param conversationId Conversation ID
     * @param messageSequence Message sequence
     * @param sessionState Updated session state
     * @return Text response
     */
    public static AssistantResponse createTextResponse(
            String requestId, String message, String conversationId,
            int messageSequence, Map<String, Object> sessionState) {
        
        return AssistantResponse.builder()
                .id(java.util.UUID.randomUUID().toString())
                .requestId(requestId)
                .timestamp(LocalDateTime.now())
                .type(ResponseType.TEXT)
                .message(message)
                .success(true)
                .conversationId(conversationId)
                .messageSequence(messageSequence)
                .sessionState(sessionState)
                .build();
    }
    
    /**
     * Factory method for creating an action result response
     * @param requestId Request ID
     * @param success Whether action was successful
     * @param message Result message
     * @param data Result data
     * @param conversationId Conversation ID
     * @param messageSequence Message sequence
     * @param sessionState Updated session state
     * @return Action result response
     */
    public static AssistantResponse createActionResultResponse(
            String requestId, boolean success, String message, Map<String, Object> data,
            String conversationId, int messageSequence, Map<String, Object> sessionState) {
        
        return AssistantResponse.builder()
                .id(java.util.UUID.randomUUID().toString())
                .requestId(requestId)
                .timestamp(LocalDateTime.now())
                .type(ResponseType.ACTION_RESULT)
                .success(success)
                .message(message)
                .data(data)
                .conversationId(conversationId)
                .messageSequence(messageSequence)
                .sessionState(sessionState)
                .build();
    }
    
    /**
     * Factory method for creating an error response
     * @param requestId Request ID
     * @param errorMessage Error message
     * @param errorDetails Error details
     * @param conversationId Conversation ID
     * @param messageSequence Message sequence
     * @param sessionState Updated session state
     * @return Error response
     */
    public static AssistantResponse createErrorResponse(
            String requestId, String errorMessage, Map<String, Object> errorDetails,
            String conversationId, int messageSequence, Map<String, Object> sessionState) {
        
        return AssistantResponse.builder()
                .id(java.util.UUID.randomUUID().toString())
                .requestId(requestId)
                .timestamp(LocalDateTime.now())
                .type(ResponseType.ERROR)
                .success(false)
                .message(errorMessage)
                .data(errorDetails)
                .conversationId(conversationId)
                .messageSequence(messageSequence)
                .sessionState(sessionState)
                .build();
    }
    
    /**
     * Factory method for creating an option list response
     * @param requestId Request ID
     * @param message Prompt message
     * @param options List of options
     * @param conversationId Conversation ID
     * @param messageSequence Message sequence
     * @param sessionState Updated session state
     * @return Option list response
     */
    public static AssistantResponse createOptionListResponse(
            String requestId, String message, List<ResponseOption> options,
            String conversationId, int messageSequence, Map<String, Object> sessionState) {
        
        return AssistantResponse.builder()
                .id(java.util.UUID.randomUUID().toString())
                .requestId(requestId)
                .timestamp(LocalDateTime.now())
                .type(ResponseType.OPTION_LIST)
                .success(true)
                .message(message)
                .options(options)
                .conversationId(conversationId)
                .messageSequence(messageSequence)
                .sessionState(sessionState)
                .build();
    }
    
    /**
     * Factory method for creating a form request response
     * @param requestId Request ID
     * @param message Prompt message
     * @param formFields Form fields
     * @param conversationId Conversation ID
     * @param messageSequence Message sequence
     * @param sessionState Updated session state
     * @return Form request response
     */
    public static AssistantResponse createFormRequestResponse(
            String requestId, String message, List<FormField> formFields,
            String conversationId, int messageSequence, Map<String, Object> sessionState) {
        
        return AssistantResponse.builder()
                .id(java.util.UUID.randomUUID().toString())
                .requestId(requestId)
                .timestamp(LocalDateTime.now())
                .type(ResponseType.FORM_REQUEST)
                .success(true)
                .message(message)
                .formFields(formFields)
                .conversationId(conversationId)
                .messageSequence(messageSequence)
                .sessionState(sessionState)
                .build();
    }
}