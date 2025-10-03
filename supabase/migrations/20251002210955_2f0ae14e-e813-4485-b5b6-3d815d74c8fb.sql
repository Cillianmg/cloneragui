-- Fix search_path for cleanup function
CREATE OR REPLACE FUNCTION cleanup_deleted_document_chunks()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- When a document is soft-deleted (deleted_at is set), remove its chunks
  IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
    DELETE FROM rag_chunks WHERE document_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

-- Clean up chunks for already deleted documents
DELETE FROM rag_chunks 
WHERE document_id IN (
  SELECT id FROM rag_documents WHERE deleted_at IS NOT NULL
);