-- Create table for embedding providers
CREATE TABLE IF NOT EXISTS public.embedding_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider_name text NOT NULL,
  display_name text NOT NULL,
  api_key text NOT NULL,
  base_url text NOT NULL,
  model_id text NOT NULL,
  is_default boolean DEFAULT false,
  is_enabled boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.embedding_providers ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can manage their own embedding providers"
  ON public.embedding_providers
  FOR ALL
  USING (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_embedding_providers_updated_at
  BEFORE UPDATE ON public.embedding_providers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert default OpenAI provider for existing users with RAG settings
INSERT INTO public.embedding_providers (user_id, provider_name, display_name, api_key, base_url, model_id, is_default, is_enabled)
SELECT 
  user_id,
  'openai',
  'OpenAI',
  '', -- Will need to be set by user
  'https://api.openai.com/v1',
  embedding_model,
  true,
  true
FROM public.rag_settings
ON CONFLICT DO NOTHING;