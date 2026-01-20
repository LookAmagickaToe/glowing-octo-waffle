import { createContext, useContext, useState, ReactNode } from 'react';
import { ChatMessage, Paper } from '@/types';

interface QueryContextType {
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  addMessage: (message: ChatMessage) => void;
  contextPaper: Paper | null;
  setContextPaper: (paper: Paper | null) => void;
  startPaperChat: (paper: Paper) => void;
  clearChat: () => void;
}

const QueryContext = createContext<QueryContextType | undefined>(undefined);

export const QueryProvider = ({ children }: { children: ReactNode }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [contextPaper, setContextPaper] = useState<Paper | null>(null);

  const addMessage = (message: ChatMessage) => {
    setMessages(prev => [...prev, message]);
  };

  const startPaperChat = (paper: Paper) => {
    setContextPaper(paper);
    setMessages([]);
  };

  const clearChat = () => {
    setMessages([]);
    setContextPaper(null);
  };

  return (
    <QueryContext.Provider
      value={{
        messages,
        setMessages,
        addMessage,
        contextPaper,
        setContextPaper,
        startPaperChat,
        clearChat,
      }}
    >
      {children}
    </QueryContext.Provider>
  );
};

export const useQuery = () => {
  const context = useContext(QueryContext);
  if (context === undefined) {
    throw new Error('useQuery must be used within a QueryProvider');
  }
  return context;
};
