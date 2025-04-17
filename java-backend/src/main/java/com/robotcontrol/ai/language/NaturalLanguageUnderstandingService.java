package com.robotcontrol.ai.language;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.annotation.PostConstruct;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Service for natural language understanding and processing
 */
@Service
@Slf4j
public class NaturalLanguageUnderstandingService {
    
    @Value("${nlp.api.key:}")
    private String apiKey;
    
    @Value("${nlp.use.external.api:false}")
    private boolean useExternalApi;
    
    // Conversation contexts by session ID
    private final Map<String, List<UserMessage>> conversationHistory = new ConcurrentHashMap<>();
    
    // Intent recognition patterns (simplified local version)
    private final Map<Intent.IntentType, List<Pattern>> intentPatterns = new HashMap<>();
    
    // Entity extraction patterns
    private final Map<String, Pattern> entityPatterns = new HashMap<>();
    
    // Intent phrase mappings for learning
    private final Map<String, Intent.IntentType> learnedPhrases = new ConcurrentHashMap<>();
    
    // Maximum history size per conversation
    private static final int MAX_HISTORY_SIZE = 10;
    
    @PostConstruct
    public void initialize() {
        log.info("Initializing Natural Language Understanding Service");
        
        // Initialize intent recognition patterns
        initializeIntentPatterns();
        
        // Initialize entity extraction patterns
        initializeEntityPatterns();
    }
    
    /**
     * Initialize basic intent recognition patterns
     */
    private void initializeIntentPatterns() {
        // Move to location intent
        List<Pattern> movePatterns = new ArrayList<>();
        movePatterns.add(Pattern.compile("(?i)(?:please |)(?:go|move|navigate|travel)(?: to | towards | )(.+)"));
        movePatterns.add(Pattern.compile("(?i)take me to (.+)"));
        movePatterns.add(Pattern.compile("(?i)(?:i want to|let's) go to (.+)"));
        intentPatterns.put(Intent.IntentType.MOVE_TO, movePatterns);
        
        // Pick up intent
        List<Pattern> pickupPatterns = new ArrayList<>();
        pickupPatterns.add(Pattern.compile("(?i)(?:please |)(?:pick|grab|get|take)(?: up| ) (.+)"));
        pickupPatterns.add(Pattern.compile("(?i)(?:pick up|grab|get|retrieve) (?:the |my |)(.+?)(?: for me| please|)$"));
        intentPatterns.put(Intent.IntentType.PICK_UP, pickupPatterns);
        
        // Deliver intent
        List<Pattern> deliverPatterns = new ArrayList<>();
        deliverPatterns.add(Pattern.compile("(?i)(?:please |)(?:deliver|bring|take) (.+?) to (.+)"));
        deliverPatterns.add(Pattern.compile("(?i)(?:please |)(?:deliver|bring|take) (.+?) (?:to|for) (.+)"));
        intentPatterns.put(Intent.IntentType.DELIVER_TO, deliverPatterns);
        
        // Clean intent
        List<Pattern> cleanPatterns = new ArrayList<>();
        cleanPatterns.add(Pattern.compile("(?i)(?:please |)clean (?:the |)(.+)"));
        cleanPatterns.add(Pattern.compile("(?i)(?:please |)(?:vacuum|mop|sweep) (?:the |)(.+)"));
        intentPatterns.put(Intent.IntentType.CLEAN, cleanPatterns);
        
        // Follow intent
        List<Pattern> followPatterns = new ArrayList<>();
        followPatterns.add(Pattern.compile("(?i)(?:please |)follow me"));
        followPatterns.add(Pattern.compile("(?i)(?:please |)come with me"));
        intentPatterns.put(Intent.IntentType.FOLLOW, followPatterns);
        
        // Stop intent
        List<Pattern> stopPatterns = new ArrayList<>();
        stopPatterns.add(Pattern.compile("(?i)(?:please |)stop"));
        stopPatterns.add(Pattern.compile("(?i)halt"));
        stopPatterns.add(Pattern.compile("(?i)freeze"));
        intentPatterns.put(Intent.IntentType.STOP, stopPatterns);
        
        // Pause intent
        List<Pattern> pausePatterns = new ArrayList<>();
        pausePatterns.add(Pattern.compile("(?i)(?:please |)pause"));
        pausePatterns.add(Pattern.compile("(?i)(?:please |)wait"));
        intentPatterns.put(Intent.IntentType.PAUSE, pausePatterns);
        
        // Resume intent
        List<Pattern> resumePatterns = new ArrayList<>();
        resumePatterns.add(Pattern.compile("(?i)(?:please |)(?:resume|continue|proceed)"));
        resumePatterns.add(Pattern.compile("(?i)(?:please |)(?:go|move) (?:on|ahead)"));
        intentPatterns.put(Intent.IntentType.RESUME, resumePatterns);
        
        // Status intent
        List<Pattern> statusPatterns = new ArrayList<>();
        statusPatterns.add(Pattern.compile("(?i)(?:what is|what's) (?:your|the) status"));
        statusPatterns.add(Pattern.compile("(?i)how are you"));
        statusPatterns.add(Pattern.compile("(?i)status report"));
        statusPatterns.add(Pattern.compile("(?i)system status"));
        intentPatterns.put(Intent.IntentType.STATUS, statusPatterns);
        
        // Battery intent
        List<Pattern> batteryPatterns = new ArrayList<>();
        batteryPatterns.add(Pattern.compile("(?i)(?:what is|what's) (?:your|the) battery(?: level|)"));
        batteryPatterns.add(Pattern.compile("(?i)how (?:much|) battery (?:do you have|is left)"));
        batteryPatterns.add(Pattern.compile("(?i)battery level"));
        batteryPatterns.add(Pattern.compile("(?i)battery status"));
        intentPatterns.put(Intent.IntentType.BATTERY, batteryPatterns);
        
        // Help intent
        List<Pattern> helpPatterns = new ArrayList<>();
        helpPatterns.add(Pattern.compile("(?i)(?:please |)help me"));
        helpPatterns.add(Pattern.compile("(?i)(?:i need|) help"));
        helpPatterns.add(Pattern.compile("(?i)what can you do"));
        helpPatterns.add(Pattern.compile("(?i)show me commands"));
        intentPatterns.put(Intent.IntentType.HELP, helpPatterns);
        
        // Location intent
        List<Pattern> locationPatterns = new ArrayList<>();
        locationPatterns.add(Pattern.compile("(?i)where are you"));
        locationPatterns.add(Pattern.compile("(?i)(?:what is|what's) your location"));
        locationPatterns.add(Pattern.compile("(?i)(?:tell me|) your location"));
        locationPatterns.add(Pattern.compile("(?i)locate yourself"));
        intentPatterns.put(Intent.IntentType.LOCATION, locationPatterns);
    }
    
