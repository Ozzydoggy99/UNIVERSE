package com.robotcontrol.ai.assistant;

import com.robotcontrol.service.RobotService;
import com.robotcontrol.service.TemplateService;
import com.robotcontrol.service.MapService;
import com.robotcontrol.service.UserService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import javax.annotation.PostConstruct;
import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

/**
 * Service for the AI assistant functionality
 */
@Service
@Slf4j
public class RobotAssistantService {
    
    @Autowired
    private RobotService robotService;
    
    @Autowired
    private TemplateService templateService;
    
    @Autowired
    private MapService mapService;
    
    @Autowired
    private UserService userService;
    
    // Store conversations
    private final Map<String, Conversation> conversations = new ConcurrentHashMap<>();
    
    // Store user conversation mappings
    private final Map<String, List<String>> userConversations = new ConcurrentHashMap<>();
    
    @PostConstruct
    public void initialize() {
        log.info("Initializing Robot Assistant Service");
    }
    
    /**
     * Process an assistant request
     * @param request Assistant request
     * @return Assistant response
     */
    public AssistantResponse processRequest(AssistantRequest request) {
        log.info("Processing assistant request: {}", request.getType());
        
        // Ensure conversation exists
        Conversation conversation = ensureConversation(request);
        
        // Process based on request type
        switch (request.getType()) {
            case TEXT_PROMPT:
                return processTextPrompt(request, conversation);
                
            case CONNECT_ROBOT:
                return processConnectRobot(request, conversation);
                
            case DISCONNECT_ROBOT:
                return processDisconnectRobot(request, conversation);
                
            case UPDATE_TEMPLATE:
                return processUpdateTemplate(request, conversation);
                
            case CONNECT_MAP:
                return processConnectMap(request, conversation);
                
            case CREATE_USER:
                return processCreateUser(request, conversation);
                
            case ROBOT_LIST:
                return processRobotList(request, conversation);
                
            case TEMPLATE_LIST:
                return processTemplateList(request, conversation);
                
            case MAP_LIST:
                return processMapList(request, conversation);
                
            case CONVERSATION:
                return processContinueConversation(request, conversation);
                
            default:
                return createErrorResponse(request, conversation, 
                        "Unsupported request type: " + request.getType(), null);
        }
    }
    
    /**
     * Ensure a conversation exists for the request
     * @param request Assistant request
     * @return Conversation
     */
    private Conversation ensureConversation(AssistantRequest request) {
        String conversationId = request.getConversationId();
        
        // If no conversation ID or conversation doesn't exist, create a new one
        if (conversationId == null || !conversations.containsKey(conversationId)) {
            Conversation newConversation = Conversation.createNewConversation(request.getUserId());
            conversations.put(newConversation.getId(), newConversation);
            
            // Add to user conversations
            List<String> userConvs = userConversations.computeIfAbsent(
                    request.getUserId(), k -> new ArrayList<>());
            userConvs.add(newConversation.getId());
            
            log.info("Created new conversation: {}", newConversation.getId());
            
            return newConversation;
        }
        
        return conversations.get(conversationId);
    }
    
    /**
     * Process a text prompt request
     * @param request Assistant request
     * @param conversation Conversation
     * @return Assistant response
     */
    private AssistantResponse processTextPrompt(AssistantRequest request, Conversation conversation) {
        // Add user message to conversation
        String messageId = UUID.randomUUID().toString();
        conversation.addUserMessage(messageId, request.getPrompt(), null);
        
        // Process the prompt using natural language understanding
        Map<String, Object> intent = analyzeIntent(request.getPrompt());
        
        // Based on the intent, generate a response or take an action
        String intentType = (String) intent.get("type");
        
        switch (intentType) {
            case "connect_robot":
                return handleConnectRobotIntent(request, conversation, intent);
                
            case "disconnect_robot":
                return handleDisconnectRobotIntent(request, conversation, intent);
                
            case "update_template":
                return handleUpdateTemplateIntent(request, conversation, intent);
                
            case "connect_map":
                return handleConnectMapIntent(request, conversation, intent);
                
            case "list_robots":
                return handleListRobotsIntent(request, conversation, intent);
                
            case "list_templates":
                return handleListTemplatesIntent(request, conversation, intent);
                
            case "list_maps":
                return handleListMapsIntent(request, conversation, intent);
                
            case "get_info":
                return handleGetInfoIntent(request, conversation, intent);
                
            case "general_query":
            default:
                return handleGeneralQuery(request, conversation, intent);
        }
    }
    
    /**
     * Analyze the intent of a text prompt
     * @param prompt Text prompt
     * @return Intent data
     */
    private Map<String, Object> analyzeIntent(String prompt) {
        Map<String, Object> intent = new HashMap<>();
        
        // Simple keyword-based intent detection
        // In a real system, this would use a more sophisticated NLU system
        String lowerPrompt = prompt.toLowerCase();
        
        if (lowerPrompt.contains("connect") && lowerPrompt.contains("robot")) {
            intent.put("type", "connect_robot");
            
            // Extract robot ID and template ID if present
            // This is a simplistic approach - a real system would use entity extraction
            intent.put("entities", extractEntities(lowerPrompt, "robot", "template"));
            
        } else if (lowerPrompt.contains("disconnect") && lowerPrompt.contains("robot")) {
            intent.put("type", "disconnect_robot");
            intent.put("entities", extractEntities(lowerPrompt, "robot"));
            
        } else if (lowerPrompt.contains("update") && lowerPrompt.contains("template")) {
            intent.put("type", "update_template");
            intent.put("entities", extractEntities(lowerPrompt, "template"));
            
        } else if (lowerPrompt.contains("connect") && lowerPrompt.contains("map")) {
            intent.put("type", "connect_map");
            intent.put("entities", extractEntities(lowerPrompt, "map", "template", "floor"));
            
        } else if (lowerPrompt.contains("list") && lowerPrompt.contains("robot")) {
            intent.put("type", "list_robots");
            
        } else if (lowerPrompt.contains("list") && lowerPrompt.contains("template")) {
            intent.put("type", "list_templates");
            
        } else if (lowerPrompt.contains("list") && lowerPrompt.contains("map")) {
            intent.put("type", "list_maps");
            
        } else if (lowerPrompt.contains("info") || lowerPrompt.contains("status")) {
            intent.put("type", "get_info");
            intent.put("entities", extractEntities(lowerPrompt, "robot", "template", "map"));
            
        } else {
            intent.put("type", "general_query");
        }
        
        intent.put("confidence", 0.8); // Mock confidence score
        
        return intent;
    }
    
    /**
     * Extract entities from a text prompt
     * @param prompt Text prompt
     * @param entityTypes Entity types to extract
     * @return Extracted entities
     */
    private Map<String, String> extractEntities(String prompt, String... entityTypes) {
        Map<String, String> entities = new HashMap<>();
        
        // This is a simplistic approach - a real system would use proper entity extraction
        // For now, we'll just look for patterns like "robot XYZ" or "template ABC"
        
        for (String entityType : entityTypes) {
            String pattern = entityType + "\\s+([a-zA-Z0-9_-]+)";
            java.util.regex.Pattern regex = java.util.regex.Pattern.compile(pattern);
            java.util.regex.Matcher matcher = regex.matcher(prompt);
            
            if (matcher.find()) {
                entities.put(entityType, matcher.group(1));
            }
        }
        
        return entities;
    }
    
