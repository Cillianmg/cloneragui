-- Create table for API provider configurations
CREATE TABLE public.api_providers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  provider_name text NOT NULL,
  display_name text NOT NULL,
  api_key text,
  base_url text,
  model_id text NOT NULL,
  is_default boolean DEFAULT false,
  is_enabled boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.api_providers ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can manage their own providers"
ON public.api_providers
FOR ALL
USING (auth.uid() = user_id);

-- Add provider_id to chats table to track which provider was used
ALTER TABLE public.chats
ADD COLUMN provider_id uuid REFERENCES public.api_providers(id);

-- Create trigger for updated_at
CREATE TRIGGER update_api_providers_updated_at
BEFORE UPDATE ON public.api_providers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();