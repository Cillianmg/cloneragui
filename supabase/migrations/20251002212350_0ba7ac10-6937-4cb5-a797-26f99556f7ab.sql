-- Create table for global RAG settings
CREATE TABLE IF NOT EXISTS public.rag_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chunk_size integer NOT NULL DEFAULT 800,
  chunk_overlap integer NOT NULL DEFAULT 100,
  top_k_results integer NOT NULL DEFAULT 10,
  match_threshold numeric NOT NULL DEFAULT 0.2,
  embedding_model text NOT NULL DEFAULT 'text-embedding-3-small',
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.rag_settings ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own RAG settings"
  ON public.rag_settings
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own RAG settings"
  ON public.rag_settings
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own RAG settings"
  ON public.rag_settings
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_rag_settings_updated_at
  BEFORE UPDATE ON public.rag_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();