    /**
     * Handle a connect robot intent
     * @param request Assistant request
     * @param conversation Conversation
     * @param intent Intent data
     * @return Assistant response
     */
    private AssistantResponse handleConnectRobotIntent(
            AssistantRequest request, Conversation conversation, Map<String, Object> intent) {
        
        // Check if we have both robot ID and template ID
        Map<String, String> entities = (Map<String, String>) intent.get("entities");
        
        if (entities.containsKey("robot") && entities.containsKey("template")) {
            // We have both entities, proceed with connection
            return processConnectRobot(
                    AssistantRequest.createConnectRobotRequest(
                            request.getUserId(), 
                            entities.get("robot"), 
                            entities.get("template"),
                            conversation.getId(),
                            conversation.getMessages().size(),
                            conversation.getSessionState()),
                    conversation);
        } else {
            // Missing entities, request them
            if (!entities.containsKey("robot") && !entities.containsKey("template")) {
                // Need both
                List<AssistantResponse.FormField> formFields = new ArrayList<>();
                
                formFields.add(AssistantResponse.FormField.builder()
                        .id("robotId")
                        .label("Robot ID or Serial Number")
                        .type(AssistantResponse.FormField.FieldType.TEXT)
                        .required(true)
                        .placeholder("Enter robot ID or serial number")
                        .build());
                
                formFields.add(AssistantResponse.FormField.builder()
                        .id("templateId")
                        .label("Template ID")
                        .type(AssistantResponse.FormField.FieldType.TEXT)
                        .required(true)
                        .placeholder("Enter template ID")
                        .build());
                
                // Store intent in session state for follow-up
                Map<String, Object> sessionState = conversation.getSessionState();
                sessionState.put("pendingIntent", "connect_robot");
                conversation.setSessionState(sessionState);
                
                // Add assistant message to conversation
                String messageId = UUID.randomUUID().toString();
                conversation.addAssistantMessage(messageId, 
                        "I need both the robot ID and template ID to connect them. Please provide this information:", null);
                
                return AssistantResponse.createFormRequestResponse(
                        request.getId(),
                        "I need both the robot ID and template ID to connect them. Please provide this information:",
                        formFields,
                        conversation.getId(),
                        conversation.getMessages().size() - 1,
                        sessionState);
                
            } else if (!entities.containsKey("robot")) {
                // Need robot ID
                List<AssistantResponse.FormField> formFields = new ArrayList<>();
                
                formFields.add(AssistantResponse.FormField.builder()
                        .id("robotId")
                        .label("Robot ID or Serial Number")
                        .type(AssistantResponse.FormField.FieldType.TEXT)
                        .required(true)
                        .placeholder("Enter robot ID or serial number")
                        .build());
                
                // Store intent and partial entities in session state for follow-up
                Map<String, Object> sessionState = conversation.getSessionState();
                sessionState.put("pendingIntent", "connect_robot");
                sessionState.put("templateId", entities.get("template"));
                conversation.setSessionState(sessionState);
                
                // Add assistant message to conversation
                String messageId = UUID.randomUUID().toString();
                conversation.addAssistantMessage(messageId, 
                        "I need the robot ID to connect it to template " + entities.get("template") + ". Please provide the robot ID:", null);
                
                return AssistantResponse.createFormRequestResponse(
                        request.getId(),
                        "I need the robot ID to connect it to template " + entities.get("template") + ". Please provide the robot ID:",
                        formFields,
                        conversation.getId(),
                        conversation.getMessages().size() - 1,
                        sessionState);
                
            } else {
                // Need template ID
                List<AssistantResponse.FormField> formFields = new ArrayList<>();
                
                formFields.add(AssistantResponse.FormField.builder()
                        .id("templateId")
                        .label("Template ID")
                        .type(AssistantResponse.FormField.FieldType.TEXT)
                        .required(true)
                        .placeholder("Enter template ID")
                        .build());
                
                // Store intent and partial entities in session state for follow-up
                Map<String, Object> sessionState = conversation.getSessionState();
                sessionState.put("pendingIntent", "connect_robot");
                sessionState.put("robotId", entities.get("robot"));
                conversation.setSessionState(sessionState);
                
                // Add assistant message to conversation
                String messageId = UUID.randomUUID().toString();
                conversation.addAssistantMessage(messageId, 
                        "I need the template ID to connect robot " + entities.get("robot") + " to. Please provide the template ID:", null);
                
                return AssistantResponse.createFormRequestResponse(
                        request.getId(),
                        "I need the template ID to connect robot " + entities.get("robot") + " to. Please provide the template ID:",
                        formFields,
                        conversation.getId(),
                        conversation.getMessages().size() - 1,
                        sessionState);
            }
        }
    }
    
    /**
     * Handle a disconnect robot intent
     * @param request Assistant request
     * @param conversation Conversation
     * @param intent Intent data
     * @return Assistant response
     */
    private AssistantResponse handleDisconnectRobotIntent(
            AssistantRequest request, Conversation conversation, Map<String, Object> intent) {
        
        // Check if we have robot ID
        Map<String, String> entities = (Map<String, String>) intent.get("entities");
        
        if (entities.containsKey("robot")) {
            // We have the robot ID, proceed with disconnection
            Map<String, Object> params = new HashMap<>();
            params.put("robotId", entities.get("robot"));
            
            AssistantRequest disconnectRequest = AssistantRequest.builder()
                    .id(UUID.randomUUID().toString())
                    .userId(request.getUserId())
                    .timestamp(LocalDateTime.now())
                    .type(AssistantRequest.RequestType.DISCONNECT_ROBOT)
                    .parameters(params)
                    .conversationId(conversation.getId())
                    .messageSequence(conversation.getMessages().size())
                    .sessionState(conversation.getSessionState())
                    .build();
            
            return processDisconnectRobot(disconnectRequest, conversation);
            
        } else {
            // Need robot ID
            List<AssistantResponse.FormField> formFields = new ArrayList<>();
            
            formFields.add(AssistantResponse.FormField.builder()
                    .id("robotId")
                    .label("Robot ID or Serial Number")
                    .type(AssistantResponse.FormField.FieldType.TEXT)
                    .required(true)
                    .placeholder("Enter robot ID or serial number")
                    .build());
            
            // Store intent in session state for follow-up
            Map<String, Object> sessionState = conversation.getSessionState();
            sessionState.put("pendingIntent", "disconnect_robot");
            conversation.setSessionState(sessionState);
            
            // Add assistant message to conversation
            String messageId = UUID.randomUUID().toString();
            conversation.addAssistantMessage(messageId, 
                    "I need the robot ID to disconnect it from its template. Please provide the robot ID:", null);
            
            return AssistantResponse.createFormRequestResponse(
                    request.getId(),
                    "I need the robot ID to disconnect it from its template. Please provide the robot ID:",
                    formFields,
                    conversation.getId(),
                    conversation.getMessages().size() - 1,
                    sessionState);
        }
    }
    
