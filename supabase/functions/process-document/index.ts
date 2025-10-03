import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { extractText, getDocumentProxy } from "https://esm.sh/unpdf";
import * as XLSX from "https://esm.sh/xlsx@0.18.5";
import mammoth from "https://esm.sh/mammoth@1.6.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Default values - will be overridden by user settings
const DEFAULT_CHUNK_SIZE = 800;
const DEFAULT_OVERLAP = 100;

interface ExtractedImage {
  data: ArrayBuffer;
  index: number;
  pageNumber?: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  let documentId: string | undefined;

  try {
    const body = await req.json();
    documentId = body.documentId;
    
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Progress update helper
    const updateProgress = async (step: string, progress: number, eta: number | null, completed: string[] = []) => {
      await supabase
        .from('rag_documents')
        .update({
          processing_progress: {
            currentStep: step,
            progress,
            eta,
            steps: [
              { name: 'Downloading file', status: completed.includes('download') ? 'completed' : step === 'Downloading file' ? 'processing' : 'pending' },
              { name: 'Extracting text & images', status: completed.includes('extract') ? 'completed' : step === 'Extracting text & images' ? 'processing' : 'pending' },
              { name: 'Captioning images', status: completed.includes('caption') ? 'completed' : step === 'Captioning images' ? 'processing' : 'pending' },
              { name: 'Creating chunks', status: completed.includes('chunk') ? 'completed' : step === 'Creating chunks' ? 'processing' : 'pending' },
              { name: 'Generating embeddings', status: completed.includes('embed') ? 'completed' : step === 'Generating embeddings' ? 'processing' : 'pending' },
              { name: 'Saving to database', status: completed.includes('save') ? 'completed' : step === 'Saving to database' ? 'processing' : 'pending' }
            ]
          }
        })
        .eq('id', documentId);
    };

    const startTime = Date.now();

    // Step 1: Download file from storage
    await updateProgress('Downloading file', 5, 90);
    const { data: document, error: docError } = await supabase
      .from('rag_documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (docError) throw new Error('Document not found');

    console.log('Processing document:', document.file_name, 'Type:', document.mime_type);

    // Get user's embedding provider or use OpenAI default
    const { data: embeddingProvider } = await supabase
      .from('embedding_providers')
      .select('*')
      .eq('user_id', document.user_id)
      .eq('is_default', true)
      .eq('is_enabled', true)
      .maybeSingle();

    const EMBEDDING_API_KEY = embeddingProvider?.api_key || openaiApiKey;
    const EMBEDDING_BASE_URL = embeddingProvider?.base_url || 'https://api.openai.com/v1';
    const EMBEDDING_MODEL = embeddingProvider?.model_id || 'text-embedding-3-small';
    
    console.log('Using embedding provider:', embeddingProvider?.display_name || 'OpenAI (fallback)');

    // Get user's RAG settings or use defaults
    const { data: ragSettings } = await supabase
      .from('rag_settings')
      .select('chunk_size, chunk_overlap')
      .eq('user_id', document.user_id)
      .single();

    const CHUNK_SIZE = ragSettings?.chunk_size || DEFAULT_CHUNK_SIZE;
    const OVERLAP = ragSettings?.chunk_overlap || DEFAULT_OVERLAP;
    
    console.log('Using RAG settings:', { CHUNK_SIZE, OVERLAP, EMBEDDING_MODEL });

    const { data: fileData, error: downloadError } = await supabase.storage
      .from('documents')
      .download(document.file_path);

    if (downloadError) throw new Error('Failed to download document');

    // Verify file integrity
    const arrayBuffer = await fileData.arrayBuffer();
    const fileSizeMatch = arrayBuffer.byteLength === document.file_size;
    if (!fileSizeMatch) {
      console.warn(`File size mismatch: expected ${document.file_size}, got ${arrayBuffer.byteLength}`);
    }

    // Step 2: Extract text and images based on file type
    await updateProgress('Extracting text & images', 15, 75, ['download']);
    
    let extractedText: string;
    let extractedImages: ExtractedImage[] = [];
    const fileExtension = document.file_name.toLowerCase().split('.').pop();
    const mimeType = document.mime_type?.toLowerCase() || '';
    
    console.log(`Extracting text and images from ${fileExtension} file...`);
    
    try {
      // Route to appropriate extractor based on file type
      if (mimeType.includes('pdf') || fileExtension === 'pdf') {
        const result = await extractPDFContent(arrayBuffer);
        extractedText = result.text;
        extractedImages = result.images;
      } else if (fileExtension === 'docx' || mimeType.includes('wordprocessingml')) {
        const result = await extractDOCXContent(arrayBuffer);
        extractedText = result.text;
        extractedImages = result.images;
      } else if (fileExtension === 'txt' || fileExtension === 'md' || mimeType.includes('text/plain')) {
        extractedText = await extractPlainText(arrayBuffer);
      } else if (fileExtension === 'csv' || mimeType.includes('csv')) {
        extractedText = await extractCSVText(arrayBuffer);
      } else if (fileExtension === 'xlsx' || fileExtension === 'xls' || mimeType.includes('spreadsheet')) {
        extractedText = await extractExcelText(arrayBuffer);
      } else if (fileExtension === 'json') {
        extractedText = await extractJSONText(arrayBuffer);
      } else if (fileExtension === 'xml' || fileExtension === 'html') {
        extractedText = await extractMarkupText(arrayBuffer);
      } else {
        throw new Error(`Unsupported file type: ${fileExtension || mimeType}`);
      }
      
      if (!extractedText || extractedText.trim().length === 0) {
        throw new Error('No text could be extracted from document');
      }

      console.log(`Extracted ${extractedText.length} characters and ${extractedImages.length} images`);
      
      await updateProgress('Extracting text & images', 30, 60, ['download']);
    } catch (parseError: any) {
      console.error('Document parsing error:', parseError);
      throw new Error(`Failed to parse document: ${parseError.message}`);
    }

    // Step 3: Process images - upload to storage and generate captions
    const imageCaptions: Map<number, { path: string; caption: string }> = new Map();
    
    if (extractedImages.length > 0) {
      await updateProgress('Captioning images', 35, 55, ['download', 'extract']);
      console.log(`Processing ${extractedImages.length} images...`);
      
      for (let i = 0; i < extractedImages.length; i++) {
        const image = extractedImages[i];
        const imagePath = `${document.user_id}/${documentId}/image_${image.index}.png`;
        
        // Upload image to storage
        const { error: uploadError } = await supabase.storage
          .from('document-images')
          .upload(imagePath, image.data, {
            contentType: 'image/png',
            upsert: true
          });
        
        if (uploadError) {
          console.error(`Failed to upload image ${image.index}:`, uploadError);
          continue;
        }
        
        // Generate caption using Lovable AI vision
        try {
          const base64Image = btoa(
            String.fromCharCode(...new Uint8Array(image.data))
          );
          
          const captionResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${lovableApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'google/gemini-2.5-flash',
              messages: [
                {
                  role: 'user',
                  content: [
                    {
                      type: 'text',
                      text: 'Describe this image in detail for document search purposes. Include any text, diagrams, charts, or key visual elements.'
                    },
                    {
                      type: 'image_url',
                      image_url: {
                        url: `data:image/png;base64,${base64Image}`
                      }
                    }
                  ]
                }
              ]
            })
          });
          
          if (captionResponse.ok) {
            const captionData = await captionResponse.json();
            const caption = captionData.choices?.[0]?.message?.content || 'Image';
            imageCaptions.set(image.index, { path: imagePath, caption });
            console.log(`Generated caption for image ${image.index}: ${caption.substring(0, 100)}...`);
          }
        } catch (captionError) {
          console.error(`Failed to caption image ${image.index}:`, captionError);
        }
        
        // Update progress
        const progressPercent = 35 + Math.floor((i + 1) / extractedImages.length * 10);
        await updateProgress('Captioning images', progressPercent, 50 - (i + 1) * 2, ['download', 'extract']);
      }
      
