import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Tool definitions
const tools = [
  {
    type: "function",
    function: {
      name: "search_documents",
      description: "Search through the user's RAG document collections for relevant information. Use this when the user asks questions about their documents or uploaded content.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "The search query to find relevant documents"
          }
        },
        required: ["query"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "web_search",
      description: "Search the internet for current information. Only use when web search is enabled and user needs up-to-date information not in training data.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "The search query"
          }
        },
        required: ["query"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "calculator",
      description: "Perform mathematical calculations. Supports basic arithmetic operations.",
      parameters: {
        type: "object",
        properties: {
          expression: {
            type: "string",
            description: "The mathematical expression to evaluate (e.g., '2 + 2', '10 * 5')"
          }
        },
        required: ["expression"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_current_date",
      description: "Get the current date and time information.",
      parameters: {
        type: "object",
        properties: {}
      }
    }
  }
];

// Tool execution functions
async function searchDocuments(
  supabase: any,
  userId: string,
  chatId: string,
  query: string,
  embeddingConfig: any
) {
  console.log('Executing search_documents tool:', query);
  
  const { data: linkedCollections } = await supabase
    .from('chat_collections')
    .select('collection_id')
    .eq('chat_id', chatId);

  if (!linkedCollections || linkedCollections.length === 0) {
    return "No document collections linked to this chat. Please link a collection first.";
  }

  const collectionIds = linkedCollections.map((c: any) => c.collection_id);

  // Generate embedding
  const embeddingResponse = await fetch(`${embeddingConfig.baseUrl}/embeddings`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${embeddingConfig.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      input: query,
      model: embeddingConfig.model
    }),
  });

  if (!embeddingResponse.ok) {
    return "Error generating search embedding.";
  }

  const embeddingData = await embeddingResponse.json();
  const queryEmbedding = embeddingData.data[0].embedding;

  // Search chunks
  const { data: chunks } = await supabase.rpc('match_rag_chunks', {
    query_embedding: queryEmbedding,
    match_threshold: embeddingConfig.threshold,
    match_count: embeddingConfig.topK,
    collection_ids: collectionIds
  });

  if (!chunks || chunks.length === 0) {
    return "No relevant documents found for your query.";
  }

  const results = chunks.slice(0, 5).map((c: any, i: number) => 
    `[${i + 1}] ${c.content.substring(0, 300)}...`
  ).join('\n\n');

  return `Found ${chunks.length} relevant document chunks:\n\n${results}`;
}

async function webSearch(query: string, enabled: boolean, supabase: any, userId: string) {
  console.log('Web search requested:', query, 'Enabled:', enabled);
  
  if (!enabled) {
    return "Web search is disabled. Enable it in the chat interface to use this feature.";
  }

  try {
    // Get user's default search provider
    const { data: provider } = await supabase
      .from('web_search_providers')
      .select('*')
      .eq('user_id', userId)
      .eq('is_default', true)
      .eq('is_enabled', true)
      .maybeSingle();

    if (!provider) {
      return "No web search provider configured. Please add one in Settings → Web Search.";
    }

    let searchResults = '';

    // Execute search based on provider type
    switch (provider.provider_name) {
      case 'brave': {
        const response = await fetch(
          `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}`,
          {
            headers: {
              'X-Subscription-Token': provider.api_key,
              'Accept': 'application/json',
            },
          }
        );

        if (!response.ok) {
          return `Brave Search API error: ${response.statusText}`;
        }

        const data = await response.json();
        const results = data.web?.results?.slice(0, 5) || [];
        
        searchResults = results.length > 0
          ? results.map((r: any, i: number) => 
              `${i + 1}. **[${r.title}](${r.url})**\n   ${r.description}`
            ).join('\n\n')
          : 'No results found.';
        break;
      }

      case 'serper': {
        const response = await fetch('https://google.serper.dev/search', {
          method: 'POST',
          headers: {
            'X-API-KEY': provider.api_key,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ q: query }),
        });

        if (!response.ok) {
          return `Serper API error: ${response.statusText}`;
        }

        const data = await response.json();
        const results = data.organic?.slice(0, 5) || [];
        
        searchResults = results.length > 0
          ? results.map((r: any, i: number) => 
              `${i + 1}. **[${r.title}](${r.link})**\n   ${r.snippet}`
            ).join('\n\n')
          : 'No results found.';
        break;
      }

      case 'tavily': {
        const response = await fetch('https://api.tavily.com/search', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            api_key: provider.api_key,
            query: query,
            max_results: 5,
          }),
        });

        if (!response.ok) {
          return `Tavily API error: ${response.statusText}`;
        }

        const data = await response.json();
        const results = data.results || [];
        
        searchResults = results.length > 0
          ? results.map((r: any, i: number) => 
              `${i + 1}. **[${r.title}](${r.url})**\n   ${r.content}`
            ).join('\n\n')
          : 'No results found.';
        break;
      }

      case 'custom': {
        if (!provider.base_url) {
          return "Custom provider has no API endpoint configured.";
        }

        const response = await fetch(provider.base_url, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${provider.api_key}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ query }),
        });

        if (!response.ok) {
          return `Custom provider API error: ${response.statusText}`;
        }

        const data = await response.json();
        searchResults = JSON.stringify(data, null, 2);
        break;
      }

      default:
        return `Unknown provider: ${provider.provider_name}`;
    }

    return `Web search results for "${query}":\n\n${searchResults}\n\n---\nIMPORTANT: Synthesize this information into a comprehensive, well-written response. Do NOT just list these results. Cite sources naturally in your response and include a "Sources" section at the end with clickable links.`;
  } catch (error: any) {
    return `Web search error: ${error?.message || 'Unknown error'}`;
  }
}

