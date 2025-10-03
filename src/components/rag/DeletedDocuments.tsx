import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FileText, Loader2, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const DeletedDocuments = () => {
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<any>(null);

  useEffect(() => {
    loadDeletedDocuments();
  }, []);

  const loadDeletedDocuments = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('rag_documents')
      .select('*, rag_collections(name)')
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false });

    if (error) {
      toast.error("Failed to load deleted documents");
    } else {
      setDocuments(data || []);
    }
    setLoading(false);
  };

  const handleRestore = async (doc: any) => {
    try {
      // Restore document and set status to processing
      const { error: updateError } = await supabase
        .from('rag_documents')
        .update({ 
          deleted_at: null,
          collection_id: doc.original_collection_id || doc.collection_id,
          status: 'processing',
          error_message: null,
          processing_progress: {
            currentStep: 'Starting',
            progress: 0,
            eta: null,
            steps: []
          }
        })
        .eq('id', doc.id);

      if (updateError) throw updateError;

      // Trigger reprocessing
      const { error: processError } = await supabase.functions.invoke('process-document', {
        body: { documentId: doc.id }
      });

      if (processError) {
        console.error('Failed to trigger reprocessing:', processError);
        toast.error("Document restored but reprocessing failed");
      } else {
        toast.success("Document restored and reprocessing started");
      }

      loadDeletedDocuments();
    } catch (error: any) {
      toast.error("Failed to restore document");
      console.error(error);
    }
  };

  const handlePermanentDelete = async () => {
    if (!selectedDoc) return;

    // Delete from storage
    const { error: storageError } = await supabase.storage
      .from('documents')
      .remove([selectedDoc.file_path]);

    if (storageError) {
      console.error('Failed to delete from storage:', storageError);
    }

    // Delete from database
    const { error } = await supabase
      .from('rag_documents')
      .delete()
      .eq('id', selectedDoc.id);

    if (error) {
      toast.error("Failed to permanently delete document");
    } else {
      toast.success("Document permanently deleted");
      setDeleteDialogOpen(false);
      setSelectedDoc(null);
      loadDeletedDocuments();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <Card className="p-12 text-center">
        <Trash2 className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-2">No deleted documents</h3>
        <p className="text-sm text-muted-foreground">
          Deleted documents will appear here
        </p>
      </Card>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {documents.map((doc) => (
          <Card key={doc.id} className="p-4">
            <div className="flex items-start gap-3 mb-3">
              <FileText className="w-4 h-4 text-muted-foreground mt-1" />
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-sm truncate">{doc.file_name}</h4>
                <p className="text-xs text-muted-foreground mt-1">
                  From: {doc.rag_collections?.name || 'Unknown'}
                </p>
                <p className="text-xs text-muted-foreground">
                  Deleted: {new Date(doc.deleted_at).toLocaleDateString()}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleRestore(doc)}
                className="flex-1"
              >
                <RotateCcw className="w-3 h-3 mr-1" />
                Restore
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  setSelectedDoc(doc);
                  setDeleteDialogOpen(true);
                }}
                className="flex-1"
              >
                <Trash2 className="w-3 h-3 mr-1" />
                Delete
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Permanently delete document?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the document
              and all associated data from storage.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handlePermanentDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete Permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
