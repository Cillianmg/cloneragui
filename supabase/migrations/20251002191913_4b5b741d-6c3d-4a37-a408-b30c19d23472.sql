-- Create function to match RAG chunks using vector similarity
CREATE OR REPLACE FUNCTION match_rag_chunks(
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  collection_ids uuid[]
)
RETURNS TABLE (
  id uuid,
  content text,
  collection_id uuid,
  document_id uuid,
  chunk_index int,
  similarity float
)
LANGUAGE plpgsql
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
  WHERE 
    rag_chunks.collection_id = ANY(collection_ids)
    AND 1 - (rag_chunks.embedding <=> query_embedding) > match_threshold
  ORDER BY rag_chunks.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;