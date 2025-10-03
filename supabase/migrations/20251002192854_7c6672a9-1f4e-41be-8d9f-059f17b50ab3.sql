-- Add chat management columns
ALTER TABLE public.chats 
ADD COLUMN is_pinned boolean DEFAULT false,
ADD COLUMN is_archived boolean DEFAULT false,
ADD COLUMN archived_at timestamp with time zone,
ADD COLUMN folder_id uuid;

-- Create chat folders table
CREATE TABLE public.chat_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on chat_folders
ALTER TABLE public.chat_folders ENABLE ROW LEVEL SECURITY;

-- Create policies for chat_folders
CREATE POLICY "Users can manage their own folders"
ON public.chat_folders
FOR ALL
USING (auth.uid() = user_id);

-- Add foreign key for folder_id
ALTER TABLE public.chats
ADD CONSTRAINT chats_folder_id_fkey 
FOREIGN KEY (folder_id) 
REFERENCES public.chat_folders(id) 
ON DELETE SET NULL;

-- Add trigger for folder updated_at
CREATE TRIGGER update_chat_folders_updated_at
BEFORE UPDATE ON public.chat_folders
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();