    /**
     * Initialize entity extraction patterns
     */
    private void initializeEntityPatterns() {
        // Location patterns
        entityPatterns.put("location", Pattern.compile("(?i)(?:the |)([\\w\\s]+ (?:room|office|lobby|bathroom|kitchen|area|floor|building|hall|corridor|elevator|department|warehouse|zone))"));
        
        // Item patterns
        entityPatterns.put("item", Pattern.compile("(?i)(?:the |a |an |)([\\w\\s]+ (?:box|package|container|bottle|cup|glass|plate|book|document|bag|tool|item))"));
        
        // Person patterns
        entityPatterns.put("person", Pattern.compile("(?i)(?:to |from |for |)(?:the |)([A-Z][a-z]+ (?:[A-Z][a-z]+|))"));
        
        // Number patterns
        entityPatterns.put("number", Pattern.compile("\\b(\\d+)\\b"));
        
        // Time patterns
        entityPatterns.put("time", Pattern.compile("(?i)(\\d{1,2}(?::\\d{2}|) (?:am|pm)|\\d{1,2} o'clock|noon|midnight|in \\d+ (?:minutes?|hours?))"));
    }
    
    /**
     * Process a user message and extract intent
     * @param sessionId Session identifier for conversation context
     * @param message User's message
     * @return Detected intent
     */
    public Intent processMessage(String sessionId, String message) {
        // Add message to conversation history
        addToConversationHistory(sessionId, message, null);
        
        // Detect intent
        Intent intent;
        
        if (useExternalApi && apiKey != null && !apiKey.isEmpty()) {
            // Use external NLP API for more advanced understanding
            intent = processWithExternalApi(message, getConversationContext(sessionId));
        } else {
            // Use simple pattern-based intent detection
            intent = detectIntentWithPatterns(message, getConversationContext(sessionId));
        }
        
        // Record the response in conversation history
        addToConversationHistory(sessionId, null, intent);
        
        return intent;
    }
    
    /**
     * Add a message to the conversation history
     * @param sessionId Session identifier
     * @param userMessage User's message (may be null for system responses)
     * @param botIntent Bot's detected intent (may be null for user messages)
     */
    private void addToConversationHistory(String sessionId, String userMessage, Intent botIntent) {
        List<UserMessage> history = conversationHistory.computeIfAbsent(sessionId, k -> new ArrayList<>());
        
        UserMessage message = new UserMessage();
        message.setTimestamp(System.currentTimeMillis());
        message.setUserMessage(userMessage);
        message.setBotIntent(botIntent);
        
        history.add(message);
        
        // Limit history size
        if (history.size() > MAX_HISTORY_SIZE) {
            history.remove(0);
        }
    }
    
