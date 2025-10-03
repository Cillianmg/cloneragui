import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Palmtree } from "lucide-react";
import { ModelSettings } from "@/components/settings/ModelSettings";
import { RAGSettings } from "@/components/settings/RAGSettings";
import { EmbeddingProviders } from "@/components/settings/EmbeddingProviders";
import { WebSearchProviders } from "@/components/settings/WebSearchProviders";
import { ProfileSettings } from "@/components/settings/ProfileSettings";
import { ArchivedChats } from "@/components/settings/ArchivedChats";


const Settings = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-200 bg-white">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/chat")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <Palmtree className="w-5 h-5 text-gray-800" />
            <h1 className="text-2xl flex items-center gap-2">
              <span className="font-light text-gray-800">Isola AI</span>
              <span className="font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Secure RAG</span>
            </h1>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        <Tabs defaultValue="models" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5 max-w-4xl">
            <TabsTrigger value="models">Models</TabsTrigger>
            <TabsTrigger value="rag">RAG</TabsTrigger>
            <TabsTrigger value="search">Web Search</TabsTrigger>
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="archived">Archived</TabsTrigger>
          </TabsList>

          <TabsContent value="models" className="space-y-4">
            <ModelSettings user={user} />
          </TabsContent>

          <TabsContent value="rag" className="space-y-4">
            <RAGSettings />
            <EmbeddingProviders />
          </TabsContent>

          <TabsContent value="search" className="space-y-4">
            <WebSearchProviders />
          </TabsContent>

          <TabsContent value="profile" className="space-y-4">
            <ProfileSettings user={user} />
          </TabsContent>

          <TabsContent value="archived" className="space-y-4">
            <ArchivedChats />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Settings;
