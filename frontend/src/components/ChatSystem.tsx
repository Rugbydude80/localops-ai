import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';

interface Message {
  id: number;
  conversation_id: number;
  sender_id: number;
  content: string;
  message_type: string;
  created_at: string;
  sender_name?: string;
}

interface Conversation {
  id: number;
  name: string;
  type: string;
  updated_at: string;
  unread_count?: number;
}

interface ChatSystemProps {
  currentStaffId: number;
  businessId: number;
}

export default function ChatSystem({ currentStaffId, businessId }: ChatSystemProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load conversations
  useEffect(() => {
    loadConversations();
  }, [currentStaffId, businessId]);

  // Load messages when conversation changes
  useEffect(() => {
    if (activeConversation) {
      loadMessages(activeConversation);
      markAsRead(activeConversation);
    }
  }, [activeConversation]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Real-time subscriptions
  useEffect(() => {
    if (!activeConversation) return;

    const messageSubscription = supabase
      .channel(`messages-${activeConversation}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${activeConversation}`,
        },
        (payload) => {
          const newMessage = payload.new as Message;
          setMessages(prev => [...prev, newMessage]);
        }
      )
      .subscribe();

    return () => {
      messageSubscription.unsubscribe();
    };
  }, [activeConversation]);

  const loadConversations = async () => {
    try {
      const { data, error } = await supabase
        .from('conversation_participants')
        .select(`
          conversation_id,
          conversations!inner (
            id,
            name,
            type,
            updated_at
          )
        `)
        .eq('staff_id', currentStaffId);

      if (error) throw error;

      const convos = data?.map(item => ({
        id: item.conversations.id,
        name: item.conversations.name || 'Direct Message',
        type: item.conversations.type,
        updated_at: item.conversations.updated_at,
      })) || [];

      setConversations(convos);
      if (convos.length > 0 && !activeConversation) {
        setActiveConversation(convos[0].id);
      }
    } catch (error) {
      console.error('Error loading conversations:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadMessages = async (conversationId: number) => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select(`
          *,
          staff!sender_id (name)
        `)
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
        .limit(50);

      if (error) throw error;

      const messagesWithSender = data?.map(msg => ({
        ...msg,
        sender_name: msg.staff?.name || 'Unknown'
      })) || [];

      setMessages(messagesWithSender);
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !activeConversation) return;

    try {
      const { error } = await supabase
        .from('messages')
        .insert({
          conversation_id: activeConversation,
          sender_id: currentStaffId,
          content: newMessage.trim(),
          message_type: 'text'
        });

      if (error) throw error;

      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const markAsRead = async (conversationId: number) => {
    try {
      await supabase
        .from('conversation_participants')
        .update({ last_read_at: new Date().toISOString() })
        .eq('conversation_id', conversationId)
        .eq('staff_id', currentStaffId);
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  if (isLoading) {
    return <div className="p-4">Loading chat...</div>;
  }

  return (
    <div className="flex h-96 bg-white border rounded-lg shadow">
      {/* Conversations List */}
      <div className="w-1/3 border-r bg-gray-50">
        <div className="p-3 border-b bg-gray-100">
          <h3 className="font-semibold text-gray-800">Messages</h3>
        </div>
        <div className="overflow-y-auto h-full">
          {conversations.map(conv => (
            <div
              key={conv.id}
              onClick={() => setActiveConversation(conv.id)}
              className={`p-3 border-b cursor-pointer hover:bg-gray-100 ${
                activeConversation === conv.id ? 'bg-blue-50 border-blue-200' : ''
              }`}
            >
              <div className="font-medium text-sm">{conv.name}</div>
              <div className="text-xs text-gray-500">
                {new Date(conv.updated_at).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 flex flex-col">
        {activeConversation ? (
          <>
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {messages.map(msg => (
                <div
                  key={msg.id}
                  className={`flex ${
                    msg.sender_id === currentStaffId ? 'justify-end' : 'justify-start'
                  }`}
                >
                  <div
                    className={`max-w-xs px-3 py-2 rounded-lg ${
                      msg.sender_id === currentStaffId
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-200 text-gray-800'
                    }`}
                  >
                    {msg.sender_id !== currentStaffId && (
                      <div className="text-xs font-medium mb-1">{msg.sender_name}</div>
                    )}
                    <div className="text-sm">{msg.content}</div>
                    <div className={`text-xs mt-1 ${
                      msg.sender_id === currentStaffId ? 'text-blue-100' : 'text-gray-500'
                    }`}>
                      {formatTime(msg.created_at)}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <div className="border-t p-3">
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                  placeholder="Type a message..."
                  className="flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={sendMessage}
                  disabled={!newMessage.trim()}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
                >
                  Send
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            Select a conversation to start messaging
          </div>
        )}
      </div>
    </div>
  );
}