    /**
     * Get conversation context for a session
     * @param sessionId Session identifier
     * @return Context string
     */
    private String getConversationContext(String sessionId) {
        List<UserMessage> history = conversationHistory.getOrDefault(sessionId, Collections.emptyList());
        if (history.isEmpty()) {
            return null;
        }
        
        StringBuilder context = new StringBuilder();
        for (UserMessage message : history) {
            if (message.getUserMessage() != null) {
                context.append("User: ").append(message.getUserMessage()).append("\n");
            }
            if (message.getBotIntent() != null) {
                context.append("Bot: [").append(message.getBotIntent().getType()).append("]\n");
            }
        }
        
        return context.toString();
    }
    
    /**
     * Process message with external NLP API
     * @param message User's message
     * @param context Conversation context
     * @return Detected intent
     */
    private Intent processWithExternalApi(String message, String context) {
        // This would call an external API like DialogFlow, IBM Watson, etc.
        // For now, we'll just use our pattern-based approach as a fallback
        log.info("Would process with external API: '{}'", message);
        return detectIntentWithPatterns(message, context);
    }
    
    /**
     * Detect intent using pattern matching
     * @param message User's message
     * @param context Conversation context
     * @return Detected intent
     */
    private Intent detectIntentWithPatterns(String message, String context) {
        // Check learned phrases first
        Intent.IntentType learnedIntent = learnedPhrases.get(message.toLowerCase());
        if (learnedIntent != null) {
            return createIntent(learnedIntent, 0.9, message, Collections.emptyMap());
        }
        
        // Try to match against patterns
        for (Map.Entry<Intent.IntentType, List<Pattern>> entry : intentPatterns.entrySet()) {
            Intent.IntentType intentType = entry.getKey();
            List<Pattern> patterns = entry.getValue();
            
            for (Pattern pattern : patterns) {
                Matcher matcher = pattern.matcher(message);
                if (matcher.find()) {
                    // Extract entities from the message
                    Map<String, String> entities = extractEntities(message, intentType, matcher);
                    
                    // Create intent object
                    return createIntent(intentType, 0.8, message, entities);
                }
            }
        }
        
        // No match found
        return createIntent(Intent.IntentType.UNKNOWN, 0.5, message, Collections.emptyMap());
    }
    
    /**
     * Extract entities from message based on intent type and regex match
     * @param message Original message
     * @param intentType Detected intent type
     * @param matcher Regex matcher that matched the intent
     * @return Map of extracted entities
     */
    private Map<String, String> extractEntities(String message, Intent.IntentType intentType, Matcher matcher) {
        Map<String, String> entities = new HashMap<>();
        
        // Extract entities based on intent type
        switch (intentType) {
            case MOVE_TO:
                if (matcher.groupCount() >= 1) {
                    entities.put("location", matcher.group(1).trim());
                }
                break;
                
            case PICK_UP:
                if (matcher.groupCount() >= 1) {
                    entities.put("item", matcher.group(1).trim());
                }
                break;
                
            case DELIVER_TO:
                if (matcher.groupCount() >= 2) {
                    entities.put("item", matcher.group(1).trim());
                    entities.put("location", matcher.group(2).trim());
                }
                break;
                
            case CLEAN:
                if (matcher.groupCount() >= 1) {
                    entities.put("location", matcher.group(1).trim());
                }
                break;
        }
        
        // Extract additional entities using entity patterns
        for (Map.Entry<String, Pattern> entry : entityPatterns.entrySet()) {
            String entityType = entry.getKey();
            Pattern pattern = entry.getValue();
            
            // Skip if we already have this entity
            if (entities.containsKey(entityType)) {
                continue;
            }
            
            Matcher entityMatcher = pattern.matcher(message);
            if (entityMatcher.find()) {
                entities.put(entityType, entityMatcher.group(1).trim());
            }
        }
        
        return entities;
    }
    
    /**
     * Create an intent object
     * @param type Intent type
     * @param confidence Confidence score
     * @param rawText Original message
     * @param entities Extracted entities
     * @return Intent object
     */
    private Intent createIntent(Intent.IntentType type, double confidence, String rawText, Map<String, String> entities) {
        // Check if intent is actionable
        boolean actionable = isActionable(type, entities);
        String missingInfo = actionable ? null : getMissingInformation(type, entities);
        
        return Intent.builder()
                .type(type)
                .confidence(confidence)
                .rawText(rawText)
                .entities(entities)
                .parameters(extractParameters(type, entities, rawText))
                .actionable(actionable)
                .missingInformation(missingInfo)
                .build();
    }
    
