import { createContext, useContext, useState, ReactNode } from 'react';
import { GraphNode, ChatMessage, GraphData, SearchSessionState } from '@/types';

interface GraphContextType {
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  addMessage: (message: ChatMessage) => void;
  selectedNode: GraphNode | null;
  setSelectedNode: (node: GraphNode | null) => void;
  searchSession: SearchSessionState | null;
  setSearchSession: (session: SearchSessionState | null) => void;
}

const GraphContext = createContext<GraphContextType | undefined>(undefined);

export const GraphProvider = ({ children }: { children: ReactNode }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [searchSession, setSearchSession] = useState<SearchSessionState | null>(null);

  const addMessage = (message: ChatMessage) => {
    setMessages(prev => [...prev, message]);
  };

  return (
    <GraphContext.Provider
      value={{
        messages,
        setMessages,
        addMessage,
        selectedNode,
        setSelectedNode,
        searchSession,
        setSearchSession,
      }}
    >
      {children}
    </GraphContext.Provider>
  );
};

export const useGraph = () => {
  const context = useContext(GraphContext);
  if (context === undefined) {
    throw new Error('useGraph must be used within a GraphProvider');
  }
  return context;
};
