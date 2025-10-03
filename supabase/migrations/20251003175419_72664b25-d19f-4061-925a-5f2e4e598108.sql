-- Attach the cleanup trigger to rag_documents table
CREATE TRIGGER cleanup_deleted_chunks
  AFTER UPDATE ON rag_documents
  FOR EACH ROW
  EXECUTE FUNCTION cleanup_deleted_document_chunks();

-- Also clean up any existing orphaned chunks from previously deleted documents
DELETE FROM rag_chunks
WHERE document_id IN (
  SELECT id FROM rag_documents WHERE deleted_at IS NOT NULL
);