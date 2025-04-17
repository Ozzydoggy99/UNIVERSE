// This file contains mock implementation of the AI assistant backend
// to help with development and testing until the real backend is complete

import { Request, Response } from 'express';
import { Express } from 'express';

// Mock conversation data
const conversations = new Map<string, Conversation>();
const userConversations = new Map<string, string[]>();

interface Message {
  id: string;
  source: 'USER' | 'ASSISTANT';
  content: string;
  timestamp: string;
  sequence: number;
}

interface Conversation {
  id: string;
  title: string;
  userId: string;
  startTime: string;
  lastActivityTime: string;
  messages: Message[];
  sessionState: Record<string, any>;
}

interface AssistantResponse {
  id: string;
  requestId: string;
  timestamp: string;
  type: string;
  message: string;
  success: boolean;
  data?: Record<string, any>;
  options?: any[];
  formFields?: any[];
  conversationId: string;
  messageSequence: number;
  sessionState: Record<string, any>;
}

// Helper function to create a UUID
function createUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Helper function to create a conversation
function createConversation(userId: string, initialMessage?: string): Conversation {
  const id = createUUID();
  const now = new Date().toISOString();
  
  const conversation: Conversation = {
    id,
    title: initialMessage ? getConversationTitle(initialMessage) : 'New Conversation',
    userId,
    startTime: now,
    lastActivityTime: now,
    messages: [],
    sessionState: {}
  };
  
  // Add initial message if provided
  if (initialMessage) {
    const messageId = createUUID();
    conversation.messages.push({
      id: messageId,
      source: 'USER',
      content: initialMessage,
      timestamp: now,
      sequence: 0
    });
    
    // Add assistant response
    const responseId = createUUID();
    conversation.messages.push({
      id: responseId,
      source: 'ASSISTANT',
      content: getAssistantResponse(initialMessage),
      timestamp: new Date(Date.now() + 500).toISOString(), // Slight delay for realism
      sequence: 1
    });
  }
  
  // Store the conversation
  conversations.set(id, conversation);
  
  // Add to user conversations
  const userConvs = userConversations.get(userId) || [];
  userConvs.push(id);
  userConversations.set(userId, userConvs);
  
  return conversation;
}

// Helper function to get a conversation title from the first message
function getConversationTitle(message: string): string {
  // Use first few words of the message as the title
  const words = message.split(' ');
  const title = words.slice(0, 5).join(' ');
  return title + (words.length > 5 ? '...' : '');
}

// Helper function to generate an assistant response based on the message
function getAssistantResponse(message: string): string {
  const lowerMessage = message.toLowerCase();
  
  // Check for different intents
  if (lowerMessage.includes('connect') && lowerMessage.includes('robot')) {
    return "I can help you connect a robot to a template. To do this, I need both the robot ID or serial number and the template ID. Do you have this information?";
  }
  
  if (lowerMessage.includes('disconnect') && lowerMessage.includes('robot')) {
    return "I can help you disconnect a robot from its template. Please provide the robot ID or serial number you want to disconnect.";
  }
  
  if (lowerMessage.includes('update') && lowerMessage.includes('template')) {
    return "I can help you update a template. What specific part of the template would you like to modify? (e.g., buttons, name, floors, unit numbers)";
  }
  
  if (lowerMessage.includes('connect') && lowerMessage.includes('map')) {
    return "I can help you connect a map to a template floor. For this, I'll need the map ID, template ID, and floor number. Do you have this information?";
  }
  
  if (lowerMessage.includes('list') && lowerMessage.includes('robot')) {
    return "Here are the available robots in the system:\n\n- Robot ID: R001, Serial: AX2023-001, Status: ACTIVE, No template assigned\n- Robot ID: R002, Serial: AX2023-002, Status: BUSY, Template: T001\n- Robot ID: R003, Serial: AX2023-003, Status: CHARGING, Template: T002\n- Robot ID: R004, Serial: AX2023-004, Status: OFFLINE, No template assigned";
  }
  
  if (lowerMessage.includes('list') && lowerMessage.includes('template')) {
    return "Here are the available templates in the system:\n\n- Template ID: T001, Name: Main Hospital Template, Created: 2023-08-15\n- Template ID: T002, Name: Office Building Template, Created: 2023-09-02\n- Template ID: T003, Name: University Campus Template, Created: 2023-10-10";
  }
  
  if (lowerMessage.includes('list') && lowerMessage.includes('map')) {
    return "Here are the available maps in the system:\n\n- Map ID: M001, Name: Hospital Main Floor, Building: Memorial Hospital, Floor: 1\n- Map ID: M002, Name: Hospital Second Floor, Building: Memorial Hospital, Floor: 2\n- Map ID: M003, Name: Office Main Level, Building: Tech Park Building, Floor: 1";
  }
  
  // Default greeting or generic responses
  if (lowerMessage.includes('hello') || lowerMessage.includes('hi') || lowerMessage === '') {
    return "Hello! I'm your AxBot AI Assistant. I can help you manage robots, templates, and maps. How can I assist you today?";
  }
  
  // Generic response
  return "I understand you're interested in robot management. I can help with connecting robots to templates, updating templates, connecting maps to templates, and more. Is there something specific you'd like me to help with?";
}