    /**
     * Handle an update template intent
     * @param request Assistant request
     * @param conversation Conversation
     * @param intent Intent data
     * @return Assistant response
     */
    private AssistantResponse handleUpdateTemplateIntent(
            AssistantRequest request, Conversation conversation, Map<String, Object> intent) {
        
        // Check if we have template ID
        Map<String, String> entities = (Map<String, String>) intent.get("entities");
        
        if (entities.containsKey("template")) {
            // We have the template ID, but we need to know what updates to make
            // Ask for update details
            List<AssistantResponse.FormField> formFields = new ArrayList<>();
            
            formFields.add(AssistantResponse.FormField.builder()
                    .id("updateType")
                    .label("What would you like to update?")
                    .type(AssistantResponse.FormField.FieldType.SELECT)
                    .required(true)
                    .options(List.of(
                            AssistantResponse.ResponseOption.builder()
                                    .id("buttons")
                                    .label("Template Buttons")
                                    .build(),
                            AssistantResponse.ResponseOption.builder()
                                    .id("name")
                                    .label("Template Name")
                                    .build(),
                            AssistantResponse.ResponseOption.builder()
                                    .id("floors")
                                    .label("Floor Configuration")
                                    .build(),
                            AssistantResponse.ResponseOption.builder()
                                    .id("units")
                                    .label("Unit Numbers")
                                    .build()
                    ))
                    .build());
            
            // Store template ID in session state for follow-up
            Map<String, Object> sessionState = conversation.getSessionState();
            sessionState.put("pendingIntent", "update_template");
            sessionState.put("templateId", entities.get("template"));
            conversation.setSessionState(sessionState);
            
            // Add assistant message to conversation
            String messageId = UUID.randomUUID().toString();
            conversation.addAssistantMessage(messageId, 
                    "What would you like to update in template " + entities.get("template") + "?", null);
            
            return AssistantResponse.createFormRequestResponse(
                    request.getId(),
                    "What would you like to update in template " + entities.get("template") + "?",
                    formFields,
                    conversation.getId(),
                    conversation.getMessages().size() - 1,
                    sessionState);
            
        } else {
            // Need template ID
            List<AssistantResponse.FormField> formFields = new ArrayList<>();
            
            formFields.add(AssistantResponse.FormField.builder()
                    .id("templateId")
                    .label("Template ID")
                    .type(AssistantResponse.FormField.FieldType.TEXT)
                    .required(true)
                    .placeholder("Enter template ID")
                    .build());
            
            // Store intent in session state for follow-up
            Map<String, Object> sessionState = conversation.getSessionState();
            sessionState.put("pendingIntent", "update_template");
            conversation.setSessionState(sessionState);
            
            // Add assistant message to conversation
            String messageId = UUID.randomUUID().toString();
            conversation.addAssistantMessage(messageId, 
                    "I need the template ID to update. Please provide the template ID:", null);
            
            return AssistantResponse.createFormRequestResponse(
                    request.getId(),
                    "I need the template ID to update. Please provide the template ID:",
                    formFields,
                    conversation.getId(),
                    conversation.getMessages().size() - 1,
                    sessionState);
        }
    }
    
    /**
     * Handle a connect map intent
     * @param request Assistant request
     * @param conversation Conversation
     * @param intent Intent data
     * @return Assistant response
     */
    private AssistantResponse handleConnectMapIntent(
            AssistantRequest request, Conversation conversation, Map<String, Object> intent) {
        
        // Check if we have map ID, template ID, and floor
        Map<String, String> entities = (Map<String, String>) intent.get("entities");
        boolean hasMapId = entities.containsKey("map");
        boolean hasTemplateId = entities.containsKey("template");
        boolean hasFloor = entities.containsKey("floor");
        
        if (hasMapId && hasTemplateId && hasFloor) {
            // We have all entities, proceed with connection
            AssistantRequest connectMapRequest = AssistantRequest.createConnectMapRequest(
                    request.getUserId(),
                    entities.get("map"),
                    entities.get("template"),
                    entities.get("floor"),
                    conversation.getId(),
                    conversation.getMessages().size(),
                    conversation.getSessionState());
            
            return processConnectMap(connectMapRequest, conversation);
            
        } else {
            // Missing some entities, request them
            List<AssistantResponse.FormField> formFields = new ArrayList<>();
            Map<String, Object> sessionState = conversation.getSessionState();
            sessionState.put("pendingIntent", "connect_map");
            
            // Add missing fields
            if (!hasMapId) {
                formFields.add(AssistantResponse.FormField.builder()
                        .id("mapId")
                        .label("Map ID")
                        .type(AssistantResponse.FormField.FieldType.TEXT)
                        .required(true)
                        .placeholder("Enter map ID")
                        .build());
            } else {
                sessionState.put("mapId", entities.get("map"));
            }
            
            if (!hasTemplateId) {
                formFields.add(AssistantResponse.FormField.builder()
                        .id("templateId")
                        .label("Template ID")
                        .type(AssistantResponse.FormField.FieldType.TEXT)
                        .required(true)
                        .placeholder("Enter template ID")
                        .build());
            } else {
                sessionState.put("templateId", entities.get("template"));
            }
            
            if (!hasFloor) {
                formFields.add(AssistantResponse.FormField.builder()
                        .id("floor")
                        .label("Floor")
                        .type(AssistantResponse.FormField.FieldType.TEXT)
                        .required(true)
                        .placeholder("Enter floor (e.g., 1, 2, 3)")
                        .build());
            } else {
                sessionState.put("floor", entities.get("floor"));
            }
            
            conversation.setSessionState(sessionState);
            
            // Add assistant message to conversation
            String messageId = UUID.randomUUID().toString();
            String message = "I need more information to connect the map to the template:";
            conversation.addAssistantMessage(messageId, message, null);
            
            return AssistantResponse.createFormRequestResponse(
                    request.getId(),
                    message,
                    formFields,
                    conversation.getId(),
                    conversation.getMessages().size() - 1,
                    sessionState);
        }
    }
    
    /**
     * Handle a list robots intent
     * @param request Assistant request
     * @param conversation Conversation
     * @param intent Intent data
     * @return Assistant response
     */
    private AssistantResponse handleListRobotsIntent(
            AssistantRequest request, Conversation conversation, Map<String, Object> intent) {
        
        AssistantRequest listRequest = AssistantRequest.builder()
                .id(UUID.randomUUID().toString())
                .userId(request.getUserId())
                .timestamp(LocalDateTime.now())
                .type(AssistantRequest.RequestType.ROBOT_LIST)
                .conversationId(conversation.getId())
                .messageSequence(conversation.getMessages().size())
                .sessionState(conversation.getSessionState())
                .build();
        
        return processRobotList(listRequest, conversation);
    }
    