      console.log(`Captioned ${imageCaptions.size} images`);
    }
    
    // Step 4: Chunking with overlap
    await updateProgress('Creating chunks', 50, 40, ['download', 'extract', 'caption']);

    const words = extractedText.split(/\s+/);
    const chunkSizeWords = Math.floor(CHUNK_SIZE * 0.75);
    const overlapWords = Math.floor(OVERLAP * 0.75);
    const chunks: Array<{
      content: string;
      imageIndex?: number;
      imagePath?: string;
      imageCaption?: string;
    }> = [];

    // Create text chunks
    for (let i = 0; i < words.length; i += chunkSizeWords - overlapWords) {
      const chunk = words.slice(i, i + chunkSizeWords).join(' ');
      if (chunk.trim().length > 0) {
        chunks.push({ content: chunk });
      }
    }

    // Add image-based chunks
    imageCaptions.forEach((imgData, imgIndex) => {
      chunks.push({
        content: `[IMAGE ${imgIndex + 1}] ${imgData.caption}`,
        imageIndex: imgIndex,
        imagePath: imgData.path,
        imageCaption: imgData.caption
      });
    });

    console.log(`Created ${chunks.length} chunks (${chunks.length - imageCaptions.size} text + ${imageCaptions.size} image)`);

    if (chunks.length === 0) {
      throw new Error('No chunks created - text extraction may have failed');
    }

    // Step 5: Generate embeddings
    await updateProgress('Generating embeddings', 65, 30, ['download', 'extract', 'caption', 'chunk']);

    const embeddingsResponse = await fetch(`${EMBEDDING_BASE_URL}/embeddings`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${EMBEDDING_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        input: chunks.map(c => c.content),
      }),
    });

    if (!embeddingsResponse.ok) {
      const errorText = await embeddingsResponse.text();
      console.error('Embedding generation failed:', errorText);
      throw new Error('Failed to generate embeddings');
    }

    const embeddingsData = await embeddingsResponse.json();

    if (embeddingsData.data.length !== chunks.length) {
      throw new Error(`Embedding count mismatch: expected ${chunks.length}, got ${embeddingsData.data.length}`);
    }

    // Step 6: Save to database
    await updateProgress('Saving to database', 85, 15, ['download', 'extract', 'caption', 'chunk', 'embed']);

    const chunksToInsert = chunks.map((chunk, index) => ({
      document_id: documentId,
      collection_id: document.collection_id,
      user_id: document.user_id,
      content: chunk.content,
      chunk_index: index,
      embedding: embeddingsData.data[index].embedding,
      has_image: chunk.imageIndex !== undefined,
      image_path: chunk.imagePath || null,
      image_caption: chunk.imageCaption || null,
      metadata: {
        file_name: document.file_name,
        chunk_number: index + 1,
        total_chunks: chunks.length,
        file_size: document.file_size,
        extracted_text_length: extractedText.length,
        has_image: chunk.imageIndex !== undefined,
        image_index: chunk.imageIndex
      },
    }));

    const { error: insertError } = await supabase
      .from('rag_chunks')
      .insert(chunksToInsert);

    if (insertError) {
      console.error('Failed to insert chunks:', insertError);
      throw new Error('Failed to save chunks to database');
    }

    // Verification
    const { count: verifyCount } = await supabase
      .from('rag_chunks')
      .select('id', { count: 'exact', head: true })
      .eq('document_id', documentId);

    if (verifyCount !== chunks.length) {
      console.error(`Verification failed: expected ${chunks.length} chunks, found ${verifyCount}`);
    }

    // Mark complete
    const processingTime = Math.round((Date.now() - startTime) / 1000);
    const { error: completeError } = await supabase
      .from('rag_documents')
      .update({ 
        status: 'indexed',
        processing_progress: {
          currentStep: 'Completed',
          progress: 100,
          eta: 0,
          steps: [
            { name: 'Downloading file', status: 'completed' },
            { name: 'Extracting text & images', status: 'completed' },
            { name: 'Captioning images', status: 'completed' },
            { name: 'Creating chunks', status: 'completed' },
            { name: 'Generating embeddings', status: 'completed' },
            { name: 'Saving to database', status: 'completed' }
          ],
          processingTime,
          verificationStatus: verifyCount === chunks.length ? 'passed' : 'warning',
          imagesProcessed: extractedImages.length,
          imagesCaptioned: imageCaptions.size
        }
      })
      .eq('id', documentId);

    if (completeError) {
      console.error('Failed to mark document as completed:', completeError);
      throw new Error('Failed to update completion status');
    }

    console.log(`Document processing completed in ${processingTime}s. Indexed ${chunks.length} chunks with ${imageCaptions.size} images.`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        chunks: chunks.length,
        images: imageCaptions.size,
        processingTime,
        verified: verifyCount === chunks.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Document processing error:', error);

    if (documentId) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      await supabase
        .from('rag_documents')
        .update({ 
          status: 'failed',
          error_message: error.message,
          processing_progress: {
            currentStep: 'Failed',
            progress: 0,
            eta: null,
            steps: []
          }
        })
        .eq('id', documentId);
    }

    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// ============ Extraction Functions ============

