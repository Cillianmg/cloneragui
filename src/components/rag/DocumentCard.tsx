import { useState } from "react";
import { FileText, Download, Eye, Code, MoreVertical, Trash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AdvancedDocumentView } from "./AdvancedDocumentView";

interface DocumentCardProps {
  document: {
    id: string;
    file_name: string;
    file_path: string;
    file_size: number;
    collection_id?: string;
  };
  onDelete?: (docId: string) => void;
}

export const DocumentCard = ({ document, onDelete }: DocumentCardProps) => {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const handleDownload = async () => {
    try {
      const { data, error } = await supabase.storage
        .from('documents')
        .createSignedUrl(document.file_path, 3600);

      if (error) throw error;
      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank');
      }
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Failed to download document');
    }
  };

  const handleView = async () => {
    try {
      const { data, error } = await supabase.storage
        .from('documents')
        .createSignedUrl(document.file_path, 3600);

      if (error) throw error;
      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank');
      }
    } catch (error) {
      console.error('View error:', error);
      toast.error('Failed to view document');
    }
  };

  const handleDelete = async () => {
    if (!document.collection_id) {
      toast.error("Cannot delete: collection ID missing");
      return;
    }

    try {
      const { error } = await supabase
        .from('rag_documents')
        .update({ 
          deleted_at: new Date().toISOString(),
          original_collection_id: document.collection_id
        })
        .eq('id', document.id);

      if (error) throw error;
      
      toast.success("Document moved to deleted");
      if (onDelete) {
        onDelete(document.id);
      }
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('Failed to delete document');
    }
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <FileText className="w-6 h-6 text-primary" />
          </div>
          
          <div className="flex-1 min-w-0">
            <h3 className="font-medium truncate">{document.file_name}</h3>
            <p className="text-sm text-muted-foreground">{formatFileSize(document.file_size)}</p>
          </div>

          <div className="flex gap-1">
            <Button variant="ghost" size="icon" onClick={handleView} title="View">
              <Eye className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={handleDownload} title="Download">
              <Download className="w-4 h-4" />
            </Button>
            
            <Sheet open={showAdvanced} onOpenChange={setShowAdvanced}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" title="Advanced View">
                  <Code className="w-4 h-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-full sm:max-w-3xl overflow-y-auto">
                <SheetHeader>
                  <SheetTitle>Advanced Document View</SheetTitle>
                </SheetHeader>
                <div className="mt-6">
                  <AdvancedDocumentView 
                    documentId={document.id}
                    onClose={() => setShowAdvanced(false)}
                  />
                </div>
              </SheetContent>
            </Sheet>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" title="More options">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-white z-50">
                <DropdownMenuItem 
                  onClick={handleDelete}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash className="w-4 h-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
