import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { X, Database } from "lucide-react";
import { toast } from "sonner";

interface RAGPanelProps {
  chatId: string | null;
  onClose: () => void;
  onCreateChat?: () => Promise<string>;
}

export const RAGPanel = ({ chatId, onClose, onCreateChat }: RAGPanelProps) => {
  const [collections, setCollections] = useState<any[]>([]);
  const [selectedCollections, setSelectedCollections] = useState<string[]>([]);

  useEffect(() => {
    loadCollections();
    if (chatId) {
      loadChatCollections();
    }
  }, [chatId]);

  const loadCollections = async () => {
    const { data, error } = await supabase
      .from('rag_collections')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      toast.error("Failed to load collections");
    } else {
      setCollections(data || []);
    }
  };

  const loadChatCollections = async () => {
    if (!chatId) return;

    const { data, error } = await supabase
      .from('chat_collections')
      .select('collection_id')
      .eq('chat_id', chatId);

    if (error) {
      toast.error("Failed to load chat collections");
    } else {
      setSelectedCollections(data?.map(c => c.collection_id) || []);
    }
  };

  const toggleCollection = async (collectionId: string) => {
    let currentChatId = chatId;
    
    // Create chat if it doesn't exist
    if (!currentChatId && onCreateChat) {
      try {
        currentChatId = await onCreateChat();
      } catch (error) {
        toast.error("Failed to create chat");
        return;
      }
    }

    if (!currentChatId) {
      toast.error("Please select or create a chat first");
      return;
    }

    const isSelected = selectedCollections.includes(collectionId);

    if (isSelected) {
      const { error } = await supabase
        .from('chat_collections')
        .delete()
        .eq('chat_id', currentChatId)
        .eq('collection_id', collectionId);

      if (error) {
        toast.error("Failed to remove collection");
      } else {
        setSelectedCollections(prev => prev.filter(id => id !== collectionId));
        toast.success("Collection removed from chat");
      }
    } else {
      // Check if already exists before inserting
      const { data: existing } = await supabase
        .from('chat_collections')
        .select('id')
        .eq('chat_id', currentChatId)
        .eq('collection_id', collectionId)
        .maybeSingle();

      if (existing) {
        // Already exists, just update local state
        setSelectedCollections(prev => [...prev, collectionId]);
        toast.success("Collection already linked to chat");
        return;
      }

      const { error } = await supabase
        .from('chat_collections')
        .insert({
          chat_id: currentChatId,
          collection_id: collectionId,
        });

      if (error) {
        console.error("Failed to add collection:", error);
        toast.error("Failed to add collection");
      } else {
        setSelectedCollections(prev => [...prev, collectionId]);
        toast.success("Collection added to chat");
      }
    }
  };

  return (
    <div className="w-80 border-l border-gray-200 bg-white flex flex-col h-screen">
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Database className="w-5 h-5 text-primary" />
          <h3 className="font-semibold">RAG Collections</h3>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1 p-4">
        {collections.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Database className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No collections yet</p>
            <p className="text-xs mt-1">Create collections in RAG Workspace</p>
          </div>
        ) : (
          <div className="space-y-3">
            {collections.map((collection) => (
              <div
                key={collection.id}
                className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-secondary/50 transition-colors cursor-pointer"
                onClick={() => toggleCollection(collection.id)}
              >
                <Checkbox
                  checked={selectedCollections.includes(collection.id)}
                  onCheckedChange={() => toggleCollection(collection.id)}
                />
                <div className="flex-1">
                  <h4 className="font-medium text-sm">{collection.name}</h4>
                  {collection.description && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {collection.description}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
};
