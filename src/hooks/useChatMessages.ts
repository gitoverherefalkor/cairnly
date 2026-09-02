// Hook for managing chat messages with local state + Supabase persistence
// Messages render from local state for instant UI, persisted to Supabase in background

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ChatMessage {
  id: string;
  session_id: string;
  report_id: string;
  user_id: string;
  sender: 'user' | 'bot';
  content: string;
  created_at: string;
  // Provenance, e.g. { quick_reply: 'differently' } when the turn was typed
  // after clicking a focus-type quick-reply pill. Renders as a small label.
  metadata?: { quick_reply?: string } | null;
}

interface UseChatMessagesOptions {
  sessionId: string | null;
  reportId: string;
  userId: string;
}

export function useChatMessages({ sessionId, reportId, userId }: UseChatMessagesOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const loadedRef = useRef(false);

  // Load messages from Supabase on mount / session change
  useEffect(() => {
    if (!sessionId || !reportId || !userId) {
      setIsLoading(false);
      return;
    }

    // Prevent double-loading
    if (loadedRef.current) return;
    loadedRef.current = true;

    const loadMessages = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('chat_messages')
          .select('*')
          .eq('session_id', sessionId)
          .order('created_at', { ascending: true });

        if (error) {
          console.error('Failed to load chat messages:', error);
        } else if (data && data.length > 0) {
          setMessages(data as ChatMessage[]);
        }
      } catch (err) {
        console.error('Error loading messages:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadMessages();
  }, [sessionId, reportId, userId]);

  // Add a message to local state and persist to Supabase.
  // Pass `{ skipPersist: true }` when the message has already been written
  // server-side (e.g. by the deliver-section edge function). Local state is
  // still updated so the user sees the message immediately. This avoids the
  // race where a user refreshes mid-flight and loses an unpersisted bot
  // message, since the server-side write is atomic with the API response.
  const addMessage = useCallback(
    (
      sender: 'user' | 'bot',
      content: string,
      options?: { skipPersist?: boolean; metadata?: ChatMessage['metadata'] },
    ): string | null => {
      if (!sessionId || !reportId || !userId) return null;

      const now = new Date().toISOString();
      const tempId = crypto.randomUUID();

      const newMessage: ChatMessage = {
        id: tempId,
        session_id: sessionId,
        report_id: reportId,
        user_id: userId,
        sender,
        content,
        created_at: now,
        metadata: options?.metadata ?? null,
      };

      // Add to local state immediately
      setMessages((prev) => [...prev, newMessage]);

      if (!options?.skipPersist) {
        // Persist to Supabase in background (fire-and-forget)
        supabase
          .from('chat_messages')
          .insert({
            session_id: sessionId,
            report_id: reportId,
            user_id: userId,
            sender,
            content,
            metadata: options?.metadata ?? null,
          })
          .then(({ error }) => {
            if (error) {
              console.error('Failed to persist message:', error);
            }
          });
      }

      // Returned so callers (e.g. ChatContainer's send-failure handling)
      // can remember which message just got added and offer retry
      // affordances against that specific row.
      return tempId;
    },
    [sessionId, reportId, userId]
  );

  // Seed messages from n8n previous session (migration path)
  const seedFromHistory = useCallback(
    (history: Array<{ sender: 'user' | 'bot'; content: string }>) => {
      if (!sessionId || !reportId || !userId || history.length === 0) return;

      const seeded: ChatMessage[] = history.map((msg, i) => ({
        id: crypto.randomUUID(),
        session_id: sessionId,
        report_id: reportId,
        user_id: userId,
        sender: msg.sender,
        content: msg.content,
        created_at: new Date(Date.now() + i).toISOString(), // preserve order
      }));

      setMessages(seeded);

      // Persist all to Supabase in background
      const rows = seeded.map((m) => ({
        session_id: m.session_id,
        report_id: m.report_id,
        user_id: m.user_id,
        sender: m.sender,
        content: m.content,
      }));

      supabase
        .from('chat_messages')
        .insert(rows)
        .then(({ error }) => {
          if (error) console.error('Failed to seed messages:', error);
        });
    },
    [sessionId, reportId, userId]
  );

  // Reset for new sessions
  const clearMessages = useCallback(() => {
    setMessages([]);
    loadedRef.current = false;
  }, []);

  return {
    messages,
    isLoading,
    addMessage,
    seedFromHistory,
    clearMessages,
    hasMessages: messages.length > 0,
  };
}
