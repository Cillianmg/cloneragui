import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { Trash2, Plus, Globe } from "lucide-react";
import { z } from "zod";

const providerSchema = z.object({
  provider_name: z.enum(['brave', 'serper', 'tavily', 'custom']),
  display_name: z.string().min(1).max(100),
  api_key: z.string().min(1).max(500),
  base_url: z.string().url().optional().or(z.literal('')),
});

const providerInfo = {
  brave: {
    name: "Brave Search",
    description: "Brave Search API - generous free tier",
    baseUrl: "https://api.search.brave.com/res/v1/web/search",
    docsUrl: "https://brave.com/search/api/"
  },
  serper: {
    name: "Serper",
    description: "Google Search API - affordable pricing",
    baseUrl: "https://google.serper.dev/search",
    docsUrl: "https://serper.dev/"
  },
  tavily: {
    name: "Tavily",
    description: "AI-optimized search API",
    baseUrl: "https://api.tavily.com/search",
    docsUrl: "https://tavily.com/"
  },
  custom: {
    name: "Custom Provider",
    description: "Your own search API endpoint",
    baseUrl: "",
    docsUrl: ""
  }
};

export const WebSearchProviders = () => {
  const [providers, setProviders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<'brave' | 'serper' | 'tavily' | 'custom'>('brave');
  const [formData, setFormData] = useState({
    api_key: '',
    base_url: '',
  });

  useEffect(() => {
    loadProviders();
  }, []);

  const loadProviders = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('web_search_providers')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      toast({
        title: "Error loading providers",
        description: error.message,
        variant: "destructive"
      });
    } else {
      setProviders(data || []);
    }
    setLoading(false);
  };

  const handleAdd = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    try {
      const providerData = {
        provider_name: selectedProvider,
        display_name: providerInfo[selectedProvider].name,
        api_key: formData.api_key.trim(),
        base_url: selectedProvider === 'custom' ? formData.base_url.trim() : providerInfo[selectedProvider].baseUrl,
      };

      // Validate
      providerSchema.parse(providerData);

      // Check if this is the first provider
      const isFirstProvider = providers.length === 0;

      const { error } = await supabase
        .from('web_search_providers')
        .insert([{
          ...providerData,
          user_id: user.id,
          is_default: isFirstProvider, // First provider becomes default
        }]);

      if (error) throw error;

      toast({
        title: "Provider added",
        description: `${providerData.display_name} has been configured`,
      });

      setFormData({ api_key: '', base_url: '' });
      setShowAddForm(false);
      loadProviders();
    } catch (error: any) {
      toast({
        title: "Validation error",
        description: error.message || "Please check your input",
        variant: "destructive"
      });
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from('web_search_providers')
      .delete()
      .eq('id', id);

    if (error) {
      toast({
        title: "Error deleting provider",
        description: error.message,
        variant: "destructive"
      });
    } else {
      toast({
        title: "Provider deleted",
      });
      loadProviders();
    }
  };

  const handleToggleEnabled = async (id: string, currentState: boolean) => {
    const { error } = await supabase
      .from('web_search_providers')
      .update({ is_enabled: !currentState })
      .eq('id', id);

    if (error) {
      toast({
        title: "Error updating provider",
        description: error.message,
        variant: "destructive"
      });
    } else {
      loadProviders();
    }
  };

  const handleSetDefault = async (id: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // First, unset all defaults
    await supabase
      .from('web_search_providers')
      .update({ is_default: false })
      .eq('user_id', user.id);

    // Then set the new default
    const { error } = await supabase
      .from('web_search_providers')
      .update({ is_default: true })
      .eq('id', id);

    if (error) {
      toast({
        title: "Error setting default",
        description: error.message,
        variant: "destructive"
      });
    } else {
      toast({
        title: "Default provider updated",
      });
      loadProviders();
    }
  };

  if (loading) {
    return <div className="flex justify-center p-8">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Web Search Providers
          </CardTitle>
          <CardDescription>
            Configure search API providers for the web search tool
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {providers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Globe className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No search providers configured</p>
              <p className="text-sm">Add a provider to enable web search in chat</p>
            </div>
          ) : (
            <div className="space-y-4">
              {providers.map((provider) => (
                <Card key={provider.id}>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <h4 className="font-semibold">{provider.display_name}</h4>
                          {provider.is_default && (
                            <span className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded">
                              Default
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {provider.provider_name === 'custom' ? provider.base_url : providerInfo[provider.provider_name as keyof typeof providerInfo]?.description}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          <Label htmlFor={`enabled-${provider.id}`} className="text-sm">
                            Enabled
                          </Label>
                          <Switch
                            id={`enabled-${provider.id}`}
                            checked={provider.is_enabled}
                            onCheckedChange={() => handleToggleEnabled(provider.id, provider.is_enabled)}
                          />
                        </div>
                        {!provider.is_default && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleSetDefault(provider.id)}
                          >
                            Set Default
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(provider.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {!showAddForm ? (
            <Button onClick={() => setShowAddForm(true)} className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              Add Search Provider
            </Button>
          ) : (
            <Card>
              <CardContent className="pt-6 space-y-4">
                <div className="space-y-2">
                  <Label>Provider</Label>
                  <Select value={selectedProvider} onValueChange={(value: any) => setSelectedProvider(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="brave">
                        <div>
                          <div className="font-medium">Brave Search</div>
                          <div className="text-xs text-muted-foreground">Generous free tier</div>
                        </div>
                      </SelectItem>
                      <SelectItem value="serper">
                        <div>
                          <div className="font-medium">Serper</div>
                          <div className="text-xs text-muted-foreground">Google Search API</div>
                        </div>
                      </SelectItem>
                      <SelectItem value="tavily">
                        <div>
                          <div className="font-medium">Tavily</div>
                          <div className="text-xs text-muted-foreground">AI-optimized search</div>
                        </div>
                      </SelectItem>
                      <SelectItem value="custom">
                        <div>
                          <div className="font-medium">Custom Provider</div>
                          <div className="text-xs text-muted-foreground">Your own API</div>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  {providerInfo[selectedProvider].docsUrl && (
                    <p className="text-xs text-muted-foreground">
                      Get your API key from{' '}
                      <a 
                        href={providerInfo[selectedProvider].docsUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="underline hover:text-primary"
                      >
                        {providerInfo[selectedProvider].docsUrl}
                      </a>
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="api_key">API Key</Label>
                  <Input
                    id="api_key"
                    type="password"
                    value={formData.api_key}
                    onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
                    placeholder="Enter your API key"
                  />
                </div>

                {selectedProvider === 'custom' && (
                  <div className="space-y-2">
                    <Label htmlFor="base_url">API Endpoint URL</Label>
                    <Input
                      id="base_url"
                      type="url"
                      value={formData.base_url}
                      onChange={(e) => setFormData({ ...formData, base_url: e.target.value })}
                      placeholder="https://your-api.com/search"
                    />
                    <p className="text-xs text-muted-foreground">
                      Your API should accept POST requests with a "query" parameter
                    </p>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button onClick={handleAdd} className="flex-1">
                    Add Provider
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setShowAddForm(false);
                      setFormData({ api_key: '', base_url: '' });
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
