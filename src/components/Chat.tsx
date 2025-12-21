import { useState, useEffect, useRef, useCallback, type FC } from 'react';
import { Send, Paperclip, Check, CheckCheck, Clock, MessageSquare } from 'lucide-react';
import { getAuthenticatedSupabase, supabase } from '../lib/supabase';
import { config } from '../config';

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  attachment_url?: string | null;
  attachment_type?: string | null;
  sender?: {
    name: string;
    role: string;
  };
  receipts?: MessageReceipt[];
}

interface MessageReceipt {
  user_id: string;
  recipient_name: string;
  delivered_at: string | null;
  read_at: string | null;
  status: 'sent' | 'delivered' | 'read';
}

interface Conversation {
  id: string;
  work_order_id: string;
  work_order_title?: string;
  last_message_at: string | null;
  last_message_preview: string | null;
  updated_at: string;
}

interface Participant {
  user_id: string;
  name: string;
  role: string;
  is_online?: boolean;
  last_seen?: string;
}

export interface ChatProps {
  workOrderId?: string | null;
  conversationId?: string | null;
}

const Chat: FC<ChatProps> = ({ workOrderId, conversationId: initialConversationId }) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(initialConversationId || null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageInputRef = useRef<HTMLTextAreaElement>(null);

  // Get current user ID
  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
      }
    };
    getCurrentUser();
  }, []);

  // Set user online status when component mounts and update last_seen periodically
  useEffect(() => {
    if (!currentUserId) return;

    const supabaseClient = getAuthenticatedSupabase();
    
    // Set user as online
    const setOnline = async () => {
      try {
        const { data: userData } = await supabaseClient.auth.getUser();
        if (!userData.user) return;

        const { data: userProfile } = await supabaseClient
          .from('users')
          .select('role')
          .eq('id', currentUserId)
          .single();

        // Only track online status for tenants and technicians
        if (userProfile?.role === 'tenant' || userProfile?.role === 'technician') {
          await supabaseClient
            .from('users')
            .update({ 
              is_online: true,
              last_seen: new Date().toISOString()
            })
            .eq('id', currentUserId);
        }
      } catch (error) {
        console.error('Error setting user online:', error);
      }
    };

    setOnline();

    // Update last_seen every 30 seconds while user is active
    const lastSeenInterval = setInterval(async () => {
      try {
        const { data: userData } = await supabaseClient.auth.getUser();
        if (!userData.user) return;

        const { data: userProfile } = await supabaseClient
          .from('users')
          .select('role, is_online')
          .eq('id', currentUserId)
          .single();

        // Only update if user is still marked as online (tenant or technician)
        if (userProfile?.is_online && (userProfile?.role === 'tenant' || userProfile?.role === 'technician')) {
          await supabaseClient
            .from('users')
            .update({ last_seen: new Date().toISOString() })
            .eq('id', currentUserId);
        }
      } catch (error) {
        console.error('Error updating last_seen:', error);
      }
    }, 30000); // Update every 30 seconds

    // Set user as offline when component unmounts
    return () => {
      clearInterval(lastSeenInterval);
      
      const setOffline = async () => {
        try {
          const { data: userData } = await supabaseClient.auth.getUser();
          if (!userData.user) return;

          const { data: userProfile } = await supabaseClient
            .from('users')
            .select('role')
            .eq('id', currentUserId)
            .single();

          // Only update offline status for tenants and technicians
          if (userProfile?.role === 'tenant' || userProfile?.role === 'technician') {
            await supabaseClient
              .from('users')
              .update({ 
                is_online: false,
                last_seen: new Date().toISOString()
              })
              .eq('id', currentUserId);
          }
        } catch (error) {
          console.error('Error setting user offline:', error);
        }
      };

      setOffline();
    };
  }, [currentUserId]);

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Fetch conversations for current user
  const fetchConversations = useCallback(async () => {
    if (!currentUserId) return;

    try {
      setLoading(true);
      const supabaseClient = getAuthenticatedSupabase();

      // Get conversations where user is a participant
      const { data: conversationsData, error: conversationsError } = await supabaseClient
        .from('conversation_participants')
        .select(`
          conversation_id,
          conversations (
            id,
            work_order_id,
            last_message_at,
            last_message_preview,
            updated_at,
            work_orders (
              title
            )
          )
        `)
        .eq('user_id', currentUserId)
        .order('conversations(updated_at)', { ascending: false });

      if (conversationsError) {
        console.error('Error fetching conversations:', conversationsError);
        return;
      }

      const formattedConversations: Conversation[] = (conversationsData || []).map((item: any) => ({
        id: item.conversations.id,
        work_order_id: item.conversations.work_order_id,
        work_order_title: item.conversations.work_orders?.title || 'Untitled Work Order',
        last_message_at: item.conversations.last_message_at,
        last_message_preview: item.conversations.last_message_preview,
        updated_at: item.conversations.updated_at,
      }));

      setConversations(formattedConversations);

      // If workOrderId is provided, find or create conversation
      if (workOrderId && !selectedConversationId) {
        const existingConversation = formattedConversations.find(
          (c) => c.work_order_id === workOrderId
        );

        if (existingConversation) {
          setSelectedConversationId(existingConversation.id);
        } else {
          // Create new conversation for this work order
          try {
            const { data: newConversationId, error: createError } = await supabaseClient
              .rpc('create_conversation_participants', { p_work_order_id: workOrderId });

            if (createError) {
              console.error('Error creating conversation:', createError);
            } else if (newConversationId) {
              setSelectedConversationId(newConversationId);
              // Refresh conversations list
              fetchConversations();
            }
          } catch (error) {
            console.error('Error calling create_conversation_participants:', error);
          }
        }
      }
    } catch (error) {
      console.error('Error in fetchConversations:', error);
    } finally {
      setLoading(false);
    }
  }, [currentUserId, workOrderId, selectedConversationId]);

  // Fetch messages for selected conversation
  const fetchMessages = useCallback(async (convId: string) => {
    if (!convId) return;

    try {
      const supabaseClient = getAuthenticatedSupabase();

      // Fetch messages
      const { data: messagesData, error: messagesError } = await supabaseClient
        .from('messages')
        .select(`
          id,
          conversation_id,
          sender_id,
          content,
          created_at,
          attachment_url,
          attachment_type,
          sender:users!sender_id (
            name,
            role
          )
        `)
        .eq('conversation_id', convId)
        .order('created_at', { ascending: true });

      if (messagesError) {
        console.error('Error fetching messages:', messagesError);
        return;
      }

      // Fetch receipts for all messages
      const messageIds = (messagesData || []).map((m: any) => m.id);
      let receiptsMap: Record<string, MessageReceipt[]> = {};

      if (messageIds.length > 0) {
        const { data: receiptsData, error: receiptsError } = await supabaseClient
          .from('message_receipts')
          .select(`
            message_id,
            user_id,
            delivered_at,
            read_at,
            recipient:users!user_id (
              name
            )
          `)
          .in('message_id', messageIds);

        if (!receiptsError && receiptsData) {
          receiptsMap = receiptsData.reduce((acc: Record<string, MessageReceipt[]>, receipt: any) => {
            if (!acc[receipt.message_id]) {
              acc[receipt.message_id] = [];
            }
            acc[receipt.message_id].push({
              user_id: receipt.user_id,
              recipient_name: receipt.recipient?.name || 'Unknown',
              delivered_at: receipt.delivered_at,
              read_at: receipt.read_at,
              status: receipt.read_at
                ? 'read'
                : receipt.delivered_at
                ? 'delivered'
                : 'sent',
            });
            return acc;
          }, {});
        }
      }

      // Format messages with sender info and receipts
      const formattedMessages: Message[] = (messagesData || []).map((msg: any) => ({
        id: msg.id,
        conversation_id: msg.conversation_id,
        sender_id: msg.sender_id,
        content: msg.content,
        created_at: msg.created_at,
        attachment_url: msg.attachment_url,
        attachment_type: msg.attachment_type,
        sender: {
          name: msg.sender?.name || 'Unknown',
          role: msg.sender?.role || 'unknown',
        },
        receipts: receiptsMap[msg.id] || [],
      }));

      setMessages(formattedMessages);

      // Mark messages as delivered (if user is online)
      const unreadMessages = formattedMessages.filter(
        (m) => m.sender_id !== currentUserId && !m.receipts?.some((r) => r.user_id === currentUserId && r.delivered_at)
      );

      if (unreadMessages.length > 0 && currentUserId) {
        const messageIdsToMark = unreadMessages.map((m) => m.id);
        await supabaseClient
          .from('message_receipts')
          .update({ delivered_at: new Date().toISOString() })
          .in('message_id', messageIdsToMark)
          .eq('user_id', currentUserId)
          .is('delivered_at', null);
      }
    } catch (error) {
      console.error('Error in fetchMessages:', error);
    }
  }, [currentUserId]);

  // Fetch participants for selected conversation
  const fetchParticipants = useCallback(async (convId: string) => {
    if (!convId) return;

    try {
      const supabaseClient = getAuthenticatedSupabase();

      const { data: participantsData, error: participantsError } = await supabaseClient
        .from('conversation_participants')
        .select(`
          user_id,
          role,
          user:users!user_id (
            name,
            role,
            is_online,
            last_seen
          )
        `)
        .eq('conversation_id', convId);

      if (participantsError) {
        console.error('Error fetching participants:', participantsError);
        return;
      }

      const formattedParticipants: Participant[] = (participantsData || []).map((p: any) => ({
        user_id: p.user_id,
        name: p.user?.name || 'Unknown',
        role: p.user?.role || p.role,
        is_online: p.user?.is_online ?? false,
        last_seen: p.user?.last_seen || null,
      }));

      setParticipants(formattedParticipants);
    } catch (error) {
      console.error('Error in fetchParticipants:', error);
    }
  }, []);

  // Load conversations on mount and when currentUserId changes
  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Load messages and participants when conversation is selected
  useEffect(() => {
    if (selectedConversationId) {
      fetchMessages(selectedConversationId);
      fetchParticipants(selectedConversationId);
    } else {
      setMessages([]);
      setParticipants([]);
    }
  }, [selectedConversationId, fetchMessages, fetchParticipants]);

  // ============================================
  // REALTIME SUBSCRIPTIONS (WebSocket)
  // ============================================

  useEffect(() => {
    if (!selectedConversationId || !currentUserId) return;

    console.log('Setting up Realtime subscription for conversation:', selectedConversationId);

    // Subscribe to new messages in this conversation
    const messagesChannel = supabase
      .channel(`messages-${selectedConversationId}`, {
        config: {
          broadcast: { self: true },
        },
      })
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${selectedConversationId}`,
        },
        async (payload) => {
          console.log('New message received via WebSocket:', payload.new);

          // Fetch the new message with sender info
          const supabaseClient = getAuthenticatedSupabase();
          const { data: newMessageData, error } = await supabaseClient
            .from('messages')
            .select(`
              id,
              conversation_id,
              sender_id,
              content,
              created_at,
              attachment_url,
              attachment_type,
              sender:users!sender_id (
                name,
                role
              )
            `)
            .eq('id', payload.new.id)
            .single();

          if (!error && newMessageData) {
            const newMessage: Message = {
              id: newMessageData.id,
              conversation_id: newMessageData.conversation_id,
              sender_id: newMessageData.sender_id,
              content: newMessageData.content,
              created_at: newMessageData.created_at,
              attachment_url: newMessageData.attachment_url,
              attachment_type: newMessageData.attachment_type,
              sender: {
                name: newMessageData.sender?.name || 'Unknown',
                role: newMessageData.sender?.role || 'unknown',
              },
              receipts: [],
            };

            setMessages((prev) => [...prev, newMessage]);

            // Auto-mark as delivered if user is online
            if (newMessage.sender_id !== currentUserId) {
              await supabaseClient
                .from('message_receipts')
                .update({ delivered_at: new Date().toISOString() })
                .eq('message_id', newMessage.id)
                .eq('user_id', currentUserId)
                .is('delivered_at', null);
            }
          }

          // Refresh conversations list to update last_message_preview
          fetchConversations();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'message_receipts',
        },
        (payload) => {
          console.log('Receipt updated via WebSocket:', payload.new);

          // Update receipt status in messages
          setMessages((prev) =>
            prev.map((msg) => {
              if (msg.id === payload.new.message_id) {
                const updatedReceipts = msg.receipts?.map((r) =>
                  r.user_id === payload.new.user_id
                    ? {
                        ...r,
                        delivered_at: payload.new.delivered_at,
                        read_at: payload.new.read_at,
                        status: payload.new.read_at
                          ? 'read'
                          : payload.new.delivered_at
                          ? 'delivered'
                          : 'sent',
                      }
                    : r
                ) || [];

                return {
                  ...msg,
                  receipts: updatedReceipts,
                };
              }
              return msg;
            })
          );
        }
      )
      .subscribe((status) => {
        console.log('Realtime subscription status:', status);
        if (status === 'SUBSCRIBED') {
          console.log('✓ Successfully subscribed to real-time messages');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('✗ Failed to subscribe to real-time messages - Channel error');
        } else if (status === 'TIMED_OUT') {
          console.error('✗ Failed to subscribe to real-time messages - Timeout');
        } else if (status === 'CLOSED') {
          console.warn('⚠ Realtime subscription closed');
        }
      });

    return () => {
      console.log('Cleaning up Realtime subscription for conversation:', selectedConversationId);
      messagesChannel.unsubscribe();
    };
  }, [selectedConversationId, currentUserId, fetchConversations]);

  // Subscribe to conversation updates (for last_message_preview changes)
  useEffect(() => {
    if (!currentUserId) return;

    const conversationsChannel = supabase
      .channel('conversations-list')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'conversations',
        },
        () => {
          // Refresh conversations list when any conversation is updated
          fetchConversations();
        }
      )
      .subscribe();

    return () => {
      conversationsChannel.unsubscribe();
    };
  }, [currentUserId, fetchConversations]);

  // Subscribe to online status changes for participants
  useEffect(() => {
    if (!selectedConversationId || participants.length === 0) return;

    const participantIds = participants.map((p) => p.user_id);
    if (participantIds.length === 0) return;
    
    // Subscribe to updates for each participant individually
    // (Supabase Realtime doesn't support IN filters easily, so we subscribe to all participant IDs)
    const onlineStatusChannel = supabase
      .channel(`online-status-${selectedConversationId}`);

    participantIds.forEach((userId) => {
      onlineStatusChannel.on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'users',
          filter: `id=eq.${userId}`,
        },
        (payload) => {
          console.log('Online status updated for user:', userId, payload.new);
          // Update participant online status in state
          setParticipants((prev) =>
            prev.map((p) =>
              p.user_id === payload.new.id
                ? {
                    ...p,
                    is_online: payload.new.is_online ?? false,
                    last_seen: payload.new.last_seen || p.last_seen,
                  }
                : p
            )
          );
        }
      );
    });

    onlineStatusChannel.subscribe();

    return () => {
      onlineStatusChannel.unsubscribe();
    };
  }, [selectedConversationId, participants]);

  // ============================================
  // SEND MESSAGE
  // ============================================

  const sendMessage = useCallback(async () => {
    if (!newMessage.trim() || !selectedConversationId || !currentUserId || sending) return;

    try {
      setSending(true);
      const supabaseClient = getAuthenticatedSupabase();

      const { data: messageData, error: messageError } = await supabaseClient
        .from('messages')
        .insert({
          conversation_id: selectedConversationId,
          sender_id: currentUserId,
          content: newMessage.trim(),
        })
        .select()
        .single();

      if (messageError) {
        console.error('Error sending message:', messageError);
        alert('Failed to send message. Please try again.');
        return;
      }

      // Save message content before clearing input
      const messageContent = newMessage.trim();

      // Clear input
      setNewMessage('');

      // Send email notification to recipient (non-blocking)
      if (messageData) {
        try {
          console.log('Attempting to send notification for message:', {
            conversation_id: selectedConversationId,
            sender_id: currentUserId,
            message_content_length: messageContent.length
          })
          
          const { data: { session } } = await supabaseClient.auth.getSession()
          if (session?.access_token) {
            console.log('Session found, calling notify-message function...')
            
            // Call notify-message Edge Function
            const notifyResponse = await fetch(
              `${config.supabase.url}/functions/v1/notify-message`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${session.access_token}`,
                  'apikey': config.supabase.anonKey,
                },
                body: JSON.stringify({
                  conversation_id: selectedConversationId,
                  sender_id: currentUserId,
                  message_content: messageContent,
                }),
              }
            )

            console.log('Notification response status:', notifyResponse.status)
            
            if (!notifyResponse.ok) {
              const errorText = await notifyResponse.text()
              console.warn('Failed to send message notification email:', {
                status: notifyResponse.status,
                error: errorText
              })
              // Don't fail the message send if notification fails
            } else {
              const responseData = await notifyResponse.json().catch(() => ({}))
              console.log('Notification sent successfully:', responseData)
            }
          } else {
            console.warn('No session found, cannot send notification')
          }
        } catch (notifyError) {
          console.error('Error calling notify-message function:', notifyError)
          // Don't fail the message send if notification fails
        }

        // Fetch sender info
        const { data: senderData } = await supabaseClient
          .from('users')
          .select('name, role')
          .eq('id', currentUserId)
          .single();

        const newMessage: Message = {
          id: messageData.id,
          conversation_id: messageData.conversation_id,
          sender_id: messageData.sender_id,
          content: messageData.content,
          created_at: messageData.created_at,
          sender: {
            name: senderData?.name || 'You',
            role: senderData?.role || 'unknown',
          },
          receipts: [],
        };

        setMessages((prev) => [...prev, newMessage]);
      }
    } catch (error) {
      console.error('Error in sendMessage:', error);
      alert('Failed to send message. Please try again.');
    } finally {
      setSending(false);
    }
  }, [newMessage, selectedConversationId, currentUserId, sending]);

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // ============================================
  // MARK MESSAGE AS READ
  // ============================================

  const markMessageAsRead = useCallback(
    async (messageId: string) => {
      if (!currentUserId) return;

      try {
        const supabaseClient = getAuthenticatedSupabase();
        await supabaseClient
          .from('message_receipts')
          .update({ read_at: new Date().toISOString() })
          .eq('message_id', messageId)
          .eq('user_id', currentUserId)
          .is('read_at', null);
      } catch (error) {
        console.error('Error marking message as read:', error);
      }
    },
    [currentUserId]
  );

  // Mark messages as read when they're visible
  useEffect(() => {
    if (!selectedConversationId || !currentUserId) return;

    // Mark all unread messages as read
    const unreadMessages = messages.filter(
      (m) => m.sender_id !== currentUserId && !m.receipts?.some((r) => r.user_id === currentUserId && r.read_at)
    );

    unreadMessages.forEach((msg) => {
      markMessageAsRead(msg.id);
    });
  }, [messages, selectedConversationId, currentUserId, markMessageAsRead]);

  // ============================================
  // RENDER
  // ============================================

  const getReceiptIcon = (receipts: MessageReceipt[] | undefined, senderId: string) => {
    if (!receipts || receipts.length === 0 || senderId !== currentUserId) return null;

    const allRead = receipts.every((r) => r.status === 'read');
    const allDelivered = receipts.every((r) => r.status === 'delivered' || r.status === 'read');
    const anyDelivered = receipts.some((r) => r.status === 'delivered' || r.status === 'read');

    if (allRead) {
      return <CheckCheck className="w-3 h-3 text-blue-500" />;
    } else if (allDelivered) {
      return <CheckCheck className="w-3 h-3 text-gray-400" />;
    } else if (anyDelivered) {
      return <Check className="w-3 h-3 text-gray-400" />;
    }
    return <Clock className="w-3 h-3 text-gray-300" />;
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return date.toLocaleDateString();
  };

  if (loading && conversations.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500">Loading conversations...</div>
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500">
        <MessageSquare className="w-16 h-16 mb-4 text-gray-300" />
        <p className="text-lg font-medium">No conversations yet</p>
        <p className="text-sm mt-2">Start a conversation from a work order</p>
      </div>
    );
  }

  const selectedConversation = conversations.find((c) => c.id === selectedConversationId);

  return (
    <div className="flex h-full bg-white">
      {/* Conversations List */}
      <div className="w-1/3 border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Conversations</h2>
        </div>
        <div className="flex-1 overflow-y-auto">
          {conversations.map((conv) => (
            <button
              key={conv.id}
              onClick={() => setSelectedConversationId(conv.id)}
              className={`w-full text-left p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                selectedConversationId === conv.id ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
              }`}
            >
              <div className="font-medium text-gray-900">{conv.work_order_title}</div>
              {conv.last_message_preview && (
                <div className="text-sm text-gray-500 mt-1 truncate">{conv.last_message_preview}</div>
              )}
              {conv.last_message_at && (
                <div className="text-xs text-gray-400 mt-1">{formatTime(conv.last_message_at)}</div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {selectedConversationId ? (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                {selectedConversation?.work_order_title || 'Chat'}
              </h3>
              <div className="text-sm text-gray-500 mt-1">
                {participants.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2">
                    {participants.map((p) => {
                      // Only show online status for tenants and technicians
                      const showOnlineStatus = p.role === 'tenant' || p.role === 'technician';
                      const isOnline = p.is_online ?? false;
                      
                      return (
                        <span key={p.user_id} className="flex items-center gap-1">
                          <span>{p.name}</span>
                          {showOnlineStatus && (
                            <span
                              className={`inline-block w-2 h-2 rounded-full ${
                                isOnline ? 'bg-green-500' : 'bg-gray-400'
                              }`}
                              title={isOnline ? 'Online' : `Last seen: ${p.last_seen ? formatTime(p.last_seen) : 'Unknown'}`}
                            />
                          )}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((message) => {
                const isOwnMessage = message.sender_id === currentUserId;
                return (
                  <div
                    key={message.id}
                    className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[70%] rounded-lg px-4 py-2 ${
                        isOwnMessage
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-100 text-gray-900'
                      }`}
                    >
                      {!isOwnMessage && (
                        <div className="text-xs font-medium mb-1 opacity-75">
                          {message.sender?.name}
                        </div>
                      )}
                      <div className="text-sm whitespace-pre-wrap">{message.content}</div>
                      <div
                        className={`text-xs mt-1 flex items-center gap-1 ${
                          isOwnMessage ? 'text-blue-100' : 'text-gray-500'
                        }`}
                      >
                        {formatTime(message.created_at)}
                        {isOwnMessage && getReceiptIcon(message.receipts, message.sender_id)}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <div className="p-4 border-t border-gray-200">
              <div className="flex items-end gap-2">
                <button
                  className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
                  title="Attach file (coming soon)"
                >
                  <Paperclip className="w-5 h-5" />
                </button>
                <textarea
                  ref={messageInputRef}
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Type a message..."
                  rows={2}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
                <button
                  onClick={sendMessage}
                  disabled={!newMessage.trim() || sending}
                  className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  {sending ? 'Sending...' : 'Send'}
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            Select a conversation to start chatting
          </div>
        )}
      </div>
    </div>
  );
};

export default Chat;

