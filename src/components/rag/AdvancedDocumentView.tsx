import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Download, Search, Grid3x3, List, Image } from "lucide-react";
import { toast } from "sonner";

interface AdvancedDocumentViewProps {
  documentId: string;
  onClose: () => void;
}

export const AdvancedDocumentView = ({ documentId, onClose }: AdvancedDocumentViewProps) => {
  const [loading, setLoading] = useState(true);
  const [documentStatus, setDocumentStatus] = useState<any>(null);
  const [chunks, setChunks] = useState<any[]>([]);
  const [queryText, setQueryText] = useState("");
  const [queryResults, setQueryResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [imageChunks, setImageChunks] = useState<any[]>([]);
  const [loadingImages, setLoadingImages] = useState(false);
  const [imagesLoaded, setImagesLoaded] = useState(false);
  const [imageViewMode, setImageViewMode] = useState<'list' | 'tiles'>('tiles');
  const [imageUrls, setImageUrls] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    loadDocumentStatus();
    loadChunks();
  }, [documentId]);

  const loadDocumentStatus = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('document-status', {
        body: { documentId }
      });

      if (error) throw error;
      setDocumentStatus(data);
    } catch (error: any) {
      toast.error('Failed to load document status');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const loadChunks = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('document-chunks', {
        body: { documentId }
      });

      if (error) throw error;
      setChunks(data.chunks || []);
    } catch (error: any) {
      toast.error('Failed to load chunks');
      console.error(error);
    }
  };

  const handleSearch = async () => {
    if (!queryText.trim()) return;
    
    setSearching(true);
    try {
      const { data, error } = await supabase.functions.invoke('document-query', {
        body: { documentId, query: queryText, topK: 5 }
      });

      if (error) throw error;
      setQueryResults(data.results || []);
    } catch (error: any) {
      toast.error('Search failed');
      console.error(error);
    } finally {
      setSearching(false);
    }
  };

  const loadImages = async () => {
    if (imagesLoaded) return;
    
    setLoadingImages(true);
    try {
      const { data, error } = await supabase
        .from('rag_chunks')
        .select('id, chunk_index, has_image, image_path, image_caption, content')
        .eq('document_id', documentId)
        .eq('has_image', true)
        .order('chunk_index');

      if (error) throw error;
      setImageChunks(data || []);
      
      // Load signed URLs for all images
      if (data && data.length > 0) {
        const urlMap = new Map<string, string>();
        await Promise.all(
          data.map(async (chunk) => {
            if (chunk.image_path) {
              const { data: signedUrl } = await supabase.storage
                .from('document-images')
                .createSignedUrl(chunk.image_path, 3600);
              
              if (signedUrl?.signedUrl) {
                urlMap.set(chunk.image_path, signedUrl.signedUrl);
              }
            }
          })
        );
        setImageUrls(urlMap);
      }
      
      setImagesLoaded(true);
    } catch (error: any) {
      toast.error('Failed to load images');
      console.error(error);
    } finally {
      setLoadingImages(false);
    }
  };

  const exportChunks = () => {
    const csv = [
      ['Chunk ID', 'Index', 'Token Length', 'Content Preview'],
      ...chunks.map(c => [c.id, c.chunkIndex, c.tokenLength, c.contentPreview])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chunks-${documentId}.csv`;
    a.click();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Advanced Document View</h2>
        <Button variant="ghost" onClick={onClose}>Close</Button>
      </div>

      <Tabs defaultValue="metadata" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="metadata">Metadata</TabsTrigger>
          <TabsTrigger value="chunks">Chunks</TabsTrigger>
          <TabsTrigger value="images" onClick={loadImages}>Images</TabsTrigger>
          <TabsTrigger value="vector">Vector DB</TabsTrigger>
          <TabsTrigger value="query">Query Playground</TabsTrigger>
        </TabsList>

        <TabsContent value="metadata" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Document Metadata</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Document ID</p>
                  <p className="font-mono text-xs">{documentStatus?.document.id}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <Badge>{documentStatus?.document.status}</Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">File Name</p>
                  <p className="text-sm">{documentStatus?.document.fileName}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">File Size</p>
                  <p className="text-sm">{(documentStatus?.document.fileSize / 1024).toFixed(2)} KB</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Collection</p>
                  <p className="text-sm">{documentStatus?.document.collectionName}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Created At</p>
                  <p className="text-sm">{new Date(documentStatus?.document.createdAt).toLocaleString()}</p>
                </div>
              </div>
              {documentStatus?.document.errorMessage && (
                <div className="mt-4 p-3 bg-destructive/10 rounded-md">
                  <p className="text-sm text-destructive">{documentStatus.document.errorMessage}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="chunks" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Chunk Explorer</CardTitle>
              <CardDescription>
                Total chunks: {chunks.length}
                <Button variant="outline" size="sm" className="ml-4" onClick={exportChunks}>
                  <Download className="w-4 h-4 mr-2" />
                  Export CSV
                </Button>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Index</TableHead>
                      <TableHead>Token Length</TableHead>
                      <TableHead>Content Preview</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {chunks.map((chunk) => (
                      <TableRow key={chunk.id}>
                        <TableCell>{chunk.chunkIndex}</TableCell>
                        <TableCell>{chunk.tokenLength}</TableCell>
                        <TableCell className="max-w-md truncate">{chunk.contentPreview}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="images" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Extracted Images</CardTitle>
                  <CardDescription>
                    {imageChunks.length} image{imageChunks.length !== 1 ? 's' : ''} found in this document
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant={imageViewMode === 'tiles' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setImageViewMode('tiles')}
                  >
                    <Grid3x3 className="w-4 h-4" />
                  </Button>
                  <Button
                    variant={imageViewMode === 'list' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setImageViewMode('list')}
                  >
                    <List className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loadingImages ? (
                <div className="flex items-center justify-center p-12">
                  <Loader2 className="w-8 h-8 animate-spin" />
                </div>
              ) : imageChunks.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-12 text-center">
                  <Image className="w-12 h-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No images found in this document</p>
                </div>
              ) : imageViewMode === 'tiles' ? (
                <ScrollArea className="h-[600px]">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-2">
                    {imageChunks.map((chunk) => {
                      const imageUrl = chunk.image_path ? imageUrls.get(chunk.image_path) : null;
                      return (
                        <Card key={chunk.id} className="overflow-hidden">
                          <div className="aspect-square bg-gray-100 relative group">
                            {imageUrl ? (
                              <>
                                <img
                                  src={imageUrl}
                                  alt={chunk.image_caption || `Image ${chunk.chunk_index}`}
                                  className="w-full h-full object-contain"
                                  loading="lazy"
                                />
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => window.open(imageUrl, '_blank')}
                                  >
                                    View Full Size
                                  </Button>
                                </div>
                              </>
                            ) : (
                              <div className="flex items-center justify-center h-full">
                                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                              </div>
                            )}
                          </div>
                          <CardContent className="p-3">
                            <p className="text-xs text-muted-foreground mb-1">
                              Image {chunk.chunk_index + 1}
                            </p>
                            {chunk.image_caption && (
                              <p className="text-sm line-clamp-2">{chunk.image_caption}</p>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </ScrollArea>
              ) : (
                <ScrollArea className="h-[600px]">
                  <div className="space-y-4 p-2">
                    {imageChunks.map((chunk) => {
                      const imageUrl = chunk.image_path ? imageUrls.get(chunk.image_path) : null;
                      return (
                        <Card key={chunk.id}>
                          <CardContent className="p-4">
                            <div className="flex gap-4">
                              <div className="w-32 h-32 flex-shrink-0 bg-gray-100 rounded overflow-hidden">
                                {imageUrl ? (
                                  <img
                                    src={imageUrl}
                                    alt={chunk.image_caption || `Image ${chunk.chunk_index}`}
                                    className="w-full h-full object-cover cursor-pointer"
                                    loading="lazy"
                                    onClick={() => window.open(imageUrl, '_blank')}
                                  />
                                ) : (
                                  <div className="flex items-center justify-center h-full">
                                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                                  </div>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-2">
                                  <Badge variant="outline">Image {chunk.chunk_index + 1}</Badge>
                                  {imageUrl && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => window.open(imageUrl, '_blank')}
                                    >
                                      <Download className="w-4 h-4 mr-2" />
                                      View
                                    </Button>
                                  )}
                                </div>
                                {chunk.image_caption && (
                                  <div className="space-y-1">
                                    <p className="text-xs text-muted-foreground font-medium">Caption:</p>
                                    <p className="text-sm">{chunk.image_caption}</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="vector" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Vector Database Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Total Chunks Indexed</p>
                  <p className="text-2xl font-bold">{documentStatus?.vectorStats.totalChunks}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Avg Chunk Length</p>
                  <p className="text-2xl font-bold">{documentStatus?.vectorStats.avgChunkLength}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Embedding Dimensions</p>
                  <p className="text-2xl font-bold">{documentStatus?.vectorStats.embeddingDimensions}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Index Type</p>
                  <Badge variant="secondary">{documentStatus?.vectorStats.indexType}</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="query" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Query Playground</CardTitle>
              <CardDescription>Test semantic search on this document</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Enter your search query..."
                  value={queryText}
                  onChange={(e) => setQueryText(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                />
                <Button onClick={handleSearch} disabled={searching}>
                  {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                </Button>
              </div>

              {queryResults.length > 0 && (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">Top {queryResults.length} results:</p>
                  {queryResults.map((result, idx) => (
                    <Card key={result.id}>
                      <CardContent className="pt-4">
                        <div className="flex items-center justify-between mb-2">
                          <Badge variant="outline">Chunk {result.chunkIndex}</Badge>
                          <span className="text-sm text-muted-foreground">
                            Similarity: {(result.similarity * 100).toFixed(1)}%
                          </span>
                        </div>
                        <p className="text-sm">{result.contentPreview}...</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
