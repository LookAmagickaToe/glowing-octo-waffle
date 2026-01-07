import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Integration } from '@/types';

interface IntegrationModalProps {
  integration: Integration | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (integration: Integration) => void;
  isNew?: boolean;
}

const IntegrationModal = ({ integration, isOpen, onClose, onSave, isNew = false }: IntegrationModalProps) => {
  const [formData, setFormData] = useState<Partial<Integration>>({
    name: '',
    description: '',
    apiUrl: '',
    icon: '📄',
    enabled: true,
    apiKey: '',
    email: '',
  });
  const [showApiKey, setShowApiKey] = useState(false);

  useEffect(() => {
    if (integration) {
      setFormData(integration);
    } else {
      setFormData({
        name: '',
        description: '',
        apiUrl: '',
        icon: '📄',
        enabled: true,
        apiKey: '',
        email: '',
      });
    }
    setShowApiKey(false);
  }, [integration]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.name && formData.description) {
      onSave({
        id: integration?.id || Date.now().toString(),
        name: formData.name,
        description: formData.description,
        apiUrl: formData.apiUrl,
        icon: formData.icon || '📄',
        enabled: formData.enabled ?? true,
        requiresKey: formData.requiresKey,
        apiKey: formData.apiKey,
        configFields: formData.configFields,
        email: formData.email,
      });
      onClose();
    }
  };

  const hasApiKeyField = formData.configFields?.includes('apiKey') || formData.requiresKey;
  const hasEmailField = formData.configFields?.includes('email');

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40"
          />

          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-md pointer-events-auto"
            >
              <div className="bg-card border border-border rounded-lg shadow-lg">
              <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                <h2 className="font-semibold">
                  {isNew ? 'Add Integration' : 'Edit Integration'}
                </h2>
                <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
                  <X className="w-4 h-4" />
                </Button>
              </div>

              <form onSubmit={handleSubmit} className="p-5 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., PubMed"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Brief description of the integration..."
                    required
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="apiUrl">API URL (optional)</Label>
                  <Input
                    id="apiUrl"
                    value={formData.apiUrl}
                    onChange={(e) => setFormData({ ...formData, apiUrl: e.target.value })}
                    placeholder="https://api.example.com"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="icon">Icon (emoji)</Label>
                  <Input
                    id="icon"
                    value={formData.icon}
                    onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                    placeholder="📄"
                    maxLength={2}
                    className="w-20"
                  />
                </div>

                {/* Email Configuration Field */}
                {hasEmailField && (
                  <div className="space-y-2">
                    <Label htmlFor="email">Email (for API access)</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email || ''}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="your@email.com"
                    />
                    <p className="text-xs text-muted-foreground">
                      Used for polite pool access and higher rate limits
                    </p>
                  </div>
                )}

                {/* API Key Configuration Field */}
                {hasApiKeyField && (
                  <div className="space-y-2">
                    <Label htmlFor="apiKey">API Key</Label>
                    <div className="relative">
                      <Input
                        id="apiKey"
                        type={showApiKey ? 'text' : 'password'}
                        value={formData.apiKey || ''}
                        onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                        placeholder="Enter API key..."
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowApiKey(!showApiKey)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {formData.requiresKey ? 'Required for this integration' : 'Optional - for higher rate limits'}
                    </p>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={onClose}>
                    Cancel
                  </Button>
                  <Button type="submit">
                    {isNew ? 'Add' : 'Save'}
                  </Button>
                </div>
              </form>
            </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
};

export default IntegrationModal;