    /**
     * Handle a list templates intent
     * @param request Assistant request
     * @param conversation Conversation
     * @param intent Intent data
     * @return Assistant response
     */
    private AssistantResponse handleListTemplatesIntent(
            AssistantRequest request, Conversation conversation, Map<String, Object> intent) {
        
        AssistantRequest listRequest = AssistantRequest.builder()
                .id(UUID.randomUUID().toString())
                .userId(request.getUserId())
                .timestamp(LocalDateTime.now())
                .type(AssistantRequest.RequestType.TEMPLATE_LIST)
                .conversationId(conversation.getId())
                .messageSequence(conversation.getMessages().size())
                .sessionState(conversation.getSessionState())
                .build();
        
        return processTemplateList(listRequest, conversation);
    }
    
    /**
     * Handle a list maps intent
     * @param request Assistant request
     * @param conversation Conversation
     * @param intent Intent data
     * @return Assistant response
     */
    private AssistantResponse handleListMapsIntent(
            AssistantRequest request, Conversation conversation, Map<String, Object> intent) {
        
        AssistantRequest listRequest = AssistantRequest.builder()
                .id(UUID.randomUUID().toString())
                .userId(request.getUserId())
                .timestamp(LocalDateTime.now())
                .type(AssistantRequest.RequestType.MAP_LIST)
                .conversationId(conversation.getId())
                .messageSequence(conversation.getMessages().size())
                .sessionState(conversation.getSessionState())
                .build();
        
        return processMapList(listRequest, conversation);
    }
    
    /**
     * Handle a get info intent
     * @param request Assistant request
     * @param conversation Conversation
     * @param intent Intent data
     * @return Assistant response
     */
    private AssistantResponse handleGetInfoIntent(
            AssistantRequest request, Conversation conversation, Map<String, Object> intent) {
        
        // Check entities to determine what info to get
        Map<String, String> entities = (Map<String, String>) intent.get("entities");
        Map<String, Object> responseData = new HashMap<>();
        String message;
        
        if (entities.containsKey("robot")) {
            // Get robot info
            String robotId = entities.get("robot");
            try {
                Map<String, Object> robotInfo = robotService.getRobotInfo(robotId);
                responseData.put("robotInfo", robotInfo);
                message = "Here is the information for robot " + robotId + ":\n" +
                          formatRobotInfo(robotInfo);
            } catch (Exception e) {
                log.error("Error getting robot info", e);
                return createErrorResponse(request, conversation, 
                        "Error retrieving information for robot " + robotId, null);
            }
            
        } else if (entities.containsKey("template")) {
            // Get template info
            String templateId = entities.get("template");
            try {
                Map<String, Object> templateInfo = templateService.getTemplateInfo(templateId);
                responseData.put("templateInfo", templateInfo);
                message = "Here is the information for template " + templateId + ":\n" +
                          formatTemplateInfo(templateInfo);
            } catch (Exception e) {
                log.error("Error getting template info", e);
                return createErrorResponse(request, conversation, 
                        "Error retrieving information for template " + templateId, null);
            }
            
        } else if (entities.containsKey("map")) {
            // Get map info
            String mapId = entities.get("map");
            try {
                Map<String, Object> mapInfo = mapService.getMapInfo(mapId);
                responseData.put("mapInfo", mapInfo);
                message = "Here is the information for map " + mapId + ":\n" +
                          formatMapInfo(mapInfo);
            } catch (Exception e) {
                log.error("Error getting map info", e);
                return createErrorResponse(request, conversation, 
                        "Error retrieving information for map " + mapId, null);
            }
            
        } else {
            // No specific entity, get system status
            try {
                Map<String, Object> systemInfo = new HashMap<>();
                systemInfo.put("robotCount", robotService.getRobotCount());
                systemInfo.put("templateCount", templateService.getTemplateCount());
                systemInfo.put("mapCount", mapService.getMapCount());
                systemInfo.put("timestamp", LocalDateTime.now());
                
                responseData.put("systemInfo", systemInfo);
                message = "Here is the current system status:\n" +
                          formatSystemInfo(systemInfo);
            } catch (Exception e) {
                log.error("Error getting system info", e);
                return createErrorResponse(request, conversation, 
                        "Error retrieving system information", null);
            }
        }
        
        // Add assistant message to conversation
        String messageId = UUID.randomUUID().toString();
        conversation.addAssistantMessage(messageId, message, null);
        
        return AssistantResponse.createActionResultResponse(
                request.getId(),
                true,
                message,
                responseData,
                conversation.getId(),
                conversation.getMessages().size() - 1,
                conversation.getSessionState());
    }
    
    /**
     * Handle a general query
     * @param request Assistant request
     * @param conversation Conversation
     * @param intent Intent data
     * @return Assistant response
     */
    private AssistantResponse handleGeneralQuery(
            AssistantRequest request, Conversation conversation, Map<String, Object> intent) {
        
        // For general queries, respond with information about capabilities
        String message = "I'm your robot assistant. I can help you with:\n\n" +
                "- Connecting robots to templates\n" +
                "- Disconnecting robots from templates\n" +
                "- Updating templates\n" +
                "- Connecting maps to templates\n" +
                "- Creating users\n" +
                "- Listing robots, templates, and maps\n" +
                "- Getting information about the system\n\n" +
                "How can I assist you today?";
        
        // Add assistant message to conversation
        String messageId = UUID.randomUUID().toString();
        conversation.addAssistantMessage(messageId, message, null);
        
        return AssistantResponse.createTextResponse(
                request.getId(),
                message,
                conversation.getId(),
                conversation.getMessages().size() - 1,
                conversation.getSessionState());
    }
    
    /**
     * Process a connect robot request
     * @param request Assistant request
     * @param conversation Conversation
     * @return Assistant response
     */
    private AssistantResponse processConnectRobot(AssistantRequest request, Conversation conversation) {
        log.info("Processing connect robot request");
        
        // Extract parameters
        Map<String, Object> params = request.getParameters();
        String robotId = (String) params.get("robotId");
        String templateId = (String) params.get("templateId");
        
        if (robotId == null || templateId == null) {
            return createErrorResponse(request, conversation, 
                    "Missing robot ID or template ID", null);
        }
        
        // Attempt to connect robot to template
        try {
            boolean connected = robotService.connectRobotToTemplate(robotId, templateId);
            
            if (connected) {
                // Success
                String message = "Successfully connected robot " + robotId + " to template " + templateId;
                
                // Add assistant message to conversation
                String messageId = UUID.randomUUID().toString();
                conversation.addAssistantMessage(messageId, message, null);
                
                Map<String, Object> responseData = new HashMap<>();
                responseData.put("robotId", robotId);
                responseData.put("templateId", templateId);
                
                return AssistantResponse.createActionResultResponse(
                        request.getId(),
                        true,
                        message,
                        responseData,
                        conversation.getId(),
                        conversation.getMessages().size() - 1,
                        conversation.getSessionState());
            } else {
                // Failed
                return createErrorResponse(request, conversation, 
                        "Failed to connect robot " + robotId + " to template " + templateId, null);
            }
        } catch (Exception e) {
            log.error("Error connecting robot to template", e);
            return createErrorResponse(request, conversation, 
                    "Error connecting robot to template: " + e.getMessage(), null);
        }
    }
    
