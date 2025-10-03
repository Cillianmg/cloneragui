import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, Star, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface EmbeddingProvider {
  id: string;
  provider_name: string;
  display_name: string;
  api_key: string;
  base_url: string;
  model_id: string;
  is_default: boolean;
  is_enabled: boolean;
}

const PRESET_PROVIDERS = [
  {
    name: 'openai',
    display: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'text-embedding-3-small',
  },
  {
    name: 'google',
    display: 'Google AI',
    baseUrl: 'https://generativelanguage.googleapis.com/v1',
    defaultModel: 'text-embedding-004',
  },
  {
    name: 'cohere',
    display: 'Cohere',
    baseUrl: 'https://api.cohere.ai/v1',
    defaultModel: 'embed-english-v3.0',
  },
  {
    name: 'custom',
    display: 'Custom Provider',
    baseUrl: '',
    defaultModel: '',
  },
];

export const EmbeddingProviders = () => {
  const { toast } = useToast();
  const [providers, setProviders] = useState<EmbeddingProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState<EmbeddingProvider | null>(null);
  
  // Form state
  const [selectedPreset, setSelectedPreset] = useState('openai');
  const [formData, setFormData] = useState({
    display_name: '',
    api_key: '',
    base_url: '',
    model_id: '',
  });

  useEffect(() => {
    loadProviders();
  }, []);

  useEffect(() => {
    const preset = PRESET_PROVIDERS.find(p => p.name === selectedPreset);
    if (preset && !editingProvider) {
      setFormData(prev => ({
        ...prev,
        display_name: preset.display,
        base_url: preset.baseUrl,
        model_id: preset.defaultModel,
      }));
    }
  }, [selectedPreset, editingProvider]);

  const loadProviders = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('embedding_providers')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

      if (error) throw error;

      setProviders(data || []);
    } catch (error) {
      console.error('Error loading providers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      if (!formData.display_name || !formData.api_key || !formData.base_url || !formData.model_id) {
        toast({
          title: "Validation error",
          description: "All fields are required",
          variant: "destructive",
        });
        return;
      }

      if (editingProvider) {
        const { error } = await supabase
          .from('embedding_providers')
          .update({
            display_name: formData.display_name,
            api_key: formData.api_key,
            base_url: formData.base_url,
            model_id: formData.model_id,
          })
          .eq('id', editingProvider.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('embedding_providers')
          .insert({
            user_id: user.id,
            provider_name: selectedPreset,
            display_name: formData.display_name,
            api_key: formData.api_key,
            base_url: formData.base_url,
            model_id: formData.model_id,
            is_default: providers.length === 0, // First provider is default
          });

        if (error) throw error;
      }

      toast({
        title: "Success",
        description: editingProvider ? "Provider updated" : "Provider added",
      });

      setIsDialogOpen(false);
      setEditingProvider(null);
      setFormData({ display_name: '', api_key: '', base_url: '', model_id: '' });
      loadProviders();
    } catch (error) {
      console.error('Error saving provider:', error);
      toast({
        title: "Error",
        description: "Failed to save provider",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this provider?')) return;

    try {
      const { error } = await supabase
        .from('embedding_providers')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({ title: "Success", description: "Provider deleted" });
      loadProviders();
    } catch (error) {
      console.error('Error deleting provider:', error);
      toast({
        title: "Error",
        description: "Failed to delete provider",
        variant: "destructive",
      });
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Unset all defaults
      await supabase
        .from('embedding_providers')
        .update({ is_default: false })
        .eq('user_id', user.id);

      // Set new default
      const { error } = await supabase
        .from('embedding_providers')
        .update({ is_default: true })
        .eq('id', id);

      if (error) throw error;

      toast({ title: "Success", description: "Default provider updated" });
      loadProviders();
    } catch (error) {
      console.error('Error setting default:', error);
      toast({
        title: "Error",
        description: "Failed to set default provider",
        variant: "destructive",
      });
    }
  };

  const handleToggleEnabled = async (id: string, enabled: boolean) => {
    try {
      const { error } = await supabase
        .from('embedding_providers')
        .update({ is_enabled: enabled })
        .eq('id', id);

      if (error) throw error;
      loadProviders();
    } catch (error) {
      console.error('Error toggling provider:', error);
    }
  };

  const openEditDialog = (provider: EmbeddingProvider) => {
    setEditingProvider(provider);
    setSelectedPreset(provider.provider_name);
    setFormData({
      display_name: provider.display_name,
      api_key: provider.api_key,
      base_url: provider.base_url,
      model_id: provider.model_id,
    });
    setIsDialogOpen(true);
  };

  if (loading) {
    return <div className="text-center p-4">Loading providers...</div>;
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Embedding Providers</CardTitle>
              <CardDescription>
                Manage API keys for embedding models used in chat and document processing
              </CardDescription>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => {
                  setEditingProvider(null);
                  setFormData({ display_name: '', api_key: '', base_url: '', model_id: '' });
                }}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Provider
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[525px]">
                <DialogHeader>
                  <DialogTitle>{editingProvider ? 'Edit Provider' : 'Add Embedding Provider'}</DialogTitle>
                  <DialogDescription>
                    Configure an embedding API provider
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  {!editingProvider && (
                    <div className="space-y-2">
                      <Label>Provider Type</Label>
                      <Select value={selectedPreset} onValueChange={setSelectedPreset}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PRESET_PROVIDERS.map(preset => (
                            <SelectItem key={preset.name} value={preset.name}>
                              {preset.display}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  
                  <div className="space-y-2">
                    <Label>Display Name</Label>
                    <Input
                      value={formData.display_name}
                      onChange={(e) => setFormData(prev => ({ ...prev, display_name: e.target.value }))}
                      placeholder="My OpenAI Provider"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>API Key</Label>
                    <Input
                      type="password"
                      value={formData.api_key}
                      onChange={(e) => setFormData(prev => ({ ...prev, api_key: e.target.value }))}
                      placeholder="sk-..."
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Base URL</Label>
                    <Input
                      value={formData.base_url}
                      onChange={(e) => setFormData(prev => ({ ...prev, base_url: e.target.value }))}
                      placeholder="https://api.openai.com/v1"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Model ID</Label>
                    <Input
                      value={formData.model_id}
                      onChange={(e) => setFormData(prev => ({ ...prev, model_id: e.target.value }))}
                      placeholder="text-embedding-3-small"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleSave}>
                    {editingProvider ? 'Update' : 'Add'} Provider
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {providers.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              No embedding providers configured. Add one to get started.
            </div>
          ) : (
            <div className="space-y-3">
              {providers.map((provider) => (
                <div
                  key={provider.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">{provider.display_name}</span>
                      {provider.is_default && (
                        <Badge variant="default" className="text-xs">
                          <Star className="w-3 h-3 mr-1" />
                          Default
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-xs">
                        {provider.model_id}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{provider.base_url}</p>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2">
                      <Label htmlFor={`enabled-${provider.id}`} className="text-sm">
                        Enabled
                      </Label>
                      <Switch
                        id={`enabled-${provider.id}`}
                        checked={provider.is_enabled}
                        onCheckedChange={(checked) => handleToggleEnabled(provider.id, checked)}
                      />
                    </div>
                    
                    {!provider.is_default && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSetDefault(provider.id)}
                      >
                        <Check className="w-4 h-4 mr-1" />
                        Set Default
                      </Button>
                    )}
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditDialog(provider)}
                    >
                      Edit
                    </Button>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(provider.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};