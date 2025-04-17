package com.robotcontrol.ai.assistant;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Class to represent a conversation with the AI assistant
 */
@Data
@Builder
public class Conversation {
    
    // Basic conversation info
    private String id;
    private String userId;
    private LocalDateTime startTime;
    private LocalDateTime lastActivityTime;
    
    // Conversation state
    private boolean active;
    private String title;
    private String summary;
    private List<Message> messages;
    
    // Current context and state
    private Map<String, Object> sessionState;
    
    /**
     * Class to represent a message in the conversation
     */
    @Data
    @Builder
    public static class Message {
        
        public enum MessageSource {
            USER,
            ASSISTANT
        }
        
        private String id;
        private MessageSource source;
        private LocalDateTime timestamp;
        private String content;
        private Map<String, Object> metadata;
        private int sequence;
    }
    
    /**
     * Add a user message to the conversation
     * @param messageId Message ID
     * @param content Message content
     * @param metadata Message metadata
     * @return Added message
     */
    public Message addUserMessage(String messageId, String content, Map<String, Object> metadata) {
        if (messages == null) {
            messages = new ArrayList<>();
        }
        
        int sequence = messages.size();
        
        Message message = Message.builder()
                .id(messageId)
                .source(Message.MessageSource.USER)
                .timestamp(LocalDateTime.now())
                .content(content)
                .metadata(metadata)
                .sequence(sequence)
                .build();
        
        messages.add(message);
        lastActivityTime = LocalDateTime.now();
        
        // Update title if this is the first message
        if (messages.size() == 1) {
            // Use first few words of the first message as the title
            String[] words = content.split("\\s+");
            StringBuilder titleBuilder = new StringBuilder();
            for (int i = 0; i < Math.min(5, words.length); i++) {
                titleBuilder.append(words[i]).append(" ");
            }
            if (words.length > 5) {
                titleBuilder.append("...");
            }
            title = titleBuilder.toString().trim();
        }
        
        return message;
    }
    
    /**
     * Add an assistant message to the conversation
     * @param messageId Message ID
     * @param content Message content
     * @param metadata Message metadata
     * @return Added message
     */
    public Message addAssistantMessage(String messageId, String content, Map<String, Object> metadata) {
        if (messages == null) {
            messages = new ArrayList<>();
        }
        
        int sequence = messages.size();
        
        Message message = Message.builder()
                .id(messageId)
                .source(Message.MessageSource.ASSISTANT)
                .timestamp(LocalDateTime.now())
                .content(content)
                .metadata(metadata)
                .sequence(sequence)
                .build();
        
        messages.add(message);
        lastActivityTime = LocalDateTime.now();
        
        return message;
    }
    
    /**
     * Get the last message in the conversation
     * @return Last message or null if no messages
     */
    public Message getLastMessage() {
        if (messages == null || messages.isEmpty()) {
            return null;
        }
        
        return messages.get(messages.size() - 1);
    }
    
    /**
     * Get the last user message in the conversation
     * @return Last user message or null if no user messages
     */
    public Message getLastUserMessage() {
        if (messages == null || messages.isEmpty()) {
            return null;
        }
        
        for (int i = messages.size() - 1; i >= 0; i--) {
            Message message = messages.get(i);
            if (message.getSource() == Message.MessageSource.USER) {
                return message;
            }
        }
        
        return null;
    }
    
    /**
     * Get the last assistant message in the conversation
     * @return Last assistant message or null if no assistant messages
     */
    public Message getLastAssistantMessage() {
        if (messages == null || messages.isEmpty()) {
            return null;
        }
        
        for (int i = messages.size() - 1; i >= 0; i--) {
            Message message = messages.get(i);
            if (message.getSource() == Message.MessageSource.ASSISTANT) {
                return message;
            }
        }
        
        return null;
    }
    
    /**
     * Create a new conversation
     * @param userId User ID
     * @return New conversation
     */
    public static Conversation createNewConversation(String userId) {
        LocalDateTime now = LocalDateTime.now();
        
        return Conversation.builder()
                .id(java.util.UUID.randomUUID().toString())
                .userId(userId)
                .startTime(now)
                .lastActivityTime(now)
                .active(true)
                .messages(new ArrayList<>())
                .sessionState(new java.util.HashMap<>())
                .build();
    }
    
    /**
     * Check if the conversation is idle (no activity for a period)
     * @param idleThresholdMinutes Minutes of inactivity to consider idle
     * @return True if conversation is idle
     */
    public boolean isIdle(int idleThresholdMinutes) {
        if (lastActivityTime == null) {
            return false;
        }
        
        LocalDateTime idleThreshold = LocalDateTime.now().minusMinutes(idleThresholdMinutes);
        return lastActivityTime.isBefore(idleThreshold);
    }
    
    /**
     * Generate a summary of the conversation
     * @return Generated summary
     */
    public String generateSummary() {
        if (messages == null || messages.isEmpty()) {
            return "No messages";
        }
        
        // Get the first user message
        Message firstMessage = null;
        for (Message message : messages) {
            if (message.getSource() == Message.MessageSource.USER) {
                firstMessage = message;
                break;
            }
        }
        
        if (firstMessage == null) {
            return "No user messages";
        }
        
        // Count messages
        int userMessageCount = 0;
        int assistantMessageCount = 0;
        for (Message message : messages) {
            if (message.getSource() == Message.MessageSource.USER) {
                userMessageCount++;
            } else {
                assistantMessageCount++;
            }
        }
        
        // Generate summary
        StringBuilder summary = new StringBuilder();
        summary.append(title != null ? title : "Untitled");
        summary.append(" - ");
        summary.append(userMessageCount).append(" user messages, ");
        summary.append(assistantMessageCount).append(" assistant messages");
        
        return summary.toString();
    }
}