    /**
     * Process a disconnect robot request
     * @param request Assistant request
     * @param conversation Conversation
     * @return Assistant response
     */
    private AssistantResponse processDisconnectRobot(AssistantRequest request, Conversation conversation) {
        log.info("Processing disconnect robot request");
        
        // Extract parameters
        Map<String, Object> params = request.getParameters();
        String robotId = (String) params.get("robotId");
        
        if (robotId == null) {
            return createErrorResponse(request, conversation, 
                    "Missing robot ID", null);
        }
        
        // Attempt to disconnect robot from template
        try {
            boolean disconnected = robotService.disconnectRobotFromTemplate(robotId);
            
            if (disconnected) {
                // Success
                String message = "Successfully disconnected robot " + robotId + " from its template";
                
                // Add assistant message to conversation
                String messageId = UUID.randomUUID().toString();
                conversation.addAssistantMessage(messageId, message, null);
                
                Map<String, Object> responseData = new HashMap<>();
                responseData.put("robotId", robotId);
                
                return AssistantResponse.createActionResultResponse(
                        request.getId(),
                        true,
                        message,
                        responseData,
                        conversation.getId(),
                        conversation.getMessages().size() - 1,
                        conversation.getSessionState());
            } else {
                // Failed or robot wasn't connected to a template
                return createErrorResponse(request, conversation, 
                        "Robot " + robotId + " is not connected to any template or could not be disconnected", null);
            }
        } catch (Exception e) {
            log.error("Error disconnecting robot from template", e);
            return createErrorResponse(request, conversation, 
                    "Error disconnecting robot from template: " + e.getMessage(), null);
        }
    }
    
    /**
     * Process an update template request
     * @param request Assistant request
     * @param conversation Conversation
     * @return Assistant response
     */
    private AssistantResponse processUpdateTemplate(AssistantRequest request, Conversation conversation) {
        log.info("Processing update template request");
        
        // Extract parameters
        Map<String, Object> params = request.getParameters();
        String templateId = (String) params.get("templateId");
        Map<String, Object> updates = (Map<String, Object>) params.get("updates");
        
        if (templateId == null || updates == null) {
            return createErrorResponse(request, conversation, 
                    "Missing template ID or updates", null);
        }
        
        // Attempt to update template
        try {
            boolean updated = templateService.updateTemplate(templateId, updates);
            
            if (updated) {
                // Success
                String message = "Successfully updated template " + templateId;
                
                // Add assistant message to conversation
                String messageId = UUID.randomUUID().toString();
                conversation.addAssistantMessage(messageId, message, null);
                
                Map<String, Object> responseData = new HashMap<>();
                responseData.put("templateId", templateId);
                responseData.put("updates", updates);
                
                return AssistantResponse.createActionResultResponse(
                        request.getId(),
                        true,
                        message,
                        responseData,
                        conversation.getId(),
                        conversation.getMessages().size() - 1,
                        conversation.getSessionState());
            } else {
                // Failed
                return createErrorResponse(request, conversation, 
                        "Failed to update template " + templateId, null);
            }
        } catch (Exception e) {
            log.error("Error updating template", e);
            return createErrorResponse(request, conversation, 
                    "Error updating template: " + e.getMessage(), null);
        }
    }
    
    /**
     * Process a connect map request
     * @param request Assistant request
     * @param conversation Conversation
     * @return Assistant response
     */
    private AssistantResponse processConnectMap(AssistantRequest request, Conversation conversation) {
        log.info("Processing connect map request");
        
        // Extract parameters
        Map<String, Object> params = request.getParameters();
        String mapId = (String) params.get("mapId");
        String templateId = (String) params.get("templateId");
        String floor = (String) params.get("floor");
        
        if (mapId == null || templateId == null || floor == null) {
            return createErrorResponse(request, conversation, 
                    "Missing map ID, template ID, or floor", null);
        }
        
        // Attempt to connect map to template
        try {
            boolean connected = mapService.connectMapToTemplate(mapId, templateId, floor);
            
            if (connected) {
                // Success
                String message = "Successfully connected map " + mapId + " to floor " + floor + 
                                " of template " + templateId;
                
                // Add assistant message to conversation
                String messageId = UUID.randomUUID().toString();
                conversation.addAssistantMessage(messageId, message, null);
                
                // Check if we need to update template buttons based on map
                boolean buttonUpdated = templateService.updateButtonsFromMap(templateId, floor, mapId);
                if (buttonUpdated) {
                    message += "\n\nI've also updated the template buttons based on the map locations.";
                }
                
                Map<String, Object> responseData = new HashMap<>();
                responseData.put("mapId", mapId);
                responseData.put("templateId", templateId);
                responseData.put("floor", floor);
                responseData.put("buttonsUpdated", buttonUpdated);
                
                return AssistantResponse.createActionResultResponse(
                        request.getId(),
                        true,
                        message,
                        responseData,
                        conversation.getId(),
                        conversation.getMessages().size() - 1,
                        conversation.getSessionState());
            } else {
                // Failed
                return createErrorResponse(request, conversation, 
                        "Failed to connect map " + mapId + " to template " + templateId, null);
            }
        } catch (Exception e) {
            log.error("Error connecting map to template", e);
            return createErrorResponse(request, conversation, 
                    "Error connecting map to template: " + e.getMessage(), null);
        }
    }
    
    /**
     * Process a create user request
     * @param request Assistant request
     * @param conversation Conversation
     * @return Assistant response
     */
    private AssistantResponse processCreateUser(AssistantRequest request, Conversation conversation) {
        log.info("Processing create user request");
        
        // Extract parameters
        Map<String, Object> params = request.getParameters();
        String username = (String) params.get("username");
        String password = (String) params.get("password");
        String role = (String) params.get("role");
        
        if (username == null || password == null) {
            return createErrorResponse(request, conversation, 
                    "Missing username or password", null);
        }
        
        // Use default role if not provided
        if (role == null) {
            role = "user";
        }
        
        // Attempt to create user
        try {
            boolean created = userService.createUser(username, password, role);
            
            if (created) {
                // Success
                String message = "Successfully created user " + username + " with role " + role;
                
                // Add assistant message to conversation
                String messageId = UUID.randomUUID().toString();
                conversation.addAssistantMessage(messageId, message, null);
                
                Map<String, Object> responseData = new HashMap<>();
                responseData.put("username", username);
                responseData.put("role", role);
                
                return AssistantResponse.createActionResultResponse(
                        request.getId(),
                        true,
                        message,
                        responseData,
                        conversation.getId(),
                        conversation.getMessages().size() - 1,
                        conversation.getSessionState());
            } else {
                // Failed
                return createErrorResponse(request, conversation, 
                        "Failed to create user " + username, null);
            }
        } catch (Exception e) {
            log.error("Error creating user", e);
            return createErrorResponse(request, conversation, 
                    "Error creating user: " + e.getMessage(), null);
        }
    }
    
