import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Upload, FileText, Loader2, CheckCircle, XCircle, MoreVertical, Eye, Trash, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DocumentViewer } from "./DocumentViewer";
import { DocumentCard } from "./DocumentCard";
import { ProcessingDetails } from "./ProcessingDetails";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface CollectionDetailProps {
  collectionId: string;
  onBack: () => void;
}

export const CollectionDetail = ({ collectionId, onBack }: CollectionDetailProps) => {
  const [collection, setCollection] = useState<any>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [viewingDocId, setViewingDocId] = useState<string | null>(null);
  const [expandedDocs, setExpandedDocs] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Get current user
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUser(data.user);
    });
    loadCollection();
    loadDocuments();

    // Subscribe to realtime updates for processing progress
    const channel = supabase
      .channel('rag-documents-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'rag_documents',
          filter: `collection_id=eq.${collectionId}`
        },
        (payload) => {
          console.log('Document updated:', payload);
          loadDocuments();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [collectionId]);

  const loadCollection = async () => {
    const { data, error } = await supabase
      .from('rag_collections')
      .select('*')
      .eq('id', collectionId)
      .single();

    if (error) {
      toast.error("Failed to load collection");
    } else {
      setCollection(data);
    }
  };

  const loadDocuments = async () => {
    const { data, error } = await supabase
      .from('rag_documents')
      .select('*')
      .eq('collection_id', collectionId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) {
      toast.error("Failed to load documents");
    } else {
      setDocuments(data || []);
    }
  };

  const handleDeleteDocument = async (docId: string) => {
    const { error } = await supabase
      .from('rag_documents')
      .update({ 
        deleted_at: new Date().toISOString(),
        original_collection_id: collectionId
      })
      .eq('id', docId);

    if (error) {
      toast.error("Failed to delete document");
    } else {
      toast.success("Document moved to deleted");
      loadDocuments();
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (!currentUser) {
      toast.error("Please log in to upload documents");
      return;
    }

    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        // Upload to storage
        const filePath = `${currentUser.id}/${collectionId}/${Date.now()}-${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from('documents')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        // Create document record
        const { data: newDoc, error: docError } = await supabase
          .from('rag_documents')
          .insert([{
            collection_id: collectionId,
            user_id: currentUser.id,
            file_name: file.name,
            file_path: filePath,
            mime_type: file.type,
            file_size: file.size,
            status: 'processing',
          }])
          .select()
          .single();

        if (docError) throw docError;

        // Trigger document processing
        const { error: processError } = await supabase.functions.invoke('process-document', {
          body: { documentId: newDoc.id }
        });

        if (processError) {
          console.error('Failed to trigger processing:', processError);
          toast.error("Document uploaded but processing failed");
        }
      }

      toast.success("Documents uploaded and processing started");
      loadDocuments();
    } catch (error: any) {
      toast.error(error.message || "Failed to upload documents");
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-success" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-destructive" />;
      case 'processing':
        return <Loader2 className="w-4 h-4 animate-spin text-info" />;
      default:
        return <FileText className="w-4 h-4 text-muted-foreground" />;
    }
  };

  if (!collection) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h2 className="text-2xl font-bold">{collection.name}</h2>
          {collection.description && (
            <p className="text-muted-foreground">{collection.description}</p>
          )}
        </div>
        <div>
          <input
            type="file"
            id="file-upload"
            className="hidden"
            multiple
            accept=".pdf,.txt,.md,.csv,.xlsx,.xls,.doc,.docx,.json,.xml,.html,.rtf"
            onChange={handleUpload}
            disabled={uploading}
          />
          <Button
            onClick={() => document.getElementById('file-upload')?.click()}
            disabled={uploading}
            className="gap-2"
          >
            {uploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                Upload Documents
              </>
            )}
          </Button>
        </div>
      </div>

      {documents.length === 0 ? (
        <Card className="p-12 text-center">
          <FileText className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No documents yet</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Upload documents to this collection for RAG
          </p>
          <Button
            onClick={() => document.getElementById('file-upload')?.click()}
            className="gap-2"
          >
            <Upload className="w-4 h-4" />
            Upload Documents
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {documents.map((doc) => {
            const progress = doc.processing_progress?.progress || 0;
            const isProcessing = doc.status === 'processing';
            const isExpanded = expandedDocs.has(doc.id);
            const isCompleted = doc.status === 'indexed';

            // Use DocumentCard for completed documents
            if (isCompleted) {
              return (
                <DocumentCard
                  key={doc.id}
                  document={{
                    id: doc.id,
                    file_name: doc.file_name,
                    file_path: doc.file_path,
                    file_size: doc.file_size,
                    collection_id: collectionId,
                  }}
                  onDelete={loadDocuments}
                />
              );
            }

            // Show processing/failed cards with original design
            return (
              <Card key={doc.id} className="p-4">
                <div className="flex items-start gap-3 mb-3">
                  {getStatusIcon(doc.status)}
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm truncate">{doc.file_name}</h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      {(doc.file_size / 1024).toFixed(1)} KB
                    </p>
                    {isProcessing && (
                      <div className="mt-2 space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">{progress}%</span>
                          <span className="text-muted-foreground">
                            {doc.processing_progress?.eta 
                              ? `ETA: ${doc.processing_progress.eta}s` 
                              : ''}
                          </span>
                        </div>
                        <Progress value={progress} className="h-1.5" />
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1">
                    {isProcessing && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => {
                          const newExpanded = new Set(expandedDocs);
                          if (isExpanded) {
                            newExpanded.delete(doc.id);
                          } else {
                            newExpanded.add(doc.id);
                          }
                          setExpandedDocs(newExpanded);
                        }}
                      >
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setViewingDocId(doc.id)}>
                          <Eye className="w-4 h-4 mr-2" />
                          View
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => handleDeleteDocument(doc.id)}
                          className="text-destructive"
                        >
                          <Trash className="w-4 h-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                {isProcessing && isExpanded && doc.processing_progress && (
                  <ProcessingDetails
                    progress={doc.processing_progress.progress || 0}
                    currentStep={doc.processing_progress.currentStep || ''}
                    eta={doc.processing_progress.eta}
                    steps={doc.processing_progress.steps || []}
                    processingTime={doc.processing_progress.processingTime}
                  />
                )}
              </Card>
            );
          })}
        </div>
      )}

      <DocumentViewer 
        documentId={viewingDocId} 
        onClose={() => setViewingDocId(null)} 
      />
    </div>
  );
};
