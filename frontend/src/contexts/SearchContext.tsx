import { createContext, useContext, useState, ReactNode } from 'react';
import { Paper, MarketViability } from '@/types';

export interface SourceResult {
  source: string;
  count: number;
  rawCount?: number; // Count before filtering
  error?: string;
}

interface SearchState {
  query: string;
  results: Paper[];
  hasSearched: boolean;
  viabilityData: Map<string, MarketViability>;
  sourceResults: SourceResult[];
}

interface SearchContextType {
  state: SearchState;
  setQuery: (query: string) => void;
  setResults: (results: Paper[], sourceResults?: SourceResult[]) => void;
  setHasSearched: (hasSearched: boolean) => void;
  setViability: (paperId: string, viability: MarketViability) => void;
  getViability: (paperId: string) => MarketViability | undefined;
}

const SearchContext = createContext<SearchContextType | undefined>(undefined);

export const SearchProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<SearchState>({
    query: '',
    results: [],
    hasSearched: false,
    viabilityData: new Map(),
    sourceResults: [],
  });

  const setQuery = (query: string) => {
    setState(prev => ({ ...prev, query }));
  };

  const setResults = (results: Paper[], sourceResults: SourceResult[] = []) => {
    setState(prev => ({ ...prev, results, sourceResults }));
  };

  const setHasSearched = (hasSearched: boolean) => {
    setState(prev => ({ ...prev, hasSearched }));
  };

  const setViability = (paperId: string, viability: MarketViability) => {
    setState(prev => {
      const newViabilityData = new Map(prev.viabilityData);
      newViabilityData.set(paperId, viability);
      return { ...prev, viabilityData: newViabilityData };
    });
  };

  const getViability = (paperId: string) => {
    return state.viabilityData.get(paperId);
  };

  return (
    <SearchContext.Provider
      value={{
        state,
        setQuery,
        setResults,
        setHasSearched,
        setViability,
        getViability,
      }}
    >
      {children}
    </SearchContext.Provider>
  );
};

export const useSearch = () => {
  const context = useContext(SearchContext);
  if (context === undefined) {
    throw new Error('useSearch must be used within a SearchProvider');
  }
  return context;
};
