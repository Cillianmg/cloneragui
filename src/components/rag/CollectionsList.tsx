import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { PlusCircle, FolderOpen, FileText } from "lucide-react";
import { toast } from "sonner";

interface CollectionsListProps {
  onSelectCollection: (id: string) => void;
}

export const CollectionsList = ({ onSelectCollection }: CollectionsListProps) => {
  const [collections, setCollections] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    // Get current user
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUser(data.user);
    });
    loadCollections();
  }, []);

  const loadCollections = async () => {
    const { data, error } = await supabase
      .from('rag_collections')
      .select(`
        *,
        documents:rag_documents(count)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      toast.error("Failed to load collections");
    } else {
      setCollections(data || []);
    }
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error("Please enter a collection name");
      return;
    }

    if (!currentUser) {
      toast.error("Please log in to create collections");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('rag_collections')
        .insert([{
          name: name.trim(),
          description: description.trim() || null,
          user_id: currentUser.id,
        }]);

      if (error) throw error;

      toast.success("Collection created");
      setOpen(false);
      setName("");
      setDescription("");
      loadCollections();
    } catch (error: any) {
      toast.error(error.message || "Failed to create collection");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Collections</h2>
          <p className="text-muted-foreground">
            Organize your documents into collections for RAG
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <PlusCircle className="w-4 h-4" />
              New Collection
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Collection</DialogTitle>
              <DialogDescription>
                Create a new collection to organize your documents
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="My Knowledge Base"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description (Optional)</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Documents about..."
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={loading}>
                {loading ? "Creating..." : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {collections.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FolderOpen className="w-16 h-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No collections yet</h3>
            <p className="text-sm text-muted-foreground mb-4 text-center max-w-sm">
              Create your first collection to start organizing documents for RAG
            </p>
            <Button onClick={() => setOpen(true)} className="gap-2">
              <PlusCircle className="w-4 h-4" />
              Create Collection
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {collections.map((collection) => (
            <Card
              key={collection.id}
              className="cursor-pointer hover:bg-card-hover transition-colors"
              onClick={() => onSelectCollection(collection.id)}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <FolderOpen className="w-5 h-5 text-primary" />
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <FileText className="w-4 h-4" />
                    <span>{collection.documents?.[0]?.count || 0}</span>
                  </div>
                </div>
                <CardTitle className="mt-2">{collection.name}</CardTitle>
                {collection.description && (
                  <CardDescription className="line-clamp-2">
                    {collection.description}
                  </CardDescription>
                )}
              </CardHeader>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
