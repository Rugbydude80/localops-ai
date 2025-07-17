-- Add chat system tables to existing database
-- Run this in your Supabase SQL Editor

-- Create conversations table (for group chats, direct messages)
CREATE TABLE IF NOT EXISTS public.conversations (
  id SERIAL PRIMARY KEY,
  business_id INTEGER REFERENCES public.businesses(id) ON DELETE CASCADE,
  name VARCHAR(255), -- null for direct messages, named for group chats
  type VARCHAR(20) DEFAULT 'direct', -- 'direct', 'group', 'announcement'
  created_by INTEGER REFERENCES public.staff(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create conversation participants table
CREATE TABLE IF NOT EXISTS public.conversation_participants (
  id SERIAL PRIMARY KEY,
  conversation_id INTEGER REFERENCES public.conversations(id) ON DELETE CASCADE,
  staff_id INTEGER REFERENCES public.staff(id) ON DELETE CASCADE,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_read_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(conversation_id, staff_id)
);

-- Create messages table
CREATE TABLE IF NOT EXISTS public.messages (
  id SERIAL PRIMARY KEY,
  conversation_id INTEGER REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id INTEGER REFERENCES public.staff(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  message_type VARCHAR(20) DEFAULT 'text', -- 'text', 'shift_update', 'system', 'file'
  metadata JSONB DEFAULT '{}'::jsonb, -- for shift IDs, file info, etc.
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  edited_at TIMESTAMP WITH TIME ZONE,
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- Create message reactions table (optional - for emoji reactions)
CREATE TABLE IF NOT EXISTS public.message_reactions (
  id SERIAL PRIMARY KEY,
  message_id INTEGER REFERENCES public.messages(id) ON DELETE CASCADE,
  staff_id INTEGER REFERENCES public.staff(id) ON DELETE CASCADE,
  emoji VARCHAR(10) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(message_id, staff_id, emoji)
);

-- Disable RLS for demo
ALTER TABLE public.conversations DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_participants DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_reactions DISABLE ROW LEVEL SECURITY;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created ON public.messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversation_participants_staff ON public.conversation_participants(staff_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON public.messages(sender_id);

-- Create a function to update conversation updated_at when new message is added
CREATE OR REPLACE FUNCTION update_conversation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.conversations 
  SET updated_at = NOW() 
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_update_conversation_timestamp ON public.messages;
CREATE TRIGGER trigger_update_conversation_timestamp
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION update_conversation_timestamp();