import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { documentId } = await req.json();
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Get document metadata
    const { data: document, error: docError } = await supabase
      .from('rag_documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (docError) throw docError;

    // Get chunk count and stats
    const { data: chunkStats, error: statsError } = await supabase
      .from('rag_chunks')
      .select('id, content, chunk_index')
      .eq('document_id', documentId);

    if (statsError) throw statsError;

    // Calculate statistics
    const totalChunks = chunkStats?.length || 0;
    const avgChunkLength = chunkStats?.reduce((sum, chunk) => sum + chunk.content.length, 0) / totalChunks || 0;

    // Get collection info
    const { data: collection } = await supabase
      .from('rag_collections')
      .select('name')
      .eq('id', document.collection_id)
      .single();

    return new Response(
      JSON.stringify({
        document: {
          id: document.id,
          fileName: document.file_name,
          filePath: document.file_path,
          fileSize: document.file_size,
          mimeType: document.mime_type,
          status: document.status,
          errorMessage: document.error_message,
          collectionName: collection?.name,
          collectionId: document.collection_id,
          userId: document.user_id,
          createdAt: document.created_at,
          processingProgress: document.processing_progress,
        },
        vectorStats: {
          totalChunks,
          avgChunkLength: Math.round(avgChunkLength),
          embeddingDimensions: 1536, // OpenAI text-embedding-3-small
          indexType: 'HNSW',
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Document status error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
