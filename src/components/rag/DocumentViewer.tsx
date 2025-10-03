import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface DocumentViewerProps {
  documentId: string | null;
  onClose: () => void;
}

export const DocumentViewer = ({ documentId, onClose }: DocumentViewerProps) => {
  const [loading, setLoading] = useState(true);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [document, setDocument] = useState<any>(null);

  useEffect(() => {
    if (documentId) {
      loadDocument();
    }
  }, [documentId]);

  const loadDocument = async () => {
    if (!documentId) return;

    setLoading(true);
    
    // Get document info
    const { data: doc, error: docError } = await supabase
      .from('rag_documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (docError) {
      toast.error("Failed to load document");
      onClose();
      return;
    }

    setDocument(doc);

    // Get signed URL for the file
    const { data: urlData, error: urlError } = await supabase.storage
      .from('documents')
      .createSignedUrl(doc.file_path, 3600); // 1 hour expiry

    if (urlError) {
      toast.error("Failed to load document URL");
      onClose();
      return;
    }

    setPdfUrl(urlData.signedUrl);
    setLoading(false);
  };

  return (
    <Dialog open={!!documentId} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-4xl h-[80vh]">
        <DialogHeader>
          <DialogTitle>{document?.file_name}</DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="flex-1 overflow-hidden">
            <iframe
              src={pdfUrl || ''}
              className="w-full h-full border-0"
              title={document?.file_name}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
