import { useState } from 'react';
import ChatInterface from '@/components/ChatInterface';
import { ChatMessage } from '@/types';
import { useQuery } from '@/contexts/QueryContext';
import { useSettings } from '@/contexts/SettingsContext';
import { createChatCompletion, createGeminiCompletion } from '@/services/llmClient';
import { useToast } from '@/hooks/use-toast';

const Home = () => {
  const { messages, addMessage, contextPaper } = useQuery();
  const { geminiApiKey, openaiApiKey } = useSettings();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const buildSystemPrompt = (paperTitle?: string, paperAbstract?: string) =>
    paperTitle
      ? `You are an expert research assistant. Answer questions using ONLY the provided paper context. If the PDF link cannot be accessed or the answer is not in the paper, say so clearly. Be concise and precise.\n\nPaper Title: ${paperTitle}\nPaper Abstract: ${paperAbstract || 'No abstract provided.'}`
      : 'You are a helpful academic research assistant. Answer questions clearly and concisely.';

  const buildHistory = (userContent: string) => {
    const recent = messages.slice(-10).map((message) => ({
      role: message.role,
      content: message.content,
    }));
    return [...recent, { role: 'user' as const, content: userContent }];
  };

  const handleSendMessage = async (content: string) => {
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: new Date(),
    };

    addMessage(userMessage);
    setIsLoading(true);

    try {
      const hasGemini = !!geminiApiKey;
      const hasOpenAI = !!openaiApiKey;

      if (!hasGemini && !hasOpenAI) {
        toast({
          title: 'API Key Required',
          description: 'Please configure a Gemini or OpenAI API key in Settings to chat.',
          variant: 'destructive',
        });
        setIsLoading(false);
        return;
      }

      const systemPrompt = buildSystemPrompt(contextPaper?.title, contextPaper?.abstract);
      const llmMessages = [
        { role: 'system' as const, content: systemPrompt },
        ...buildHistory(content),
      ];

      const response = hasGemini
        ? await createGeminiCompletion(geminiApiKey, llmMessages, { temperature: 0.3, maxTokens: 800 })
        : await createChatCompletion(openaiApiKey, llmMessages, { temperature: 0.3, maxTokens: 800 });

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response || 'I could not generate a response. Please try again.',
        timestamp: new Date(),
      };

      addMessage(assistantMessage);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to generate response.';
      toast({
        title: 'Chat Failed',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-screen">
      <ChatInterface
        messages={messages}
        onSendMessage={handleSendMessage}
        isLoading={isLoading}
        title="Query Papers"
        subtitle="Search across arXiv, Google Scholar, and Elsevier"
        placeholder="Search for papers, authors, or topics..."
      />
    </div>
  );
};

export default Home;