    /**
     * Process a robot list request
     * @param request Assistant request
     * @param conversation Conversation
     * @return Assistant response
     */
    private AssistantResponse processRobotList(AssistantRequest request, Conversation conversation) {
        log.info("Processing robot list request");
        
        // Attempt to list robots
        try {
            List<Map<String, Object>> robots = robotService.listRobots();
            
            // Format the response
            StringBuilder messageBuilder = new StringBuilder("Here are the available robots:\n\n");
            
            if (robots.isEmpty()) {
                messageBuilder.append("No robots found.");
            } else {
                for (Map<String, Object> robot : robots) {
                    messageBuilder.append("- Robot ID: ").append(robot.get("id"))
                            .append(", Serial: ").append(robot.get("serialNumber"))
                            .append(", Status: ").append(robot.get("status"));
                    
                    if (robot.containsKey("templateId") && robot.get("templateId") != null) {
                        messageBuilder.append(", Template: ").append(robot.get("templateId"));
                    } else {
                        messageBuilder.append(", No template assigned");
                    }
                    
                    messageBuilder.append("\n");
                }
            }
            
            String message = messageBuilder.toString();
            
            // Add assistant message to conversation
            String messageId = UUID.randomUUID().toString();
            conversation.addAssistantMessage(messageId, message, null);
            
            Map<String, Object> responseData = new HashMap<>();
            responseData.put("robots", robots);
            
            return AssistantResponse.createActionResultResponse(
                    request.getId(),
                    true,
                    message,
                    responseData,
                    conversation.getId(),
                    conversation.getMessages().size() - 1,
                    conversation.getSessionState());
            
        } catch (Exception e) {
            log.error("Error listing robots", e);
            return createErrorResponse(request, conversation, 
                    "Error listing robots: " + e.getMessage(), null);
        }
    }
    
    /**
     * Process a template list request
     * @param request Assistant request
     * @param conversation Conversation
     * @return Assistant response
     */
    private AssistantResponse processTemplateList(AssistantRequest request, Conversation conversation) {
        log.info("Processing template list request");
        
        // Attempt to list templates
        try {
            List<Map<String, Object>> templates = templateService.listTemplates();
            
            // Format the response
            StringBuilder messageBuilder = new StringBuilder("Here are the available templates:\n\n");
            
            if (templates.isEmpty()) {
                messageBuilder.append("No templates found.");
            } else {
                for (Map<String, Object> template : templates) {
                    messageBuilder.append("- Template ID: ").append(template.get("id"))
                            .append(", Name: ").append(template.get("name"))
                            .append(", Created: ").append(template.get("createdAt"));
                    
                    // Check if template has assigned robots
                    if (template.containsKey("robotCount")) {
                        messageBuilder.append(", Assigned Robots: ").append(template.get("robotCount"));
                    }
                    
                    messageBuilder.append("\n");
                }
            }
            
            String message = messageBuilder.toString();
            
            // Add assistant message to conversation
            String messageId = UUID.randomUUID().toString();
            conversation.addAssistantMessage(messageId, message, null);
            
            Map<String, Object> responseData = new HashMap<>();
            responseData.put("templates", templates);
            
            return AssistantResponse.createActionResultResponse(
                    request.getId(),
                    true,
                    message,
                    responseData,
                    conversation.getId(),
                    conversation.getMessages().size() - 1,
                    conversation.getSessionState());
            
        } catch (Exception e) {
            log.error("Error listing templates", e);
            return createErrorResponse(request, conversation, 
                    "Error listing templates: " + e.getMessage(), null);
        }
    }
    
    /**
     * Process a map list request
     * @param request Assistant request
     * @param conversation Conversation
     * @return Assistant response
     */
    private AssistantResponse processMapList(AssistantRequest request, Conversation conversation) {
        log.info("Processing map list request");
        
        // Attempt to list maps
        try {
            List<Map<String, Object>> maps = mapService.listMaps();
            
            // Format the response
            StringBuilder messageBuilder = new StringBuilder("Here are the available maps:\n\n");
            
            if (maps.isEmpty()) {
                messageBuilder.append("No maps found.");
            } else {
                for (Map<String, Object> map : maps) {
                    messageBuilder.append("- Map ID: ").append(map.get("id"))
                            .append(", Name: ").append(map.get("name"))
                            .append(", Building: ").append(map.get("building"))
                            .append(", Floor: ").append(map.get("floor"));
                    
                    // Check if map is connected to templates
                    if (map.containsKey("connectedTemplates") && ((List<?>) map.get("connectedTemplates")).size() > 0) {
                        messageBuilder.append(", Connected Templates: ").append(map.get("connectedTemplates"));
                    } else {
                        messageBuilder.append(", Not connected to any template");
                    }
                    
                    messageBuilder.append("\n");
                }
            }
            
            String message = messageBuilder.toString();
            
            // Add assistant message to conversation
            String messageId = UUID.randomUUID().toString();
            conversation.addAssistantMessage(messageId, message, null);
            
            Map<String, Object> responseData = new HashMap<>();
            responseData.put("maps", maps);
            
            return AssistantResponse.createActionResultResponse(
                    request.getId(),
                    true,
                    message,
                    responseData,
                    conversation.getId(),
                    conversation.getMessages().size() - 1,
                    conversation.getSessionState());
            
        } catch (Exception e) {
            log.error("Error listing maps", e);
            return createErrorResponse(request, conversation, 
                    "Error listing maps: " + e.getMessage(), null);
        }
    }
    