    /**
     * Check if intent has all required information to be actionable
     * @param type Intent type
     * @param entities Extracted entities
     * @return True if actionable
     */
    private boolean isActionable(Intent.IntentType type, Map<String, String> entities) {
        switch (type) {
            case MOVE_TO:
                return entities.containsKey("location");
                
            case PICK_UP:
                return entities.containsKey("item");
                
            case DELIVER_TO:
                return entities.containsKey("item") && entities.containsKey("location");
                
            case CLEAN:
                return entities.containsKey("location");
                
            case FOLLOW:
            case STOP:
            case PAUSE:
            case RESUME:
            case STATUS:
            case BATTERY:
            case HELP:
            case LOCATION:
                // These are always actionable
                return true;
                
            case UNKNOWN:
            default:
                return false;
        }
    }
    
    /**
     * Get description of missing information
     * @param type Intent type
     * @param entities Extracted entities
     * @return Description of missing information
     */
    private String getMissingInformation(Intent.IntentType type, Map<String, String> entities) {
        switch (type) {
            case MOVE_TO:
                return entities.containsKey("location") ? null : "destination location";
                
            case PICK_UP:
                return entities.containsKey("item") ? null : "item to pick up";
                
            case DELIVER_TO:
                if (!entities.containsKey("item")) {
                    return "item to deliver";
                }
                if (!entities.containsKey("location")) {
                    return "delivery destination";
                }
                return null;
                
            case CLEAN:
                return entities.containsKey("location") ? null : "location to clean";
                
            default:
                return null;
        }
    }
    
    /**
     * Extract additional parameters from entities and text
     * @param type Intent type
     * @param entities Extracted entities
     * @param rawText Original message
     * @return Parameters map
     */
    private Map<String, Object> extractParameters(Intent.IntentType type, Map<String, String> entities, String rawText) {
        Map<String, Object> parameters = new HashMap<>();
        
        // Add common parameters
        parameters.put("timestamp", System.currentTimeMillis());
        
        // Add intent-specific parameters
        switch (type) {
            case MOVE_TO:
                // Extract speed from text if available
                if (rawText.contains("quickly") || rawText.contains("fast") || rawText.contains("hurry")) {
                    parameters.put("speed", "fast");
                } else if (rawText.contains("slowly") || rawText.contains("careful")) {
                    parameters.put("speed", "slow");
                } else {
                    parameters.put("speed", "normal");
                }
                break;
                
            case CLEAN:
                // Extract thoroughness from text if available
                if (rawText.contains("thoroughly") || rawText.contains("detailed") || rawText.contains("deep")) {
                    parameters.put("thoroughness", "high");
                } else if (rawText.contains("quick") || rawText.contains("basic")) {
                    parameters.put("thoroughness", "low");
                } else {
                    parameters.put("thoroughness", "normal");
                }
                break;
        }
        
        return parameters;
    }
    
    /**
     * Train the system with a new phrase
     * @param phrase Phrase to learn
     * @param intentType Intent type to associate with the phrase
     */
    public void learnPhrase(String phrase, Intent.IntentType intentType) {
        learnedPhrases.put(phrase.toLowerCase(), intentType);
        log.info("Learned new phrase for intent {}: '{}'", intentType, phrase);
    }
    
    /**
     * Generate a response to a user message
     * @param intent Detected intent
     * @return Response message
     */
    public String generateResponse(Intent intent) {
        if (intent.getType() == Intent.IntentType.UNKNOWN) {
            return "I'm sorry, I didn't understand that. Can you please rephrase?";
        }
        
        if (!intent.isActionable()) {
            return "I need to know " + intent.getMissingInformation() + " to complete that task.";
        }
        
        switch (intent.getType()) {
            case MOVE_TO:
                return "I'll move to " + intent.getEntities().get("location") + " right away.";
                
            case PICK_UP:
                return "I'll pick up " + intent.getEntities().get("item") + " for you.";
                
            case DELIVER_TO:
                return "I'll deliver " + intent.getEntities().get("item") + " to " + intent.getEntities().get("location") + ".";
                
            case CLEAN:
                return "I'll clean " + intent.getEntities().get("location") + " for you.";
                
            case FOLLOW:
                return "I'll follow you now.";
                
            case STOP:
                return "Stopping now.";
                
            case PAUSE:
                return "Pausing current task.";
                
            case RESUME:
                return "Resuming operation.";
                
            case STATUS:
                return "I'm currently operational and ready to assist you.";
                
            case BATTERY:
                return "My battery is at 85% capacity.";
                
            case HELP:
                return "I can help you with tasks like moving to locations, picking up items, " +
                       "delivering items, cleaning, and providing information about my status.";
                
            case LOCATION:
                return "I'm currently in the main hallway.";
                
            default:
                return "I understand your request and will process it.";
        }
    }
    
    /**
     * Inner class to represent a message in conversation history
     */
    @Data
    private static class UserMessage {
        private long timestamp;
        private String userMessage;
        private Intent botIntent;
    }
}