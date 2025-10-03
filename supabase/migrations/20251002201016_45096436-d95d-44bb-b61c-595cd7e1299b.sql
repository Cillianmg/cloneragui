-- Add deleted_at column to rag_documents for soft delete
ALTER TABLE public.rag_documents ADD COLUMN deleted_at timestamp with time zone;

-- Add original_collection_id to track where deleted documents came from
ALTER TABLE public.rag_documents ADD COLUMN original_collection_id uuid;

-- Create index for faster queries on deleted documents
CREATE INDEX idx_rag_documents_deleted_at ON public.rag_documents(deleted_at) WHERE deleted_at IS NOT NULL;