    /**
     * Process a continue conversation request
     * @param request Assistant request
     * @param conversation Conversation
     * @return Assistant response
     */
    private AssistantResponse processContinueConversation(AssistantRequest request, Conversation conversation) {
        log.info("Processing continue conversation request");
        
        // Check if there's a pending intent in the session state
        Map<String, Object> sessionState = conversation.getSessionState();
        
        if (sessionState.containsKey("pendingIntent")) {
            String pendingIntent = (String) sessionState.get("pendingIntent");
            
            switch (pendingIntent) {
                case "connect_robot":
                    // Extract robotId and templateId from request parameters or session state
                    Map<String, Object> params = request.getParameters();
                    String robotId = params.containsKey("robotId") ? 
                            (String) params.get("robotId") : 
                            (String) sessionState.get("robotId");
                    String templateId = params.containsKey("templateId") ? 
                            (String) params.get("templateId") : 
                            (String) sessionState.get("templateId");
                    
                    // Clear pending intent
                    sessionState.remove("pendingIntent");
                    sessionState.remove("robotId");
                    sessionState.remove("templateId");
                    conversation.setSessionState(sessionState);
                    
                    // Create connect robot request
                    AssistantRequest connectRequest = AssistantRequest.createConnectRobotRequest(
                            request.getUserId(), robotId, templateId, conversation.getId(),
                            conversation.getMessages().size(), sessionState);
                    
                    return processConnectRobot(connectRequest, conversation);
                    
                case "disconnect_robot":
                    // Extract robotId from request parameters or session state
                    params = request.getParameters();
                    robotId = params.containsKey("robotId") ? 
                            (String) params.get("robotId") : 
                            (String) sessionState.get("robotId");
                    
                    // Clear pending intent
                    sessionState.remove("pendingIntent");
                    sessionState.remove("robotId");
                    conversation.setSessionState(sessionState);
                    
                    // Create disconnect robot request
                    params = new HashMap<>();
                    params.put("robotId", robotId);
                    
                    AssistantRequest disconnectRequest = AssistantRequest.builder()
                            .id(UUID.randomUUID().toString())
                            .userId(request.getUserId())
                            .timestamp(LocalDateTime.now())
                            .type(AssistantRequest.RequestType.DISCONNECT_ROBOT)
                            .parameters(params)
                            .conversationId(conversation.getId())
                            .messageSequence(conversation.getMessages().size())
                            .sessionState(sessionState)
                            .build();
                    
                    return processDisconnectRobot(disconnectRequest, conversation);
                    
                case "update_template":
                    // Extract templateId and update data from request parameters or session state
                    params = request.getParameters();
                    templateId = params.containsKey("templateId") ? 
                            (String) params.get("templateId") : 
                            (String) sessionState.get("templateId");
                    
                    String updateType = params.containsKey("updateType") ? 
                            (String) params.get("updateType") : 
                            (String) sessionState.get("updateType");
                    
                    // If we have updateType but not the update data, we need to request it
                    if (updateType != null && !params.containsKey("updateData")) {
                        // Request specific update data based on update type
                        List<AssistantResponse.FormField> formFields = new ArrayList<>();
                        
                        switch (updateType) {
                            case "name":
                                formFields.add(AssistantResponse.FormField.builder()
                                        .id("newName")
                                        .label("New Template Name")
                                        .type(AssistantResponse.FormField.FieldType.TEXT)
                                        .required(true)
                                        .placeholder("Enter new template name")
                                        .build());
                                break;
                                
                            case "buttons":
                                formFields.add(AssistantResponse.FormField.builder()
                                        .id("buttonData")
                                        .label("Button Configuration (JSON)")
                                        .type(AssistantResponse.FormField.FieldType.TEXT)
                                        .required(true)
                                        .placeholder("Enter button configuration as JSON")
                                        .build());
                                break;
                                
                            case "floors":
                                formFields.add(AssistantResponse.FormField.builder()
                                        .id("floorData")
                                        .label("Floor Configuration (JSON)")
                                        .type(AssistantResponse.FormField.FieldType.TEXT)
                                        .required(true)
                                        .placeholder("Enter floor configuration as JSON")
                                        .build());
                                break;
                                
                            case "units":
                                formFields.add(AssistantResponse.FormField.builder()
                                        .id("unitData")
                                        .label("Unit Numbers Configuration (JSON)")
                                        .type(AssistantResponse.FormField.FieldType.TEXT)
                                        .required(true)
                                        .placeholder("Enter unit numbers configuration as JSON")
                                        .build());
                                break;
                        }
                        
                        // Store update type in session state
                        sessionState.put("updateType", updateType);
                        conversation.setSessionState(sessionState);
                        
                        // Add assistant message to conversation
                        String messageId = UUID.randomUUID().toString();
                        String message = "Please provide the data for updating the " + updateType + " of template " + templateId;
                        conversation.addAssistantMessage(messageId, message, null);
                        
                        return AssistantResponse.createFormRequestResponse(
                                request.getId(),
                                message,
                                formFields,
                                conversation.getId(),
                                conversation.getMessages().size() - 1,
                                sessionState);
                    }
                    
                    // If we have all the data, create the update request
                    Map<String, Object> updates = new HashMap<>();
                    
                    if (updateType != null) {
                        // Get update data based on update type
                        switch (updateType) {
                            case "name":
                                updates.put("name", params.get("newName"));
                                break;
                                
                            case "buttons":
                                updates.put("buttons", params.get("buttonData"));
                                break;
                                
                            case "floors":
                                updates.put("floors", params.get("floorData"));
                                break;
                                
                            case "units":
                                updates.put("units", params.get("unitData"));
                                break;
                        }
                    } else {
                        // Direct update data from params
                        updates.putAll(params);
                        updates.remove("templateId"); // Remove templateId from updates
                    }
                    
                    // Clear pending intent
                    sessionState.remove("pendingIntent");
                    sessionState.remove("templateId");
                    sessionState.remove("updateType");
                    conversation.setSessionState(sessionState);
                    
                    // Create update template request
                    AssistantRequest updateRequest = AssistantRequest.createUpdateTemplateRequest(
                            request.getUserId(), templateId, updates, conversation.getId(),
                            conversation.getMessages().size(), sessionState);
                    
                    return processUpdateTemplate(updateRequest, conversation);
                    
                case "connect_map":
                    // Extract mapId, templateId, and floor from request parameters or session state
                    params = request.getParameters();
                    String mapId = params.containsKey("mapId") ? 
                            (String) params.get("mapId") : 
                            (String) sessionState.get("mapId");
                    templateId = params.containsKey("templateId") ? 
                            (String) params.get("templateId") : 
                            (String) sessionState.get("templateId");
                    String floor = params.containsKey("floor") ? 
                            (String) params.get("floor") : 
                            (String) sessionState.get("floor");
                    
                    // Clear pending intent
                    sessionState.remove("pendingIntent");
                    sessionState.remove("mapId");
                    sessionState.remove("templateId");
                    sessionState.remove("floor");
                    conversation.setSessionState(sessionState);
                    
                    // Create connect map request
                    AssistantRequest connectMapRequest = AssistantRequest.createConnectMapRequest(
                            request.getUserId(), mapId, templateId, floor, conversation.getId(),
                            conversation.getMessages().size(), sessionState);
                    
                    return processConnectMap(connectMapRequest, conversation);
                    
                default:
                    // Unknown pending intent
                    log.warn("Unknown pending intent: {}", pendingIntent);
                    sessionState.remove("pendingIntent");
                    conversation.setSessionState(sessionState);
                    
                    // Return general response
                    return handleGeneralQuery(request, conversation, new HashMap<>());
            }
        }
        
        // No pending intent, treat as text prompt
        return handleGeneralQuery(request, conversation, new HashMap<>());
    }
    
    /**
     * Create an error response
     * @param request Assistant request
     * @param conversation Conversation
     * @param errorMessage Error message
     * @param errorDetails Error details
     * @return Error response
     */
    private AssistantResponse createErrorResponse(
            AssistantRequest request, Conversation conversation, 
            String errorMessage, Map<String, Object> errorDetails) {
        
        log.error("Error in assistant request: {}", errorMessage);
        
        // Add error message to conversation
        String messageId = UUID.randomUUID().toString();
        conversation.addAssistantMessage(messageId, "Error: " + errorMessage, null);
        
        return AssistantResponse.createErrorResponse(
                request.getId(),
                errorMessage,
                errorDetails,
                conversation.getId(),
                conversation.getMessages().size() - 1,
                conversation.getSessionState());
    }
    
