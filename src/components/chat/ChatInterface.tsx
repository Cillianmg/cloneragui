import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Send, Database, Loader2, Globe } from "lucide-react";
import { toast } from "sonner";
import { MessageBubble } from "./MessageBubble";
interface ChatInterfaceProps {
  chatId: string | null;
  onShowRAG: () => void;
  onChatCreated?: (chatId: string) => void;
}
export const ChatInterface = ({
  chatId,
  onShowRAG,
  onChatCreated
}: ChatInterfaceProps) => {
  const [messages, setMessages] = useState<any[]>([]);
  const [messageSources, setMessageSources] = useState<Record<string, any[]>>({});
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  useEffect(() => {
    // Get current user
    supabase.auth.getUser().then(({
      data
    }) => {
      setCurrentUser(data.user);
    });
  }, []);
  useEffect(() => {
    if (chatId) {
      loadMessages();
      setMessageSources({}); // Reset sources when switching chats
    } else {
      setMessages([]);
      setMessageSources({});
    }
  }, [chatId]);
  useEffect(() => {
    scrollRef.current?.scrollIntoView({
      behavior: "smooth"
    });
  }, [messages]);
  const loadMessages = async () => {
    if (!chatId) return;
    const {
      data,
      error
    } = await supabase.from('messages').select('*').eq('chat_id', chatId).order('created_at', {
      ascending: true
    });
    if (error) {
      toast.error("Failed to load messages");
    } else {
      setMessages(data || []);
    }
  };
  const handleSend = async () => {
    if (!input.trim() || loading || !currentUser) return;
    const userMessage = input.trim();
    setInput("");
    setLoading(true);
    try {
      let currentChatId = chatId;
      let isNewChat = false;

      // Create new chat if needed
      if (!currentChatId) {
        const {
          data: newChat,
          error: chatError
        } = await supabase.from('chats').insert([{
          title: 'New Chat',
          user_id: currentUser.id
        }]).select().single();
        if (chatError) throw chatError;
        currentChatId = newChat.id;
        isNewChat = true;

        // Notify parent component about the new chat
        onChatCreated?.(currentChatId);
      }

      // Insert user message
      const {
        data: userMsg,
        error: msgError
      } = await supabase.from('messages').insert({
        chat_id: currentChatId,
        role: 'user',
        content: userMessage
      }).select().single();
      if (msgError) throw msgError;
      setMessages(prev => [...prev, userMsg]);

      // Add a temporary AI message that will be updated with streaming content
      const tempAiMsg = {
        id: `temp-${Date.now()}`,
        chat_id: currentChatId,
        role: 'assistant',
        content: '',
        created_at: new Date().toISOString()
      };
      setMessages(prev => [...prev, tempAiMsg]);

      // Call streaming chat endpoint
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`
        },
        body: JSON.stringify({
          chatId: currentChatId,
          message: userMessage,
          messages: messages,
          webSearchEnabled
        })
      });
      if (!response.ok || !response.body) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to start stream');
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = '';
      let fullMessage = '';
      let receivedSources: any[] = [];
      while (true) {
        const {
          done,
          value
        } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, {
          stream: true
        });
        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;
          try {
            const parsed = JSON.parse(jsonStr);

            // Handle sources
            if (parsed.type === 'sources') {
              receivedSources = parsed.sources;
              continue;
            }

            // Handle tool calls
            if (parsed.type === 'tool_call') {
              const toolNotice = `\n\n🔧 Using ${parsed.tool}...\n\n`;
              fullMessage += toolNotice;
              setMessages(prev => prev.map(msg => msg.id === tempAiMsg.id ? {
                ...msg,
                content: fullMessage
              } : msg));
              continue;
            }

            // Handle tool results
            if (parsed.type === 'tool_result') {
              const resultNotice = `**${parsed.tool} result:**\n${parsed.result}\n\n`;
              fullMessage += resultNotice;
              setMessages(prev => prev.map(msg => msg.id === tempAiMsg.id ? {
                ...msg,
                content: fullMessage
              } : msg));
              continue;
            }

            // Handle streaming content
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              fullMessage += content;

              // Update the temporary message with streaming content
              setMessages(prev => prev.map(msg => msg.id === tempAiMsg.id ? {
                ...msg,
                content: fullMessage
              } : msg));
            }
          } catch (e) {
            // If JSON parsing fails, it might be a partial chunk - put it back in buffer
            textBuffer = line + '\n' + textBuffer;
            break;
          }
        }
      }

      // Save the final message to database
      const {
        data: aiMsg,
        error: aiMsgError
      } = await supabase.from('messages').insert({
        chat_id: currentChatId,
        role: 'assistant',
        content: fullMessage
      }).select().single();
      if (aiMsgError) throw aiMsgError;

      // Replace temp message with saved message
      setMessages(prev => prev.map(msg => msg.id === tempAiMsg.id ? aiMsg : msg));

      // Store sources if available
      if (receivedSources.length > 0) {
        setMessageSources(prev => ({
          ...prev,
          [aiMsg.id]: receivedSources
        }));
      }

      // Generate title for new chats
      if (isNewChat) {
        generateChatTitle(currentChatId, userMessage, fullMessage);
      }
    } catch (error: any) {
      console.error('Chat error:', error);
      toast.error(error.message || "Failed to send message");
    } finally {
      setLoading(false);
    }
  };
  const generateChatTitle = async (chatId: string, userMessage: string, aiResponse: string) => {
    try {
      // Simple title generation from user message
      const words = userMessage.split(' ').slice(0, 6).join(' ');
      const title = words.length < userMessage.length ? words + '...' : words;

      // Update the chat title
      await supabase.from('chats').update({
        title: title.slice(0, 100)
      }).eq('id', chatId);
    } catch (error) {
      console.error('Failed to generate title:', error);
      // Silent fail - not critical
    }
  };
  return <div className="flex flex-col h-screen relative">
      <header className="border-b border-gray-200 bg-white p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <SidebarTrigger />
          <div>
            <h2 className="text-lg font-semibold">
              {chatId ? "Chat" : "New Chat"}
            </h2>
            <p className="text-sm text-muted-foreground">
              Ask anything or upload documents for RAG
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={onShowRAG} className="gap-2">
          <Database className="w-4 h-4" />
          RAG Collections
        </Button>
      </header>

      <ScrollArea className="flex-1 p-4">
        <div className="max-w-3xl mx-auto space-y-4 pb-32">
          {messages.length === 0 && !loading && <div className="text-center py-12 space-y-3">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <Database className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-base font-light tracking-wide">Howdy :)</h3>
            </div>}

          {messages.map(message => <MessageBubble key={message.id} message={message} sources={messageSources[message.id]} />)}

          {loading && <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Thinking...</span>
            </div>}

          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      {/* Floating Input - Centered when empty, bottom when has messages */}
      <div className={`${messages.length === 0 ? 'absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/4 w-full max-w-3xl px-4' : 'sticky bottom-0 bg-white border-t border-gray-200 p-4'}`}>
        {messages.length === 0 && <p className="text-center text-sm text-muted-foreground mb-4 px-4">
            Ask questions, get AI-powered responses with tool calling support
          </p>}
        
        {/* Tool controls */}
        {messages.length > 0 && <div className="max-w-3xl mx-auto mb-2 flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
              <Globe className="w-4 h-4" />
              <span>Web Search</span>
              <input type="checkbox" checked={webSearchEnabled} onChange={e => setWebSearchEnabled(e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer" />
            </label>
          </div>}
        
        <div className={`${messages.length === 0 ? '' : 'max-w-3xl mx-auto'} flex gap-2`}>
          <div className={`flex-1 flex gap-2 ${messages.length === 0 ? 'bg-white rounded-3xl shadow-lg border border-gray-200 p-2' : ''}`}>
            <Textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }} placeholder="How Can I Help You Today?" className={`${messages.length === 0 ? 'border-0 shadow-none focus-visible:ring-0 resize-none bg-white' : 'min-h-[60px] max-h-[200px] resize-none bg-white'}`} rows={messages.length === 0 ? 1 : 3} />
            <Button onClick={handleSend} disabled={!input.trim() || loading} size="icon" className={`${messages.length === 0 ? 'rounded-full' : 'self-end'}`}>
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>;
};