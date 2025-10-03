-- Add processing_progress column to track detailed processing steps
ALTER TABLE public.rag_documents ADD COLUMN processing_progress jsonb DEFAULT '{"steps": [], "currentStep": "", "progress": 0, "eta": null}'::jsonb;

-- Enable realtime for rag_documents so we can stream progress updates
ALTER TABLE public.rag_documents REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.rag_documents;