    /**
     * Format robot info for display
     * @param robotInfo Robot info
     * @return Formatted string
     */
    private String formatRobotInfo(Map<String, Object> robotInfo) {
        StringBuilder builder = new StringBuilder();
        
        builder.append("ID: ").append(robotInfo.get("id")).append("\n");
        builder.append("Serial Number: ").append(robotInfo.get("serialNumber")).append("\n");
        builder.append("Status: ").append(robotInfo.get("status")).append("\n");
        builder.append("Battery Level: ").append(robotInfo.get("batteryLevel")).append("%\n");
        
        if (robotInfo.containsKey("templateId") && robotInfo.get("templateId") != null) {
            builder.append("Assigned Template: ").append(robotInfo.get("templateId")).append("\n");
        } else {
            builder.append("Assigned Template: None\n");
        }
        
        if (robotInfo.containsKey("location") && robotInfo.get("location") != null) {
            Map<String, Object> location = (Map<String, Object>) robotInfo.get("location");
            builder.append("Location: Building ").append(location.get("building"))
                   .append(", Floor ").append(location.get("floor"))
                   .append(", Position (").append(location.get("x"))
                   .append(", ").append(location.get("y"))
                   .append(", ").append(location.get("z"))
                   .append(")\n");
        }
        
        return builder.toString();
    }
    
    /**
     * Format template info for display
     * @param templateInfo Template info
     * @return Formatted string
     */
    private String formatTemplateInfo(Map<String, Object> templateInfo) {
        StringBuilder builder = new StringBuilder();
        
        builder.append("ID: ").append(templateInfo.get("id")).append("\n");
        builder.append("Name: ").append(templateInfo.get("name")).append("\n");
        builder.append("Created: ").append(templateInfo.get("createdAt")).append("\n");
        
        if (templateInfo.containsKey("assignedRobots")) {
            List<?> assignedRobots = (List<?>) templateInfo.get("assignedRobots");
            builder.append("Assigned Robots: ").append(assignedRobots.size()).append("\n");
            for (Object robotObj : assignedRobots) {
                Map<String, Object> robot = (Map<String, Object>) robotObj;
                builder.append("  - ").append(robot.get("id"))
                       .append(" (").append(robot.get("serialNumber")).append(")\n");
            }
        } else {
            builder.append("Assigned Robots: None\n");
        }
        
        if (templateInfo.containsKey("floors")) {
            List<?> floors = (List<?>) templateInfo.get("floors");
            builder.append("Floors: ").append(floors.size()).append("\n");
            for (Object floorObj : floors) {
                builder.append("  - ").append(floorObj).append("\n");
            }
        }
        
        return builder.toString();
    }
    
    /**
     * Format map info for display
     * @param mapInfo Map info
     * @return Formatted string
     */
    private String formatMapInfo(Map<String, Object> mapInfo) {
        StringBuilder builder = new StringBuilder();
        
        builder.append("ID: ").append(mapInfo.get("id")).append("\n");
        builder.append("Name: ").append(mapInfo.get("name")).append("\n");
        builder.append("Building: ").append(mapInfo.get("building")).append("\n");
        builder.append("Floor: ").append(mapInfo.get("floor")).append("\n");
        
        if (mapInfo.containsKey("width") && mapInfo.containsKey("height")) {
            builder.append("Dimensions: ").append(mapInfo.get("width"))
                   .append(" x ").append(mapInfo.get("height")).append("\n");
        }
        
        if (mapInfo.containsKey("pointsOfInterest")) {
            List<?> poi = (List<?>) mapInfo.get("pointsOfInterest");
            builder.append("Points of Interest: ").append(poi.size()).append("\n");
            for (Object poiObj : poi) {
                Map<String, Object> point = (Map<String, Object>) poiObj;
                builder.append("  - ").append(point.get("name"))
                       .append(" at (").append(point.get("x"))
                       .append(", ").append(point.get("y"))
                       .append(")\n");
            }
        }
        
        if (mapInfo.containsKey("connectedTemplates")) {
            List<?> templates = (List<?>) mapInfo.get("connectedTemplates");
            builder.append("Connected Templates: ").append(templates.size()).append("\n");
            for (Object templateObj : templates) {
                builder.append("  - ").append(templateObj).append("\n");
            }
        } else {
            builder.append("Connected Templates: None\n");
        }
        
        return builder.toString();
    }
    
    /**
     * Format system info for display
     * @param systemInfo System info
     * @return Formatted string
     */
    private String formatSystemInfo(Map<String, Object> systemInfo) {
        StringBuilder builder = new StringBuilder();
        
        builder.append("Total Robots: ").append(systemInfo.get("robotCount")).append("\n");
        builder.append("Total Templates: ").append(systemInfo.get("templateCount")).append("\n");
        builder.append("Total Maps: ").append(systemInfo.get("mapCount")).append("\n");
        builder.append("System Time: ").append(systemInfo.get("timestamp")).append("\n");
        
        return builder.toString();
    }
    
    /**
     * Get conversations for a user
     * @param userId User ID
     * @return List of conversations
     */
    public List<Conversation> getConversationsForUser(String userId) {
        List<String> conversationIds = userConversations.getOrDefault(userId, Collections.emptyList());
        
        return conversationIds.stream()
                .map(conversations::get)
                .filter(Objects::nonNull)
                .collect(Collectors.toList());
    }
    
    /**
     * Get a conversation by ID
     * @param conversationId Conversation ID
     * @return Conversation or null if not found
     */
    public Conversation getConversation(String conversationId) {
        return conversations.get(conversationId);
    }
    
    /**
     * Cleanup idle conversations periodically
     */
    @Scheduled(fixedRate = 3600000) // Every hour
    public void cleanupIdleConversations() {
        log.info("Cleaning up idle conversations");
        
        int idleThresholdMinutes = 60; // 1 hour
        int maxConversationsPerUser = 10;
        
        // Find idle conversations
        List<String> idleConversationIds = conversations.values().stream()
                .filter(c -> c.isIdle(idleThresholdMinutes))
                .map(Conversation::getId)
                .collect(Collectors.toList());
        
        // Remove idle conversations
        for (String id : idleConversationIds) {
            conversations.remove(id);
        }
        
        log.info("Removed {} idle conversations", idleConversationIds.size());
        
        // Limit conversations per user
        for (Map.Entry<String, List<String>> entry : userConversations.entrySet()) {
            List<String> userConvs = entry.getValue();
            
            if (userConvs.size() > maxConversationsPerUser) {
                // Get most recent conversations
                List<Conversation> userConversationList = userConvs.stream()
                        .map(conversations::get)
                        .filter(Objects::nonNull)
                        .sorted(Comparator.comparing(Conversation::getLastActivityTime, Comparator.reverseOrder()))
                        .collect(Collectors.toList());
                
                // Keep only the most recent ones
                List<String> keptIds = userConversationList.stream()
                        .limit(maxConversationsPerUser)
                        .map(Conversation::getId)
                        .collect(Collectors.toList());
                
                // Remove the rest
                List<String> removedIds = new ArrayList<>(userConvs);
                removedIds.removeAll(keptIds);
                
                for (String id : removedIds) {
                    conversations.remove(id);
                }
                
                // Update user conversations
                entry.setValue(keptIds);
                
                log.info("Limited conversations for user {}: removed {}, kept {}", 
                        entry.getKey(), removedIds.size(), keptIds.size());
            }
        }
    }
}