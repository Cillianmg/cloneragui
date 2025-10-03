import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Sidebar } from "@/components/chat/Sidebar";
import { ChatInterface } from "@/components/chat/ChatInterface";
import { RAGPanel } from "@/components/chat/RAGPanel";
import { toast } from "sonner";
import { SidebarProvider } from "@/components/ui/sidebar";

const Chat = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [showRAGPanel, setShowRAGPanel] = useState(false);

  useEffect(() => {
    // Check authentication
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate("/auth");
      } else {
        setUser(session.user);
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        navigate("/auth");
      } else {
        setUser(session.user);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <SidebarProvider defaultOpen>
      <div className="min-h-screen h-screen flex w-full bg-white overflow-hidden">
        <Sidebar 
          selectedChatId={selectedChatId} 
          onSelectChat={setSelectedChatId}
          user={user}
        />
        
        <main className="flex-1 flex flex-col min-w-0">
          <ChatInterface 
            chatId={selectedChatId}
            onShowRAG={() => setShowRAGPanel(!showRAGPanel)}
            onChatCreated={(newChatId) => setSelectedChatId(newChatId)}
          />
        </main>

        {showRAGPanel && (
          <RAGPanel 
            chatId={selectedChatId}
            onClose={() => setShowRAGPanel(false)}
            onCreateChat={async () => {
              const { data: newChat, error } = await supabase
                .from('chats')
                .insert([{
                  title: 'New Chat',
                  user_id: user.id,
                }])
                .select()
                .single();

              if (error) throw error;
              setSelectedChatId(newChat.id);
              return newChat.id;
            }}
          />
        )}
      </div>
    </SidebarProvider>
  );
};

export default Chat;