// Process a message and generate a form request if needed
function processMessage(userId: string, message: string, conversationId?: string): AssistantResponse {
  const now = new Date().toISOString();
  const requestId = createUUID();
  let conversation: Conversation;
  
  // Get or create conversation
  if (conversationId && conversations.has(conversationId)) {
    conversation = conversations.get(conversationId)!;
  } else {
    conversation = createConversation(userId, message);
    conversationId = conversation.id;
  }
  
  // If this is a new message (not already in the conversation)
  if (!conversation.messages.some(msg => msg.source === 'USER' && msg.content === message)) {
    // Add user message
    const messageId = createUUID();
    const msgSequence = conversation.messages.length;
    
    conversation.messages.push({
      id: messageId,
      source: 'USER',
      content: message,
      timestamp: now,
      sequence: msgSequence
    });
    
    // Add assistant response
    const responseId = createUUID();
    const responseContent = getAssistantResponse(message);
    
    conversation.messages.push({
      id: responseId,
      source: 'ASSISTANT',
      content: responseContent,
      timestamp: new Date(Date.now() + 500).toISOString(), // Slight delay for realism
      sequence: msgSequence + 1
    });
    
    // Update conversation
    conversation.lastActivityTime = now;
    if (!conversation.title || conversation.title === 'New Conversation') {
      conversation.title = getConversationTitle(message);
    }
  }
  
  // Check if we need to request additional information
  let formFields = null;
  const lowerMessage = message.toLowerCase();
  
  if ((lowerMessage.includes('connect') && lowerMessage.includes('robot')) && 
      (!lowerMessage.includes('robot') || !lowerMessage.includes('template'))) {
    // Need robot ID and template ID
    formFields = [
      {
        id: 'robotId',
        label: 'Robot ID or Serial Number',
        type: 'TEXT',
        required: true,
        placeholder: 'Enter robot ID or serial number'
      },
      {
        id: 'templateId',
        label: 'Template ID',
        type: 'TEXT',
        required: true,
        placeholder: 'Enter template ID'
      }
    ];
  } else if ((lowerMessage.includes('connect') && lowerMessage.includes('map')) && 
             (!lowerMessage.includes('map') || !lowerMessage.includes('template') || !lowerMessage.includes('floor'))) {
    // Need map ID, template ID, and floor
    formFields = [
      {
        id: 'mapId',
        label: 'Map ID',
        type: 'TEXT',
        required: true,
        placeholder: 'Enter map ID'
      },
      {
        id: 'templateId',
        label: 'Template ID',
        type: 'TEXT',
        required: true,
        placeholder: 'Enter template ID'
      },
      {
        id: 'floor',
        label: 'Floor',
        type: 'TEXT',
        required: true,
        placeholder: 'Enter floor (e.g., 1, 2, 3)'
      }
    ];
  }
  
  // Create response
  const response: AssistantResponse = {
    id: createUUID(),
    requestId,
    timestamp: now,
    type: formFields ? 'FORM_REQUEST' : 'TEXT',
    message: conversation.messages[conversation.messages.length - 1].content,
    success: true,
    conversationId,
    messageSequence: conversation.messages.length - 1,
    sessionState: conversation.sessionState
  };
  
  // Add form fields if needed
  if (formFields) {
    response.formFields = formFields;
  }
  
  return response;
}