function calculate(expression: string) {
  console.log('Calculating:', expression);
  
  try {
    // Sanitize and evaluate safely
    const cleaned = expression.replace(/[^0-9+\-*/().\s]/g, '');
    const result = Function(`"use strict"; return (${cleaned})`)();
    
    if (typeof result !== 'number' || !isFinite(result)) {
      return "Invalid calculation result.";
    }
    
    return `${expression} = ${result}`;
  } catch (error: any) {
    return `Calculation error: ${error?.message || 'Unknown error'}`;
  }
}

function getCurrentDate() {
  console.log('Getting current date');
  
  const now = new Date();
  const formatted = now.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    timeZoneName: 'short'
  });
  
  return `Current date and time: ${formatted}`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, chatId, messages: conversationHistory, webSearchEnabled = false } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    let contextChunks: string[] = [];
    let sourceDocuments: any[] = [];
    let selectedModel = 'google/gemini-2.5-flash';
    let modelDisplayName = 'Gemini 2.5 Flash';
    let userId = '';
    let hasRAGCollections = false;

    // If chatId is provided, retrieve RAG context and user settings
    if (chatId) {
      console.log('Fetching RAG context for chat:', chatId);
      
      const { data: chatData } = await supabase
        .from('chats')
        .select('user_id')
        .eq('id', chatId)
        .single();

      userId = chatData?.user_id || '';

      if (chatData?.user_id) {
        const { data: userSettings } = await supabase
          .from('user_settings')
          .select('selected_model')
          .eq('user_id', chatData.user_id)
          .maybeSingle();

        if (userSettings?.selected_model) {
          selectedModel = userSettings.selected_model;
          
          const modelNames: Record<string, string> = {
            'google/gemini-2.5-flash': 'Gemini 2.5 Flash',
            'google/gemini-2.5-pro': 'Gemini 2.5 Pro',
            'openai/gpt-5': 'GPT-5',
          };
          modelDisplayName = modelNames[selectedModel] || selectedModel;
          console.log('Using user-selected model:', modelDisplayName);
        }
        
        // Check if there's a custom API provider set as default
        const { data: customProvider } = await supabase
          .from('api_providers')
          .select('*')
          .eq('user_id', chatData.user_id)
          .eq('is_default', true)
          .eq('is_enabled', true)
          .maybeSingle();
        
        if (customProvider) {
          selectedModel = `custom:${customProvider.id}`;
          modelDisplayName = customProvider.display_name;
          console.log('Using custom API provider:', modelDisplayName);
        }
      }

      const { data: embeddingProvider } = await supabase
        .from('embedding_providers')
        .select('*')
        .eq('user_id', chatData?.user_id)
        .eq('is_default', true)
        .eq('is_enabled', true)
        .maybeSingle();

      const EMBEDDING_API_KEY = embeddingProvider?.api_key || OPENAI_API_KEY;
      const EMBEDDING_BASE_URL = embeddingProvider?.base_url || 'https://api.openai.com/v1';
      const EMBEDDING_MODEL = embeddingProvider?.model_id || 'text-embedding-3-small';

      const { data: ragSettings } = await supabase
        .from('rag_settings')
        .select('top_k_results, match_threshold')
        .eq('user_id', chatData?.user_id)
        .maybeSingle();

      const TOP_K = ragSettings?.top_k_results || 10;
      const MATCH_THRESHOLD = ragSettings?.match_threshold || 0.2;
      
      console.log('Using embedding provider:', embeddingProvider?.display_name || 'OpenAI (fallback)');
      console.log('Using RAG settings:', { TOP_K, MATCH_THRESHOLD, EMBEDDING_MODEL });
      
      const { data: linkedCollections, error: collectionsError } = await supabase
        .from('chat_collections')
        .select('collection_id')
        .eq('chat_id', chatId);

      if (collectionsError) {
        console.error('Error fetching collections:', collectionsError);
      } else if (linkedCollections && linkedCollections.length > 0) {
        hasRAGCollections = true;
        const collectionIds = linkedCollections.map(c => c.collection_id);
        console.log('Found linked collections:', collectionIds);

        const embeddingResponse = await fetch(`${EMBEDDING_BASE_URL}/embeddings`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${EMBEDDING_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            input: message,
            model: EMBEDDING_MODEL
          }),
        });

        if (embeddingResponse.ok) {
          const embeddingData = await embeddingResponse.json();
          const queryEmbedding = embeddingData.data[0].embedding;
          console.log('Generated query embedding, searching for chunks...');

          const { data: relevantChunks, error: chunksError } = await supabase.rpc(
            'match_rag_chunks',
            {
              query_embedding: queryEmbedding,
              match_threshold: MATCH_THRESHOLD,
              match_count: TOP_K,
              collection_ids: collectionIds
            }
          );

          if (chunksError) {
            console.error('Error searching chunks:', chunksError);
          } else {
            console.log('Search completed. Found chunks:', relevantChunks?.length || 0);
            if (relevantChunks && relevantChunks.length > 0) {
              contextChunks = relevantChunks.map((chunk: any) => chunk.content);
              
              const { data: fullChunks } = await supabase
                .from('rag_chunks')
                .select('id, document_id, has_image, image_path, image_caption')
                .in('id', relevantChunks.map((c: any) => c.id));
              
              const uniqueDocIds = [...new Set(relevantChunks.map((c: any) => c.document_id))];
              console.log('Unique document IDs:', uniqueDocIds.length);
              
              const { data: documents } = await supabase
                .from('rag_documents')
                .select('id, file_name, file_path, file_size')
                .in('id', uniqueDocIds);
              
              if (documents) {
                const docsWithUrls = await Promise.all(
                  documents.map(async (doc) => {
                    const { data: signedUrl } = await supabase.storage
                      .from('documents')
                      .createSignedUrl(doc.file_path, 3600);
                    
                    const chunkWithImage = fullChunks?.find(
                      (c) => c.document_id === doc.id && c.has_image
                    );
                    
                    return {
                      id: doc.id,
                      name: doc.file_name,
                      size: doc.file_size,
                      downloadUrl: signedUrl?.signedUrl,
                      hasImage: chunkWithImage?.has_image || false,
                      imagePath: chunkWithImage?.image_path || undefined,
                      imageCaption: chunkWithImage?.image_caption || undefined
                    };
                  })
                );
                
                const uniqueDocs = Array.from(
                  new Map(docsWithUrls.map(doc => [doc.id, doc])).values()
                );
                
                sourceDocuments = uniqueDocs;
                console.log('Source documents prepared:', sourceDocuments.length);
              }
              
              console.log('Retrieved chunk contents and source documents');
            } else {
              console.log('No chunks matched the similarity threshold');
            }
          }
        } else {
          const errorText = await embeddingResponse.text();
          console.error('Embedding generation failed:', embeddingResponse.status, errorText);
        }
      }
    }

    // Build system prompt with tool awareness
    let systemPrompt = `You are Isola Zero, an AI assistant powered by ${modelDisplayName}. 

**Your Identity:**
When asked "what are you" or "who are you", respond that you are Isola Zero, an AI assistant powered by ${modelDisplayName}. Do not say you are trained by Google or any other company - you are Isola Zero.

**Available Tools:**
${hasRAGCollections ? '- search_documents: Search the user\'s uploaded documents (only use when user explicitly asks about their documents)' : ''}
${webSearchEnabled ? '- web_search: Search the internet for current information' : ''}
- calculator: Perform mathematical calculations
- get_current_date: Get current date and time

**How to Handle Document Information:**
When answering questions about documents:
- NEVER recite or quote large sections of documents unless explicitly asked to do so
- Provide concise, relevant summaries that directly answer the user's question
- Extract only the key information needed to answer the question
- If the user wants the full text, they will specifically ask for it (e.g., "show me the full policy", "give me the complete text")

**How to Handle Web Search Results:**
When you receive web search results, synthesize the information into a clear, comprehensive response. Cite sources naturally in your writing (e.g., "According to [Source Name]...") and include a "Sources" section at the end with clickable links formatted as: **[Title](URL)**

**General Guidelines:**
- Be warm, patient, and helpful - even if users ask similar questions multiple times
- Answer questions directly using your knowledge unless the user specifically asks about their documents or needs current information
- Only use tools when explicitly needed for the request
- Format responses with proper markdown for readability
- Stay conversational and friendly in tone
- Keep responses concise and to the point unless asked for detailed explanations

${contextChunks.length > 0 ? `\n**Document Context:**\n${contextChunks.join('\n\n---\n\n')}\n\nUse this context to answer questions, but summarize and synthesize - don't recite it verbatim.` : ''}`;

    // Build messages
    const apiMessages = [
      { role: 'system', content: systemPrompt }
    ];

    if (conversationHistory && conversationHistory.length > 0) {
      apiMessages.push(...conversationHistory.map((msg: any) => ({
        role: msg.role,
        content: msg.content
      })));
    }

    apiMessages.push({ role: 'user', content: message });

    console.log('Making AI request with tools. Web search:', webSearchEnabled, 'Has RAG:', hasRAGCollections);

    // Filter tools based on settings and available features
    let availableTools = tools.filter(t => {
      // Always exclude web_search if not enabled
      if (t.function.name === 'web_search' && !webSearchEnabled) return false;
      // Exclude search_documents if no collections are linked
      if (t.function.name === 'search_documents' && !hasRAGCollections) return false;
      return true;
    });

    let response;
    let isCustomProvider = false;
    
    // Check if using a custom API provider
    if (selectedModel.startsWith('custom:')) {
      const providerId = selectedModel.split(':')[1];
      const { data: provider } = await supabase
        .from('api_providers')
        .select('*')
        .eq('id', providerId)
        .single();
      
      if (!provider) {
        return new Response(JSON.stringify({ error: 'Custom provider not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      isCustomProvider = true;
      console.log('Calling custom provider:', provider.provider_name, provider.base_url);
      
      // Format request based on provider type
      let apiUrl = provider.base_url;
      let requestBody: any = {
        model: provider.model_id,
        messages: apiMessages,
        stream: true,
      };
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      if (provider.api_key) {
        headers['Authorization'] = `Bearer ${provider.api_key}`;
      }
      
      // Ollama-specific formatting
      if (provider.provider_name === 'ollama') {
        apiUrl = `${provider.base_url}/api/chat`;
        // Ollama doesn't support tools in the same way
        delete requestBody.tools;
      } else {
        // OpenAI-compatible format
        apiUrl = apiUrl.endsWith('/chat/completions') ? apiUrl : `${apiUrl}/v1/chat/completions`;
        requestBody.tools = availableTools;
      }
      
      response = await fetch(apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
      });
    } else {
      // Use Lovable AI Gateway
      response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: selectedModel,
          messages: apiMessages,
          tools: availableTools,
          stream: true,
        }),
      });
    }

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limits exceeded, please try again later.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'Payment required, please add funds to your Lovable AI workspace.' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      return new Response(JSON.stringify({ error: 'AI gateway error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const encoder = new TextEncoder();
    const reader = response.body!.getReader();
    
    const stream = new ReadableStream({
      async start(controller) {
        // Send sources first
        if (sourceDocuments.length > 0) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'sources', sources: sourceDocuments })}\n\n`)
          );
        }

        let toolCallsBuffer: any[] = [];
        let currentMessage = '';

        try {
          const decoder = new TextDecoder();
          let buffer = '';

          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              // Execute any buffered tool calls
              if (toolCallsBuffer.length > 0) {
                console.log('Executing tool calls:', toolCallsBuffer.length);
                
                for (const toolCall of toolCallsBuffer) {
                  const toolName = toolCall.function.name;
                  const toolArgs = JSON.parse(toolCall.function.arguments || '{}');
                  
                  // Notify about tool execution
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ 
                      type: 'tool_call', 
                      tool: toolName, 
                      args: toolArgs 
                    })}\n\n`)
                  );

                  let toolResult = '';
                  try {
                    switch (toolName) {
                      case 'search_documents':
                        if (chatId && userId) {
                          const embeddingConfig = {
                            apiKey: OPENAI_API_KEY,
                            baseUrl: 'https://api.openai.com/v1',
                            model: 'text-embedding-3-small',
                            threshold: 0.2,
                            topK: 10
                          };
                          toolResult = await searchDocuments(supabase, userId, chatId, toolArgs.query, embeddingConfig);
                        } else {
                          toolResult = "Chat not initialized.";
                        }
                        break;
                      case 'web_search':
                        toolResult = await webSearch(toolArgs.query, webSearchEnabled, supabase, userId);
                        break;
                      case 'calculator':
                        toolResult = calculate(toolArgs.expression);
                        break;
                      case 'get_current_date':
                        toolResult = getCurrentDate();
                        break;
                      default:
                        toolResult = `Unknown tool: ${toolName}`;
                    }
                  } catch (error: any) {
                    toolResult = `Tool error: ${error?.message || 'Unknown error'}`;
                  }

                  // Send tool result
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ 
                      type: 'tool_result', 
                      tool: toolName, 
                      result: toolResult 
                    })}\n\n`)
                  );

                  // Add to conversation (cast to any for tool message format)
                  (apiMessages as any[]).push({
                    role: 'assistant',
                    content: null,
                    tool_calls: [toolCall]
                  });
                  (apiMessages as any[]).push({
                    role: 'tool',
                    tool_call_id: toolCall.id,
                    content: toolResult
                  });
                }

                // Make follow-up request with tool results
                const followUpResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${LOVABLE_API_KEY}`,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    model: selectedModel,
                    messages: apiMessages,
                    stream: true,
                  }),
                });

                if (followUpResponse.ok && followUpResponse.body) {
                  const followUpReader = followUpResponse.body.getReader();
                  while (true) {
                    const { done: followDone, value: followValue } = await followUpReader.read();
                    if (followDone) break;
                    controller.enqueue(followValue);
                  }
                }
              }
              break;
            }
            
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (!line.trim() || line.startsWith(':')) continue;
              if (!line.startsWith('data: ')) continue;

              const data = line.slice(6);
              if (data === '[DONE]') continue;

              try {
                const parsed = JSON.parse(data);
                const delta = parsed.choices?.[0]?.delta;

                // Handle tool calls
                if (delta?.tool_calls) {
                  for (const tc of delta.tool_calls) {
                    const index = tc.index || 0;
                    if (!toolCallsBuffer[index]) {
                      toolCallsBuffer[index] = {
                        id: tc.id || `call_${Date.now()}_${index}`,
                        type: 'function',
                        function: {
                          name: tc.function?.name || '',
                          arguments: tc.function?.arguments || ''
                        }
                      };
                    } else {
                      if (tc.function?.arguments) {
                        toolCallsBuffer[index].function.arguments += tc.function.arguments;
                      }
                    }
                  }
                  continue;
                }

                // Pass through regular content
                controller.enqueue(value);
              } catch (e) {
                // Pass through unparseable data
                controller.enqueue(value);
              }
            }
          }
          
          controller.close();
        } catch (error) {
          console.error('Stream error:', error);
          controller.error(error);
        }
      },
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Chat error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
