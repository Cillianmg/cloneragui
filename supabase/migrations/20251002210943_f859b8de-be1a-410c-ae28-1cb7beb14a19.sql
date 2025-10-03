-- Create function to clean up chunks when document is deleted
CREATE OR REPLACE FUNCTION cleanup_deleted_document_chunks()
RETURNS TRIGGER AS $$
BEGIN
  -- When a document is soft-deleted (deleted_at is set), remove its chunks
  IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
    DELETE FROM rag_chunks WHERE document_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically clean up chunks on document deletion
DROP TRIGGER IF EXISTS trigger_cleanup_deleted_chunks ON rag_documents;
CREATE TRIGGER trigger_cleanup_deleted_chunks
  AFTER UPDATE ON rag_documents
  FOR EACH ROW
  EXECUTE FUNCTION cleanup_deleted_document_chunks();

-- Update the match_rag_chunks function to exclude deleted documents
CREATE OR REPLACE FUNCTION match_rag_chunks(
  query_embedding vector,
  match_threshold double precision,
  match_count integer,
  collection_ids uuid[]
)
RETURNS TABLE(
  id uuid,
  content text,
  collection_id uuid,
  document_id uuid,
  chunk_index integer,
  similarity double precision
)
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    rag_chunks.id,
    rag_chunks.content,
    rag_chunks.collection_id,
    rag_chunks.document_id,
    rag_chunks.chunk_index,
    1 - (rag_chunks.embedding <=> query_embedding) AS similarity
  FROM rag_chunks
  INNER JOIN rag_documents ON rag_documents.id = rag_chunks.document_id
  WHERE 
    rag_chunks.collection_id = ANY(collection_ids)
    AND rag_documents.deleted_at IS NULL
    AND 1 - (rag_chunks.embedding <=> query_embedding) > match_threshold
  ORDER BY rag_chunks.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;