// Process a form submission
function processForm(userId: string, formData: Record<string, any>, conversationId: string): AssistantResponse {
  const now = new Date().toISOString();
  const requestId = createUUID();
  
  // Get conversation
  if (!conversations.has(conversationId)) {
    throw new Error(`Conversation not found: ${conversationId}`);
  }
  
  const conversation = conversations.get(conversationId)!;
  
  // Generate a response based on the form data
  let responseContent = '';
  
  if (formData.robotId && formData.templateId) {
    // Connect robot to template
    responseContent = `I've successfully connected robot ${formData.robotId} to template ${formData.templateId}. The robot will now use this template for its operations.`;
  } else if (formData.mapId && formData.templateId && formData.floor) {
    // Connect map to template
    responseContent = `I've successfully connected map ${formData.mapId} to floor ${formData.floor} of template ${formData.templateId}. I've also updated the template buttons based on the map locations.`;
  } else if (formData.templateId && formData.updateType) {
    // Update template
    responseContent = `I've updated the ${formData.updateType} of template ${formData.templateId}. The changes have been saved successfully.`;
  } else {
    // Generic response
    responseContent = `I've processed your information. Is there anything else you'd like me to help with?`;
  }
  
  // Add assistant response to the conversation
  const responseId = createUUID();
  conversation.messages.push({
    id: responseId,
    source: 'ASSISTANT',
    content: responseContent,
    timestamp: now,
    sequence: conversation.messages.length
  });
  
  // Update conversation
  conversation.lastActivityTime = now;
  
  // Create response
  const response: AssistantResponse = {
    id: createUUID(),
    requestId,
    timestamp: now,
    type: 'ACTION_RESULT',
    message: responseContent,
    success: true,
    conversationId,
    messageSequence: conversation.messages.length - 1,
    sessionState: conversation.sessionState,
    data: formData
  };
  
  return response;
}

// Get conversations for a user
function getUserConversations(userId: string): Conversation[] {
  const conversationIds = userConversations.get(userId) || [];
  return conversationIds
    .map(id => conversations.get(id))
    .filter(Boolean) as Conversation[];
}

// Get a specific conversation
function getConversation(conversationId: string): Conversation | undefined {
  return conversations.get(conversationId);
}

// Create a few sample conversations for testing
function createSampleConversations(): void {
  // Create a few conversations for user 1
  const userId = '1';
  
  const conv1 = createConversation(userId, 'How do I connect a robot to a template?');
  const conv2 = createConversation(userId, 'Can you list all available robots in the system?');
  const conv3 = createConversation(userId, 'I need to update a template with new buttons');
  
  // Add more messages to the first conversation
  const conv = conversations.get(conv1.id)!;
  
  // Add user message
  const now = new Date().toISOString();
  conv.messages.push({
    id: createUUID(),
    source: 'USER',
    content: 'I want to connect robot R001 to template T002',
    timestamp: now,
    sequence: conv.messages.length
  });
  
  // Add assistant response
  conv.messages.push({
    id: createUUID(),
    source: 'ASSISTANT',
    content: 'I have successfully connected robot R001 to template T002. The robot will now use this template for its operations.',
    timestamp: new Date(Date.now() + 500).toISOString(),
    sequence: conv.messages.length
  });
  
  conv.lastActivityTime = now;
}

// Register the mock routes
export function registerMockAssistantRoutes(app: Express): void {
  // Create sample conversations for testing
  createSampleConversations();
  
  // Process a message
  app.post('/api/assistant/message', (req: Request, res: Response) => {
    try {
      const { message, conversationId } = req.body;
      const userId = req.query.userId as string;
      
      if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
      }
      
      if (!message) {
        return res.status(400).json({ error: 'Message is required' });
      }
      
      const response = processMessage(userId, message, conversationId);
      return res.json(response);
    } catch (error) {
      console.error('Error processing message:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });
  
  // Process a request (form submission)
  app.post('/api/assistant/request', (req: Request, res: Response) => {
    try {
      const { userId, parameters, conversationId } = req.body;
      
      if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
      }
      
      if (!conversationId) {
        return res.status(400).json({ error: 'Conversation ID is required' });
      }
      
      const response = processForm(userId, parameters, conversationId);
      return res.json(response);
    } catch (error) {
      console.error('Error processing request:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });
  
  // Get conversations for a user
  app.get('/api/assistant/conversations', (req: Request, res: Response) => {
    try {
      const userId = req.query.userId as string;
      
      if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
      }
      
      const userConvs = getUserConversations(userId);
      return res.json(userConvs);
    } catch (error) {
      console.error('Error getting conversations:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });
  
  // Get a specific conversation
  app.get('/api/assistant/conversations/:conversationId', (req: Request, res: Response) => {
    try {
      const { conversationId } = req.params;
      
      if (!conversationId) {
        return res.status(400).json({ error: 'Conversation ID is required' });
      }
      
      const conversation = getConversation(conversationId);
      
      if (!conversation) {
        return res.status(404).json({ error: 'Conversation not found' });
      }
      
      return res.json(conversation);
    } catch (error) {
      console.error('Error getting conversation:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });
  
  console.log('Registered mock assistant routes');
}