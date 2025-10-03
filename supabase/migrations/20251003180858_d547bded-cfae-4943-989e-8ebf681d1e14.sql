-- Create web search providers table
CREATE TABLE public.web_search_providers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  provider_name TEXT NOT NULL CHECK (provider_name IN ('brave', 'serper', 'tavily', 'custom')),
  display_name TEXT NOT NULL,
  api_key TEXT NOT NULL,
  base_url TEXT, -- For custom provider
  is_enabled BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.web_search_providers ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can manage their own search providers"
  ON public.web_search_providers
  FOR ALL
  USING (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX idx_web_search_providers_user_id ON public.web_search_providers(user_id);
CREATE INDEX idx_web_search_providers_default ON public.web_search_providers(user_id, is_default) WHERE is_default = true;