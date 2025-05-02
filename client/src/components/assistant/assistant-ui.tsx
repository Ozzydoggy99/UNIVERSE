import React, { useState, useEffect, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bot, Loader2, SendHorizontal, PlusCircle, History, Trash2 } from 'lucide-react';

interface Conversation {
  id: string;
  title: string;
  lastActivityTime: string;
  messages: Message[];
}

interface Message {
  id: string;
  source: 'USER' | 'ASSISTANT';
  content: string;
  timestamp: string;
  sequence: number;
}

interface AssistantRequest {
  id: string;
  userId: string;
  timestamp: string;
  type: string;
  prompt?: string;
  parameters?: Record<string, any>;
  conversationId?: string;
  messageSequence: number;
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
  options?: ResponseOption[];
  formFields?: FormField[];
  conversationId: string;
  messageSequence: number;
  sessionState: Record<string, any>;
}

interface ResponseOption {
  id: string;
  label: string;
  description?: string;
  metadata?: Record<string, any>;
}

interface FormField {
  id: string;
  label: string;
  type: string;
  required: boolean;
  placeholder?: string;
  defaultValue?: string;
  options?: ResponseOption[];
  validation?: Record<string, any>;
}

export default function AssistantUI() {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('chat');
  const [activeConversation, setActiveConversation] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [showForm, setShowForm] = useState(false);
  const [formFields, setFormFields] = useState<FormField[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Get conversations for the current user
  const { data: conversations, isLoading: conversationsLoading } = useQuery<Conversation[]>({
    queryKey: ['/api/assistant/conversations', user?.id],
    queryFn: async () => {
      if (!user) return [];
      // Wrapping in a try/catch for better error handling
      try {
        const res = await fetch(`/api/assistant/conversations?userId=${user.id}`, { 
          method: 'GET',
          credentials: 'include'
        });
        
        if (!res.ok) {
          throw new Error(`Failed to fetch conversations: ${res.status} ${res.statusText}`);
        }
        
        return await res.json() as Conversation[];
      } catch (error) {
        console.error('Error fetching conversations:', error);
        return [];
      }
    },
    enabled: !!user
  });
  
  // Get current conversation
  const { data: conversation, isLoading: conversationLoading } = useQuery<Conversation | null>({
    queryKey: ['/api/assistant/conversations', activeConversation],
    queryFn: async () => {
      if (!activeConversation) return null;
      // Wrapping in a try/catch for better error handling
      try {
        const res = await fetch(`/api/assistant/conversations/${activeConversation}`, { 
          method: 'GET',
          credentials: 'include'
        });
        
        if (!res.ok) {
          throw new Error(`Failed to fetch conversation: ${res.status} ${res.statusText}`);
        }
        
        return await res.json() as Conversation;
      } catch (error) {
        console.error('Error fetching conversation:', error);
        return null;
      }
    },
    enabled: !!activeConversation
  });
  
  // Send message mutation
  const messageMutation = useMutation<AssistantResponse, Error, string>({
    mutationFn: async (message: string) => {
      if (!user) throw new Error('User not authenticated');
      
      const body = {
        message,
        conversationId: activeConversation
      };
      
      try {
        const res = await fetch(`/api/assistant/message?userId=${user.id}`, {
          method: 'POST',
          body: JSON.stringify(body),
          headers: {
            'Content-Type': 'application/json'
          },
          credentials: 'include'
        });
        
        if (!res.ok) {
          throw new Error(`Failed to send message: ${res.status} ${res.statusText}`);
        }
        
        return await res.json() as AssistantResponse;
      } catch (error) {
        console.error('Error sending message:', error);
        throw new Error(error instanceof Error ? error.message : 'Failed to send message');
      }
    },
    onSuccess: (response: AssistantResponse) => {
      queryClient.invalidateQueries({ queryKey: ['/api/assistant/conversations'] });
      
      if (response.conversationId && response.conversationId !== activeConversation) {
        setActiveConversation(response.conversationId);
      }
      
      // Check if response has form fields
      if (response.type === 'FORM_REQUEST' && response.formFields) {
        setFormFields(response.formFields);
        setShowForm(true);
      } else {
        setShowForm(false);
      }
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: `Failed to send message: ${error.message}`,
        variant: 'destructive'
      });
    }
  });
  
  // Submit form mutation
  const formSubmitMutation = useMutation<AssistantResponse, Error, Record<string, any>>({
    mutationFn: async (formData: Record<string, any>) => {
      if (!user || !activeConversation) throw new Error('User not authenticated or no active conversation');
      
      // Create a continue conversation request
      const request: AssistantRequest = {
        id: crypto.randomUUID(),
        userId: user.id.toString(),
        timestamp: new Date().toISOString(),
        type: 'CONVERSATION',
        parameters: formData,
        conversationId: activeConversation,
        messageSequence: conversation?.messages?.length || 0,
        sessionState: {}
      };
      
      try {
        const res = await fetch('/api/assistant/request', {
          method: 'POST',
          body: JSON.stringify(request),
          headers: {
            'Content-Type': 'application/json'
          },
          credentials: 'include'
        });
        
        if (!res.ok) {
          throw new Error(`Failed to submit form: ${res.status} ${res.statusText}`);
        }
        
        return await res.json() as AssistantResponse;
      } catch (error) {
        console.error('Error submitting form:', error);
        throw new Error(error instanceof Error ? error.message : 'Failed to submit form');
      }
    },
    onSuccess: (response: AssistantResponse) => {
      queryClient.invalidateQueries({ queryKey: ['/api/assistant/conversations'] });
      setFormData({});
      
      // Check if response still has form fields
      if (response.type === 'FORM_REQUEST' && response.formFields) {
        setFormFields(response.formFields);
        setShowForm(true);
      } else {
        setShowForm(false);
      }
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: `Failed to submit form: ${error.message}`,
        variant: 'destructive'
      });
    }
  });
  
  // Create new conversation mutation
  const newConversationMutation = useMutation<AssistantResponse, Error, void>({
    mutationFn: async () => {
      if (!user) throw new Error('User not authenticated');
      
      // Just send an empty message to create a new conversation
      try {
        const res = await fetch(`/api/assistant/message?userId=${user.id}`, {
          method: 'POST',
          body: JSON.stringify({
            message: 'Hello, I need some assistance.',
            conversationId: null
          }),
          headers: {
            'Content-Type': 'application/json'
          },
          credentials: 'include'
        });
        
        if (!res.ok) {
          throw new Error(`Failed to create conversation: ${res.status} ${res.statusText}`);
        }
        
        return await res.json() as AssistantResponse;
      } catch (error) {
        console.error('Error creating conversation:', error);
        throw new Error(error instanceof Error ? error.message : 'Failed to create conversation');
      }
    },
    onSuccess: (response: AssistantResponse) => {
      queryClient.invalidateQueries({ queryKey: ['/api/assistant/conversations'] });
      if (response.conversationId) {
        setActiveConversation(response.conversationId);
      }
      setActiveTab('chat');
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: `Failed to create new conversation: ${error.message}`,
        variant: 'destructive'
      });
    }
  });
  
  // Scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [conversation?.messages]);
  
  // Set default active conversation
  useEffect(() => {
    if (conversations && conversations.length > 0 && !activeConversation) {
      // Set most recent conversation as active
      const sortedConversations = [...conversations].sort((a, b) => 
        new Date(b.lastActivityTime).getTime() - new Date(a.lastActivityTime).getTime()
      );
      setActiveConversation(sortedConversations[0].id);
    }
  }, [conversations, activeConversation]);
  
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    
    messageMutation.mutate(message);
    setMessage('');
  };
  
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate form data
    const missingFields = formFields
      .filter(field => field.required && !formData[field.id])
      .map(field => field.label);
    
    if (missingFields.length > 0) {
      toast({
        title: 'Missing Information',
        description: `Please fill in the following fields: ${missingFields.join(', ')}`,
        variant: 'destructive'
      });
      return;
    }
    
    formSubmitMutation.mutate(formData);
  };
  
  const handleFormInputChange = (fieldId: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [fieldId]: value
    }));
  };
  
  const renderFormField = (field: FormField) => {
    switch (field.type) {
      case 'TEXT':
        return (
          <Input
            id={field.id}
            placeholder={field.placeholder || ''}
            value={formData[field.id] || ''}
            onChange={(e) => handleFormInputChange(field.id, e.target.value)}
            required={field.required}
          />
        );
      case 'SELECT':
        return (
          <Select
            onValueChange={(value) => handleFormInputChange(field.id, value)}
            defaultValue={formData[field.id] || ''}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder={field.placeholder || 'Select an option'} />
            </SelectTrigger>
            <SelectContent>
              {field.options?.map(option => (
                <SelectItem key={option.id} value={option.id}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      case 'CHECKBOX':
        return (
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id={field.id}
              checked={formData[field.id] || false}
              onChange={(e) => handleFormInputChange(field.id, e.target.checked)}
              required={field.required}
            />
            <label htmlFor={field.id}>{field.label}</label>
          </div>
        );
      default:
        return (
          <Input
            id={field.id}
            placeholder={field.placeholder || ''}
            value={formData[field.id] || ''}
            onChange={(e) => handleFormInputChange(field.id, e.target.value)}
            required={field.required}
          />
        );
    }
  };
  
  const renderMessageContent = (content: string) => {
    // Simple formatting for message content
    return content.split('\n').map((line, i) => (
      <React.Fragment key={i}>
        {line}
        {i < content.split('\n').length - 1 && <br />}
      </React.Fragment>
    ));
  };
  
  if (!user) {
    return (
      <div className="flex items-center justify-center h-full">
        <Card className="w-full max-w-md p-6">
          <div className="text-center">
            <Bot className="mx-auto h-12 w-12 text-primary" />
            <h2 className="text-xl font-semibold mt-4">AI Assistant</h2>
            <p className="text-muted-foreground mt-2">Please log in to use the AI Assistant.</p>
          </div>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto py-6 h-full flex flex-col">
      <div className="text-2xl font-semibold mb-4 flex items-center">
        <Bot className="mr-2 h-8 w-8 text-primary" />
        AI Assistant
      </div>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <TabsList>
            <TabsTrigger value="chat">Chat</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => newConversationMutation.mutate()}
            disabled={newConversationMutation.isPending}
          >
            {newConversationMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <PlusCircle className="h-4 w-4 mr-2" />
            )}
            New Conversation
          </Button>
        </div>
        
        <TabsContent value="chat" className="flex-1 flex flex-col">
          {conversationLoading || conversationsLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : !activeConversation ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <Bot className="mx-auto h-16 w-16 text-muted-foreground" />
                <h3 className="mt-4 text-lg font-medium">No Active Conversation</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Start a new conversation or select one from history.
                </p>
                <Button
                  className="mt-4"
                  onClick={() => newConversationMutation.mutate()}
                  disabled={newConversationMutation.isPending}
                >
                  {newConversationMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <PlusCircle className="h-4 w-4 mr-2" />
                  )}
                  Start New Conversation
                </Button>
              </div>
            </div>
          ) : (
            <>
              <ScrollArea className="flex-1 pr-4 mb-4">
                <div className="space-y-4">
                  {conversation?.messages?.map((msg: Message) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.source === 'USER' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-lg p-3 ${
                          msg.source === 'USER'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted'
                        }`}
                      >
                        <div className="text-sm">
                          {renderMessageContent(msg.content)}
                        </div>
                        <div className="text-xs mt-1 opacity-70">
                          {new Date(msg.timestamp).toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>
              
              {showForm ? (
                <Card className="mb-4 p-4">
                  <h3 className="font-medium mb-2">Additional Information Needed</h3>
                  <form onSubmit={handleFormSubmit} className="space-y-4">
                    {formFields.map((field) => (
                      <div key={field.id} className="space-y-2">
                        <label htmlFor={field.id} className="text-sm font-medium">
                          {field.label}
                          {field.required && <span className="text-red-500 ml-1">*</span>}
                        </label>
                        {renderFormField(field)}
                      </div>
                    ))}
                    <div className="flex justify-end space-x-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setShowForm(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        disabled={formSubmitMutation.isPending}
                      >
                        {formSubmitMutation.isPending ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <SendHorizontal className="h-4 w-4 mr-2" />
                        )}
                        Submit
                      </Button>
                    </div>
                  </form>
                </Card>
              ) : (
                <form onSubmit={handleSendMessage} className="flex space-x-2">
                  <Textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Type your message here..."
                    className="flex-1 min-h-[60px] max-h-[150px]"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        if (message.trim()) handleSendMessage(e);
                      }
                    }}
                  />
                  <Button
                    type="submit"
                    disabled={messageMutation.isPending || !message.trim()}
                    className="self-end h-[60px]"
                  >
                    {messageMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <SendHorizontal className="h-4 w-4" />
                    )}
                  </Button>
                </form>
              )}
            </>
          )}
        </TabsContent>
        
        <TabsContent value="history" className="flex-1">
          {conversationsLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : conversations?.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <History className="mx-auto h-16 w-16 text-muted-foreground" />
                <h3 className="mt-4 text-lg font-medium">No Conversation History</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Your conversation history will appear here.
                </p>
              </div>
            </div>
          ) : (
            <ScrollArea className="h-full pr-4">
              <div className="space-y-2">
                {conversations?.sort((a, b) => 
                  new Date(b.lastActivityTime).getTime() - new Date(a.lastActivityTime).getTime()
                ).map((conv) => (
                  <div
                    key={conv.id}
                    className={`p-3 rounded-md cursor-pointer hover:bg-accent ${
                      activeConversation === conv.id ? 'bg-accent' : ''
                    }`}
                    onClick={() => {
                      setActiveConversation(conv.id);
                      setActiveTab('chat');
                    }}
                  >
                    <div className="flex justify-between items-start">
                      <div className="font-medium truncate flex-1">{conv.title || 'Untitled'}</div>
                      <Badge variant="outline" className="ml-2 shrink-0">
                        {new Date(conv.lastActivityTime).toLocaleDateString()}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground mt-1 truncate">
                      {conv.messages?.[conv.messages.length - 1]?.content || 'No messages'}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}