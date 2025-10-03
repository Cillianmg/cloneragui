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

    // Get all chunks for this document
    const { data: chunks, error } = await supabase
      .from('rag_chunks')
      .select('id, content, chunk_index, metadata')
      .eq('document_id', documentId)
      .order('chunk_index', { ascending: true });

    if (error) throw error;

    const formattedChunks = chunks?.map(chunk => ({
      id: chunk.id,
      chunkIndex: chunk.chunk_index,
      content: chunk.content,
      contentPreview: chunk.content.substring(0, 200) + (chunk.content.length > 200 ? '...' : ''),
      tokenLength: Math.ceil(chunk.content.split(/\s+/).length * 1.3), // Rough estimate
      metadata: chunk.metadata,
    })) || [];

    return new Response(
      JSON.stringify({ chunks: formattedChunks }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Document chunks error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
