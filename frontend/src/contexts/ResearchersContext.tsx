import { createContext, useContext, useState, ReactNode } from 'react';
import { Researcher, ResearcherList } from '@/types';

interface ResearchersState {
  researchers: Researcher[];
  selectedResearcher: Researcher | null;
  lists: ResearcherList[];
  selectedListId: string | null;
}

interface ResearchersContextType {
  state: ResearchersState;
  addResearchers: (researchers: Researcher[]) => void;
  setSelectedResearcher: (researcher: Researcher | null) => void;
  clearResearchers: () => void;
  createList: (name: string) => string;
  renameList: (listId: string, name: string) => void;
  setSelectedListId: (listId: string | null) => void;
  addResearchersToList: (listId: string, researcherIds: string[]) => void;
}

const ResearchersContext = createContext<ResearchersContextType | undefined>(undefined);

export const ResearchersProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<ResearchersState>({
    researchers: [],
    selectedResearcher: null,
    lists: [],
    selectedListId: null,
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
    setState(prev => ({
      ...prev,
      researchers: [],
      selectedResearcher: null,
      lists: prev.lists.map(list => ({ ...list, researcherIds: [] })),
    }));
  };

  const createList = (name: string) => {
    const id = `list-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setState(prev => ({
      ...prev,
      lists: [...prev.lists, { id, name, researcherIds: [] }],
    }));
    return id;
  };

  const renameList = (listId: string, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setState(prev => ({
      ...prev,
      lists: prev.lists.map(list => (list.id === listId ? { ...list, name: trimmed } : list)),
    }));
  };

  const setSelectedListId = (listId: string | null) => {
    setState(prev => ({ ...prev, selectedListId: listId }));
  };

  const addResearchersToList = (listId: string, researcherIds: string[]) => {
    setState(prev => ({
      ...prev,
      lists: prev.lists.map(list => {
        if (list.id !== listId) return list;
        const existing = new Set(list.researcherIds);
        researcherIds.forEach(id => existing.add(id));
        return { ...list, researcherIds: Array.from(existing) };
      }),
    }));
  };

  return (
    <ResearchersContext.Provider
      value={{
        state,
        addResearchers,
        setSelectedResearcher,
        clearResearchers,
        createList,
        renameList,
        setSelectedListId,
        addResearchersToList,
      }}
    >
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
