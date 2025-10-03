import { cn } from "@/lib/utils";
import { User, Sparkles, FileDown, FileText, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useState } from "react";

interface SourceDocument {
  id: string;
  name: string;
  size: number;
  downloadUrl?: string;
  hasImage?: boolean;
  imagePath?: string;
  imageCaption?: string;
}

interface MessageBubbleProps {
  message: {
    role: string;
    content: string;
    created_at: string;
  };
  sources?: SourceDocument[];
}

export const MessageBubble = ({ message, sources }: MessageBubbleProps) => {
  const isUser = message.role === 'user';
  const [imageUrls, setImageUrls] = useState<Map<string, string>>(new Map());

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const loadImage = async (imagePath: string) => {
    if (imageUrls.has(imagePath)) return;
    
    const { data } = await supabase.storage
      .from('document-images')
      .createSignedUrl(imagePath, 3600);
    
    if (data?.signedUrl) {
      setImageUrls(new Map(imageUrls.set(imagePath, data.signedUrl)));
    }
  };

  return (
    <div
      className={cn(
        "flex gap-3 animate-fade-in",
        isUser ? "justify-end" : "justify-start"
      )}
    >
      {!isUser && (
        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Sparkles className="w-3.5 h-3.5 text-primary" />
        </div>
      )}
      
      <div className="flex flex-col gap-2 max-w-[70%]">
        <div
          className={cn(
            "rounded-2xl px-4 py-2.5 text-[15px]",
            isUser
              ? "bg-gray-100 text-gray-900"
              : "bg-white border border-gray-200 text-gray-900"
          )}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap break-words leading-relaxed">{message.content}</p>
          ) : (
            <div className="prose prose-sm max-w-none text-gray-900
              prose-headings:font-semibold prose-headings:text-gray-900 prose-headings:tracking-tight
              prose-h1:text-2xl prose-h1:font-bold prose-h1:mb-4 prose-h1:mt-6 prose-h1:leading-tight
              prose-h2:text-xl prose-h2:font-semibold prose-h2:mb-4 prose-h2:mt-6 prose-h2:leading-snug
              prose-h3:text-lg prose-h3:font-semibold prose-h3:mb-3 prose-h3:mt-5
              prose-p:leading-relaxed prose-p:my-4 prose-p:text-gray-800
              prose-strong:font-semibold prose-strong:text-gray-900
              prose-ul:my-4 prose-ul:list-disc prose-ul:pl-6
              prose-ol:my-4 prose-ol:list-decimal prose-ol:pl-6
              prose-li:leading-relaxed prose-li:text-gray-800
              prose-li:pl-2 prose-li:mb-6 [&_li]:mb-6
              prose-blockquote:border-l-4 prose-blockquote:border-gray-300 prose-blockquote:pl-4 prose-blockquote:italic prose-blockquote:my-4
              prose-code:bg-gray-100 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:font-mono
              prose-pre:bg-gray-100 prose-pre:p-4 prose-pre:rounded-lg prose-pre:my-4 prose-pre:overflow-x-auto
              prose-a:text-primary prose-a:underline prose-a:font-medium
              [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
              <ReactMarkdown 
                remarkPlugins={[remarkGfm]}
                components={{
                  a: ({ node, ...props }) => (
                    <a {...props} target="_blank" rel="noopener noreferrer" />
                  )
                }}
              >
                {message.content}
              </ReactMarkdown>
            </div>
          )}
        </div>

        {!isUser && sources && sources.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground px-1">Sources:</p>
            {sources.map((source) => {
              if (source.hasImage && source.imagePath) {
                loadImage(source.imagePath);
              }
              
              return (
                <div
                  key={source.id}
                  className="flex flex-col gap-2 bg-gray-50/50 border border-gray-200 rounded-lg p-3"
                >
                  <div className="flex items-center gap-2">
                    {source.hasImage ? (
                      <ImageIcon className="w-4 h-4 text-primary flex-shrink-0" />
                    ) : (
                      <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{source.name}</p>
                      <p className="text-xs text-muted-foreground">{formatFileSize(source.size)}</p>
                    </div>
                    {source.downloadUrl && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => window.open(source.downloadUrl, '_blank')}
                      >
                        <FileDown className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                  
                  {source.hasImage && source.imagePath && imageUrls.get(source.imagePath) && (
                    <div className="space-y-1">
                      <img 
                        src={imageUrls.get(source.imagePath)} 
                        alt={source.imageCaption || 'Document image'}
                        className="rounded border border-gray-200 w-full max-w-xs"
                      />
                      {source.imageCaption && (
                        <p className="text-xs text-muted-foreground italic">{source.imageCaption}</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {isUser && (
        <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
          <User className="w-3.5 h-3.5 text-gray-700" />
        </div>
      )}
    </div>
  );
};
