import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Sparkles, Check, Plus, Trash2, Server } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
const PROVIDER_CONFIGS = {
  openai: {
    name: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    requiresApiKey: true,
    modelPlaceholder: "gpt-4o, gpt-4o-mini, o1",
    urlEditable: false
  },
  anthropic: {
    name: "Anthropic (Claude)",
    baseUrl: "https://api.anthropic.com/v1",
    requiresApiKey: true,
    modelPlaceholder: "claude-opus-4, claude-sonnet-4",
    urlEditable: false
  },
  google: {
    name: "Google (Gemini)",
    baseUrl: "https://generativelanguage.googleapis.com/v1",
    requiresApiKey: true,
    modelPlaceholder: "gemini-2.0-flash-exp, gemini-1.5-pro",
    urlEditable: false
  },
  ollama: {
    name: "Ollama",
    baseUrl: "",
    requiresApiKey: false,
    modelPlaceholder: "llama3.2, mistral, codellama",
    urlEditable: true
  },
  custom: {
    name: "Custom API",
    baseUrl: "",
    requiresApiKey: true,
    modelPlaceholder: "model-name",
    urlEditable: true
  }
};
export const ModelSettings = ({
  user
}: {
  user: any;
}) => {
  const [selectedModel, setSelectedModel] = useState("google/gemini-2.5-flash");
  const [loading, setLoading] = useState(true);
  const [customProviders, setCustomProviders] = useState<any[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [providerToDelete, setProviderToDelete] = useState<string | null>(null);
  const [newProvider, setNewProvider] = useState({
    provider_name: "openai",
    display_name: "",
    base_url: PROVIDER_CONFIGS.openai.baseUrl,
    api_key: "",
    model_id: ""
  });
  const handleProviderTypeChange = (providerType: string) => {
    const config = PROVIDER_CONFIGS[providerType as keyof typeof PROVIDER_CONFIGS];
    setNewProvider({
      provider_name: providerType,
      display_name: "",
      base_url: config.baseUrl,
      api_key: "",
      model_id: ""
    });
  };
  const baseModels = [{
    name: "Gemini 2.5 Flash",
    id: "google/gemini-2.5-flash",
    provider: "Google",
    description: "Fast and efficient for most tasks",
    isFree: true
  }, {
    name: "Gemini 2.5 Pro",
    id: "google/gemini-2.5-pro",
    provider: "Google",
    description: "Best for complex reasoning",
    isFree: true
  }, {
    name: "GPT-5",
    id: "openai/gpt-5",
    provider: "OpenAI",
    description: "Most capable model",
    isFree: false
  }];
  useEffect(() => {
    loadSettings();
    loadCustomProviders();
  }, [user]);
  const loadCustomProviders = async () => {
    if (!user?.id) return;
    const {
      data,
      error
    } = await supabase.from('api_providers').select('*').eq('user_id', user.id).order('created_at', {
      ascending: false
    });
    if (!error && data) {
      setCustomProviders(data);
    }
  };
  const handleAddProvider = async () => {
    const config = PROVIDER_CONFIGS[newProvider.provider_name as keyof typeof PROVIDER_CONFIGS];
    if (!newProvider.display_name || !newProvider.model_id) {
      toast.error("Please fill in all required fields");
      return;
    }
    if (config.requiresApiKey && !newProvider.api_key) {
      toast.error("API key is required for this provider");
      return;
    }
    if (config.urlEditable && !newProvider.base_url) {
      toast.error("Base URL is required");
      return;
    }
    const {
      error
    } = await supabase.from('api_providers').insert({
      user_id: user.id,
      provider_name: newProvider.provider_name,
      display_name: newProvider.display_name,
      base_url: newProvider.base_url,
      api_key: newProvider.api_key || null,
      model_id: newProvider.model_id,
      is_enabled: true,
      is_default: false
    });
    if (error) {
      console.error('Error adding provider:', error);
      toast.error("Failed to add API provider");
    } else {
      toast.success("API provider added successfully");
      setShowAddForm(false);
      setNewProvider({
        provider_name: "openai",
        display_name: "",
        base_url: PROVIDER_CONFIGS.openai.baseUrl,
        api_key: "",
        model_id: ""
      });
      loadCustomProviders();
    }
  };
  const handleToggleEnabled = async (providerId: string, currentState: boolean) => {
    const {
      error
    } = await supabase.from('api_providers').update({
      is_enabled: !currentState
    }).eq('id', providerId);
    if (error) {
      console.error('Error updating provider:', error);
      toast.error("Failed to update provider");
    } else {
      toast.success(currentState ? "Provider disabled" : "Provider enabled");
      loadCustomProviders();
    }
  };
  const handleSetDefault = async (providerId: string) => {
    await supabase.from('api_providers').update({
      is_default: false
    }).eq('user_id', user.id);
    const {
      error
    } = await supabase.from('api_providers').update({
      is_default: true
    }).eq('id', providerId);
    if (error) {
      console.error('Error setting default:', error);
      toast.error("Failed to set default provider");
    } else {
      toast.success("Default provider updated");
      loadCustomProviders();
    }
  };
  const confirmDelete = (providerId: string) => {
    setProviderToDelete(providerId);
    setDeleteDialogOpen(true);
  };
  const handleDelete = async () => {
    if (!providerToDelete) return;
    const {
      error
    } = await supabase.from('api_providers').delete().eq('id', providerToDelete);
    if (error) {
      console.error('Error deleting provider:', error);
      toast.error("Failed to delete provider");
    } else {
      toast.success("Provider deleted");
      loadCustomProviders();
    }
    setDeleteDialogOpen(false);
    setProviderToDelete(null);
  };
  const models = [...baseModels, ...customProviders.filter(provider => provider.is_enabled).map(provider => ({
    name: provider.display_name,
    id: `custom:${provider.id}`,
    provider: provider.provider_name,
    description: `${provider.model_id} @ ${provider.base_url}`,
    isFree: false,
    isCustom: true
  }))];
  const loadSettings = async () => {
    if (!user?.id) return;
    const {
      data,
      error
    } = await supabase.from('user_settings').select('selected_model').eq('user_id', user.id).maybeSingle();
    if (error && error.code !== 'PGRST116') {
      console.error('Error loading settings:', error);
    } else if (data) {
      setSelectedModel(data.selected_model);
    }
    setLoading(false);
  };
  const handleModelSelect = async (modelId: string) => {
    if (!user?.id) return;
    setSelectedModel(modelId);
    const {
      error
    } = await supabase.from('user_settings').upsert({
      user_id: user.id,
      selected_model: modelId
    }, {
      onConflict: 'user_id'
    });
    if (error) {
      toast.error("Failed to save model selection");
      console.error('Error saving settings:', error);
    } else {
      toast.success("Model updated successfully");
    }
  };
  return <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Leading Frontier Models</CardTitle>
          <CardDescription>
        </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {models.map(model => <Card key={model.id} className={`p-4 cursor-pointer transition-all ${selectedModel === model.id ? 'border-primary bg-primary/5' : 'hover:bg-gray-50'}`} onClick={() => handleModelSelect(model.id)}>
              <div className="flex items-start justify-between">
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold">{model.name}</h4>
                    {selectedModel === model.id && <Badge variant="default" className="gap-1">
                        <Check className="w-3 h-3" />
                        Selected
                      </Badge>}
                    {model.isFree && <Badge variant="secondary" className="bg-success/10 text-success border-success/20">
                        Free
                      </Badge>}
                    {(model as any).isCustom && <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                        Custom
                      </Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {model.provider} • {model.description}
                  </p>
                </div>
                <Sparkles className="w-5 h-5 text-primary flex-shrink-0" />
              </div>
            </Card>)}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Custom API Providers</CardTitle>
              <CardDescription>
                Configure custom API endpoints like Ollama or your own model servers
              </CardDescription>
            </div>
            <Button onClick={() => setShowAddForm(!showAddForm)} variant="outline" size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Add Provider
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {showAddForm && <Card className="p-4 border-2 border-dashed">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Provider Type *</Label>
                  <Select value={newProvider.provider_name} onValueChange={handleProviderTypeChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="openai">OpenAI</SelectItem>
                      <SelectItem value="anthropic">Anthropic (Claude)</SelectItem>
                      <SelectItem value="google">Google (Gemini)</SelectItem>
                      <SelectItem value="ollama">Ollama (Self-hosted)</SelectItem>
                      <SelectItem value="custom">Custom API</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {PROVIDER_CONFIGS[newProvider.provider_name as keyof typeof PROVIDER_CONFIGS].name}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Display Name *</Label>
                  <Input placeholder={`e.g., My ${PROVIDER_CONFIGS[newProvider.provider_name as keyof typeof PROVIDER_CONFIGS].name}`} value={newProvider.display_name} onChange={e => setNewProvider({
                ...newProvider,
                display_name: e.target.value
              })} />
                </div>

                {PROVIDER_CONFIGS[newProvider.provider_name as keyof typeof PROVIDER_CONFIGS].urlEditable && <div className="space-y-2">
                    <Label>Base URL *</Label>
                    <Input placeholder={newProvider.provider_name === "ollama" ? "http://your-server:11434" : "https://api.example.com/v1"} value={newProvider.base_url} onChange={e => setNewProvider({
                ...newProvider,
                base_url: e.target.value
              })} />
                  </div>}

                <div className="space-y-2">
                  <Label>Model ID *</Label>
                  <Input placeholder={PROVIDER_CONFIGS[newProvider.provider_name as keyof typeof PROVIDER_CONFIGS].modelPlaceholder} value={newProvider.model_id} onChange={e => setNewProvider({
                ...newProvider,
                model_id: e.target.value
              })} />
                  <p className="text-xs text-muted-foreground">
                    Example: {PROVIDER_CONFIGS[newProvider.provider_name as keyof typeof PROVIDER_CONFIGS].modelPlaceholder}
                  </p>
                </div>

                {PROVIDER_CONFIGS[newProvider.provider_name as keyof typeof PROVIDER_CONFIGS].requiresApiKey && <div className="space-y-2">
                    <Label>API Key *</Label>
                    <Input type="password" placeholder="sk-..." value={newProvider.api_key} onChange={e => setNewProvider({
                ...newProvider,
                api_key: e.target.value
              })} />
                  </div>}

                <div className="flex gap-2">
                  <Button onClick={handleAddProvider} size="sm">
                    Add Provider
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setShowAddForm(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            </Card>}

          {customProviders.length === 0 && !showAddForm && <div className="text-center py-8 text-muted-foreground">
              <Server className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No custom API providers configured</p>
              <p className="text-sm">Click "Add Provider" to get started</p>
            </div>}

          {customProviders.map(provider => <Card key={provider.id} className="p-4">
              <div className="flex items-start justify-between">
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold">{provider.display_name}</h4>
                    {provider.is_default && <Badge variant="default" className="gap-1">
                        <Check className="w-3 h-3" />
                        Default
                      </Badge>}
                    <Badge variant="outline">
                      {provider.provider_name}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p><span className="font-medium">URL:</span> {provider.base_url}</p>
                    <p><span className="font-medium">Model:</span> {provider.model_id}</p>
                  </div>
                  <div className="flex items-center gap-4 pt-2">
                    <div className="flex items-center gap-2">
                      <Switch checked={provider.is_enabled} onCheckedChange={() => handleToggleEnabled(provider.id, provider.is_enabled)} />
                      <Label className="text-sm">
                        {provider.is_enabled ? "Enabled" : "Disabled"}
                      </Label>
                    </div>
                    {!provider.is_default && provider.is_enabled && <Button variant="outline" size="sm" onClick={() => handleSetDefault(provider.id)}>
                        Set as Default
                      </Button>}
                    <Button variant="ghost" size="sm" onClick={() => confirmDelete(provider.id)} className="text-destructive hover:text-destructive">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </Card>)}
        </CardContent>
      </Card>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete API Provider</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this API provider? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>;
};