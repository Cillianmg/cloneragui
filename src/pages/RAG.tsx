import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { CollectionsList } from "@/components/rag/CollectionsList";
import { CollectionDetail } from "@/components/rag/CollectionDetail";
import { DeletedDocuments } from "@/components/rag/DeletedDocuments";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Palmtree } from "lucide-react";

const RAG = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);

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
        {selectedCollectionId ? (
          <CollectionDetail
            collectionId={selectedCollectionId}
            onBack={() => setSelectedCollectionId(null)}
          />
        ) : (
          <Tabs defaultValue="collections" className="w-full">
            <TabsList>
              <TabsTrigger value="collections">Collections</TabsTrigger>
              <TabsTrigger value="deleted">Deleted</TabsTrigger>
            </TabsList>
            <TabsContent value="collections" className="mt-6">
              <CollectionsList onSelectCollection={setSelectedCollectionId} />
            </TabsContent>
            <TabsContent value="deleted" className="mt-6">
              <DeletedDocuments />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
};

export default RAG;