async function extractPDFContent(arrayBuffer: ArrayBuffer): Promise<{ text: string; images: ExtractedImage[] }> {
  const pdf = await getDocumentProxy(new Uint8Array(arrayBuffer));
  const { text } = await extractText(pdf, { mergePages: true });
  
  // Extract images from PDF
  const images: ExtractedImage[] = [];
  
  // unpdf doesn't provide direct image extraction, so we note this limitation
  // Future enhancement: use pdf-lib or similar for image extraction
  console.log('PDF image extraction not yet implemented - text only');
  
  return { text, images };
}

async function extractDOCXContent(arrayBuffer: ArrayBuffer): Promise<{ text: string; images: ExtractedImage[] }> {
  try {
    // Extract text
    const textResult = await mammoth.extractRawText({ arrayBuffer });
    if (!textResult.value || textResult.value.trim().length === 0) {
      throw new Error('No text extracted from DOCX');
    }
    
    // Extract images
    const images: ExtractedImage[] = [];
    const imageResult = await mammoth.convertToHtml({ arrayBuffer });
    
    // Parse embedded images from the conversion
    // Mammoth includes images as base64 data URLs in the HTML
    const imgRegex = /<img[^>]+src="data:image\/([^;]+);base64,([^"]+)"/g;
    let match;
    let imageIndex = 0;
    
    while ((match = imgRegex.exec(imageResult.value)) !== null) {
      const [, format, base64Data] = match;
      try {
        const binaryString = atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        images.push({
          data: bytes.buffer,
          index: imageIndex++
        });
      } catch (decodeError) {
        console.error(`Failed to decode image ${imageIndex}:`, decodeError);
      }
    }
    
    console.log(`Extracted ${images.length} images from DOCX`);
    return { text: textResult.value.trim(), images };
  } catch (error: any) {
    console.error('Mammoth extraction failed:', error);
    throw new Error(`Failed to extract DOCX content: ${error.message}`);
  }
}

