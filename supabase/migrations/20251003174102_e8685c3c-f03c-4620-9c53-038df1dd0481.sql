-- Add image metadata to rag_chunks
ALTER TABLE rag_chunks 
ADD COLUMN IF NOT EXISTS has_image boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS image_path text,
ADD COLUMN IF NOT EXISTS image_caption text;

-- Create storage bucket for extracted document images
INSERT INTO storage.buckets (id, name, public)
VALUES ('document-images', 'document-images', false)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for document-images bucket
CREATE POLICY "Users can view their own document images"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'document-images' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "System can insert document images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'document-images');

CREATE POLICY "Users can delete their own document images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'document-images'
  AND auth.uid()::text = (storage.foldername(name))[1]
);