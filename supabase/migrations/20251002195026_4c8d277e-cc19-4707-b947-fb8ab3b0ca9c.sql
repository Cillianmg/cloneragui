-- Enable realtime for chats table
ALTER TABLE public.chats REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chats;

-- Enable realtime for chat_folders table
ALTER TABLE public.chat_folders REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_folders;