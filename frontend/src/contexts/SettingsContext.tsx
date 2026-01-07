import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Integration } from '@/types';
import { defaultIntegrations } from '@/data/mockData';

const STORAGE_KEY_API_KEY = 'scholargraph_openai_api_key';
const STORAGE_KEY_GEMINI_API_KEY = 'scholargraph_gemini_api_key';
const STORAGE_KEY_INTEGRATIONS = 'scholargraph_integrations';

interface SettingsContextType {
  // API Keys
  openaiApiKey: string;
  setOpenaiApiKey: (key: string) => void;
  hasOpenaiApiKey: boolean;
  geminiApiKey: string;
  setGeminiApiKey: (key: string) => void;
  hasGeminiApiKey: boolean;

  // Integrations
  integrations: Integration[];
  toggleIntegration: (id: string, enabled: boolean) => void;
  updateIntegration: (integration: Integration) => void;
  addIntegration: (integration: Integration) => void;
  getIntegration: (id: string) => Integration | undefined;
  isIntegrationEnabled: (id: string) => boolean;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider = ({ children }: { children: ReactNode }) => {
  // Load API key from localStorage
  const [openaiApiKey, setOpenaiApiKeyState] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(STORAGE_KEY_API_KEY) || '';
    }
    return '';
  });

  // Load Gemini API key from localStorage
  const [geminiApiKey, setGeminiApiKeyState] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(STORAGE_KEY_GEMINI_API_KEY) || '';
    }
    return '';
  });

  // Load integrations from localStorage and merge with defaults
  const [integrations, setIntegrations] = useState<Integration[]>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEY_INTEGRATIONS);
      if (stored) {
        try {
          const storedIntegrations: Integration[] = JSON.parse(stored);
          const storedIds = new Set(storedIntegrations.map(i => i.id));

          // Add any new default integrations that don't exist in storage
          const newDefaults = defaultIntegrations.filter(d => !storedIds.has(d.id));

          // Merge stored with new defaults
          return [...storedIntegrations, ...newDefaults];
        } catch {
          return defaultIntegrations;
        }
      }
    }
    return defaultIntegrations;
  });

  // Persist API key to localStorage
  const setOpenaiApiKey = (key: string) => {
    setOpenaiApiKeyState(key);
    if (typeof window !== 'undefined') {
      if (key) {
        localStorage.setItem(STORAGE_KEY_API_KEY, key);
      } else {
        localStorage.removeItem(STORAGE_KEY_API_KEY);
      }
    }
  };

  // Persist Gemini API key to localStorage
  const setGeminiApiKey = (key: string) => {
    setGeminiApiKeyState(key);
    if (typeof window !== 'undefined') {
      if (key) {
        localStorage.setItem(STORAGE_KEY_GEMINI_API_KEY, key);
      } else {
        localStorage.removeItem(STORAGE_KEY_GEMINI_API_KEY);
      }
    }
  };

  // Persist integrations to localStorage when they change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_INTEGRATIONS, JSON.stringify(integrations));
    }
  }, [integrations]);

  const toggleIntegration = (id: string, enabled: boolean) => {
    setIntegrations(prev =>
      prev.map(int => (int.id === id ? { ...int, enabled } : int))
    );
  };

  const updateIntegration = (integration: Integration) => {
    setIntegrations(prev =>
      prev.map(int => (int.id === integration.id ? integration : int))
    );
  };

  const addIntegration = (integration: Integration) => {
    setIntegrations(prev => [...prev, integration]);
  };

  const getIntegration = (id: string) => {
    return integrations.find(int => int.id === id);
  };

  const isIntegrationEnabled = (id: string) => {
    const integration = integrations.find(int => int.id === id);
    return integration?.enabled ?? false;
  };

  return (
    <SettingsContext.Provider
      value={{
        openaiApiKey,
        setOpenaiApiKey,
        hasOpenaiApiKey: !!openaiApiKey,
        geminiApiKey,
        setGeminiApiKey,
        hasGeminiApiKey: !!geminiApiKey,
        integrations,
        toggleIntegration,
        updateIntegration,
        addIntegration,
        getIntegration,
        isIntegrationEnabled,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};
