import { createContext, useContext, useState, ReactNode } from 'react';
import { Researcher } from '@/types';

interface ResearchersState {
  researchers: Researcher[];
  selectedResearcher: Researcher | null;
}

interface ResearchersContextType {
  state: ResearchersState;
  addResearchers: (researchers: Researcher[]) => void;
  setSelectedResearcher: (researcher: Researcher | null) => void;
  clearResearchers: () => void;
}

const ResearchersContext = createContext<ResearchersContextType | undefined>(undefined);

export const ResearchersProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<ResearchersState>({
    researchers: [],
    selectedResearcher: null,
  });

  const addResearchers = (newResearchers: Researcher[]) => {
    setState(prev => {
      const newResearchersMap = new Map(newResearchers.map(r => [r.id, r]));

      // Update existing researchers or keep them as-is
      const updated = prev.researchers.map(r =>
        newResearchersMap.has(r.id) ? newResearchersMap.get(r.id)! : r
      );

      // Add truly new researchers (not already in the list)
      const existingIds = new Set(prev.researchers.map(r => r.id));
      const brandNew = newResearchers.filter(r => !existingIds.has(r.id));

      return {
        ...prev,
        researchers: [...updated, ...brandNew],
      };
    });
  };

  const setSelectedResearcher = (researcher: Researcher | null) => {
    setState(prev => ({ ...prev, selectedResearcher: researcher }));
  };

  const clearResearchers = () => {
    setState({ researchers: [], selectedResearcher: null });
  };

  return (
    <ResearchersContext.Provider value={{ state, addResearchers, setSelectedResearcher, clearResearchers }}>
      {children}
    </ResearchersContext.Provider>
  );
};

export const useResearchers = () => {
  const context = useContext(ResearchersContext);
  if (!context) {
    throw new Error('useResearchers must be used within a ResearchersProvider');
  }
  return context;
};