async function extractPlainText(arrayBuffer: ArrayBuffer): Promise<string> {
  const decoder = new TextDecoder('utf-8');
  return decoder.decode(arrayBuffer);
}

async function extractCSVText(arrayBuffer: ArrayBuffer): Promise<string> {
  const text = await extractPlainText(arrayBuffer);
  const lines = text.split('\n');
  
  const formattedLines = lines.map(line => {
    const fields = line.split(',').map(f => f.trim());
    return fields.join(' | ');
  });
  
  return formattedLines.join('\n');
}

async function extractExcelText(arrayBuffer: ArrayBuffer): Promise<string> {
  const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });
  let allText = '';
  
  workbook.SheetNames.forEach(sheetName => {
    const sheet = workbook.Sheets[sheetName];
    allText += `\n=== Sheet: ${sheetName} ===\n`;
    const csv = XLSX.utils.sheet_to_csv(sheet);
    allText += csv + '\n';
  });
  
  return allText.trim();
}

async function extractJSONText(arrayBuffer: ArrayBuffer): Promise<string> {
  const text = await extractPlainText(arrayBuffer);
  try {
    const json = JSON.parse(text);
    return JSON.stringify(json, null, 2);
  } catch {
    return text;
  }
}

async function extractMarkupText(arrayBuffer: ArrayBuffer): Promise<string> {
  const text = await extractPlainText(arrayBuffer);
  
  const withoutTags = text
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  return withoutTags;
}
