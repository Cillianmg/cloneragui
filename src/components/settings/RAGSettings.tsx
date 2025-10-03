import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Database, Info, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const DEFAULT_SETTINGS = {
  chunk_size: 800,
  chunk_overlap: 100,
  top_k_results: 10,
  match_threshold: 0.2,
  embedding_model: 'text-embedding-3-small',
};

const SETTING_INFO = {
  chunk_size: {
    label: "Chunk Size (tokens)",
    description: "Size of text chunks for processing. Larger chunks retain more context but may be less precise. Range: 200-2000. Effect: Higher = more context, lower = more precision.",
  },
  chunk_overlap: {
    label: "Chunk Overlap (tokens)",
    description: "Overlap between consecutive chunks to maintain context continuity. Range: 50-200. Effect: Higher = better context preservation, lower = less redundancy.",
  },
  top_k_results: {
    label: "Top K Results",
    description: "Number of most relevant chunks to retrieve per query. Range: 3-20. Effect: Higher = more context for AI, lower = faster & more focused.",
  },
  match_threshold: {
    label: "Match Threshold",
    description: "Minimum similarity score (0-1) for chunks to be included. Range: 0.1-0.5. Effect: Higher = stricter matching, lower = broader results.",
  },
  embedding_model: {
    label: "Embedding Model",
    description: "OpenAI model used for generating embeddings. text-embedding-3-small is fast and cost-effective. text-embedding-3-large provides higher accuracy.",
  },
};

export const RAGSettings = () => {
  const { toast } = useToast();
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('rag_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      
      if (data) {
        setSettings({
          chunk_size: data.chunk_size,
          chunk_overlap: data.chunk_overlap,
          top_k_results: data.top_k_results,
          match_threshold: data.match_threshold,
          embedding_model: data.embedding_model,
        });
      }
    } catch (error) {
      console.error('Error loading RAG settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('rag_settings')
        .upsert({
          user_id: user.id,
          ...settings,
        }, {
          onConflict: 'user_id'
        });

      if (error) throw error;

      toast({
        title: "Settings saved",
        description: "Your RAG configuration has been updated.",
      });
    } catch (error) {
      console.error('Error saving RAG settings:', error);
      toast({
        title: "Error",
        description: "Failed to save settings. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const restoreDefaults = () => {
    setSettings(DEFAULT_SETTINGS);
    toast({
      title: "Defaults restored",
      description: "Settings have been reset to default values. Click Save to apply.",
    });
  };

  const handleChange = (key: keyof typeof settings, value: string | number) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return <div className="text-center p-4">Loading settings...</div>;
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="w-5 h-5 text-primary" />
            Global RAG Configuration
          </CardTitle>
          <CardDescription>
            Configure how documents are processed and retrieved across all collections
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <TooltipProvider>
            <div className="space-y-4">
              {/* Chunk Size */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  {SETTING_INFO.chunk_size.label}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="w-4 h-4 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p>{SETTING_INFO.chunk_size.description}</p>
                    </TooltipContent>
                  </Tooltip>
                </Label>
                <Input
                  type="number"
                  value={settings.chunk_size}
                  onChange={(e) => handleChange('chunk_size', parseInt(e.target.value))}
                  min={200}
                  max={2000}
                />
              </div>

              {/* Chunk Overlap */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  {SETTING_INFO.chunk_overlap.label}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="w-4 h-4 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p>{SETTING_INFO.chunk_overlap.description}</p>
                    </TooltipContent>
                  </Tooltip>
                </Label>
                <Input
                  type="number"
                  value={settings.chunk_overlap}
                  onChange={(e) => handleChange('chunk_overlap', parseInt(e.target.value))}
                  min={50}
                  max={200}
                />
              </div>

              {/* Top K Results */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  {SETTING_INFO.top_k_results.label}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="w-4 h-4 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p>{SETTING_INFO.top_k_results.description}</p>
                    </TooltipContent>
                  </Tooltip>
                </Label>
                <Input
                  type="number"
                  value={settings.top_k_results}
                  onChange={(e) => handleChange('top_k_results', parseInt(e.target.value))}
                  min={3}
                  max={20}
                />
              </div>

              {/* Match Threshold */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  {SETTING_INFO.match_threshold.label}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="w-4 h-4 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p>{SETTING_INFO.match_threshold.description}</p>
                    </TooltipContent>
                  </Tooltip>
                </Label>
                <Input
                  type="number"
                  step="0.05"
                  value={settings.match_threshold}
                  onChange={(e) => handleChange('match_threshold', parseFloat(e.target.value))}
                  min={0.1}
                  max={0.5}
                />
              </div>

              {/* Embedding Model - now managed in Embedding Providers */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  Embedding Model
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="w-4 h-4 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p>Embedding providers are now managed in the Embedding Providers section below. This field shows the current default model.</p>
                    </TooltipContent>
                  </Tooltip>
                </Label>
                <Input
                  value={settings.embedding_model}
                  disabled
                  placeholder="Managed in Embedding Providers"
                  className="opacity-60"
                />
                <p className="text-xs text-muted-foreground">
                  Configure embedding providers in the section below
                </p>
              </div>
            </div>
          </TooltipProvider>

          <div className="flex gap-2 pt-4">
            <Button onClick={saveSettings} disabled={saving}>
              {saving ? "Saving..." : "Save Settings"}
            </Button>
            <Button onClick={restoreDefaults} variant="outline">
              <RotateCcw className="w-4 h-4 mr-2" />
              Restore Defaults
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
