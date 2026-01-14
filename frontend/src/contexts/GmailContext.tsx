/**
 * Gmail Context - manages Gmail OAuth state and email operations
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import { useToast } from '@/hooks/use-toast';
import type {
  GmailUser,
  GmailAuthState,
  EmailListItem,
  GmailLabel,
  GmailMessage,
  ComposeEmailData,
  ParsedEmail,
} from '@/types/gmail';
import * as gmailService from '@/services/gmailService';

interface GmailContextType extends GmailAuthState {
  // Auth actions
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  handleOAuthCallback: (code: string, state: string) => Promise<boolean>;

  // Email data
  emails: EmailListItem[];
  currentEmail: ParsedEmail | null;
  labels: GmailLabel[];
  currentLabel: string;
  nextPageToken: string | null;

  // Email actions
  fetchEmails: (labelId?: string, pageToken?: string) => Promise<void>;
  fetchEmail: (messageId: string) => Promise<void>;
  sendEmail: (data: ComposeEmailData) => Promise<void>;
  refreshEmails: () => Promise<void>;
  loadMoreEmails: () => Promise<void>;
  setCurrentLabel: (labelId: string) => void;
  markAsRead: (messageId: string) => Promise<void>;
  markAsUnread: (messageId: string) => Promise<void>;
  starMessage: (messageId: string) => Promise<void>;
  unstarMessage: (messageId: string) => Promise<void>;
  archiveMessage: (messageId: string) => Promise<void>;
  trashMessage: (messageId: string) => Promise<void>;
  clearCurrentEmail: () => void;

  // Loading states
  isLoadingEmails: boolean;
  isLoadingEmail: boolean;
  isSending: boolean;
}

const GmailContext = createContext<GmailContextType | undefined>(undefined);

const getRedirectUri = () => {
  if (typeof window === 'undefined') return '';
  return `${window.location.origin}/auth/callback`;
};

export function GmailProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();

  // Auth state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<GmailUser | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Email state
  const [emails, setEmails] = useState<EmailListItem[]>([]);
  const [currentEmail, setCurrentEmail] = useState<ParsedEmail | null>(null);
  const [labels, setLabels] = useState<GmailLabel[]>([]);
  const [currentLabel, setCurrentLabel] = useState('INBOX');
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);

  // Loading states
  const [isLoadingEmails, setIsLoadingEmails] = useState(false);
  const [isLoadingEmail, setIsLoadingEmail] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // Check for existing session on mount
  useEffect(() => {
    const checkSession = async () => {
      const token = gmailService.getSessionToken();
      const storedUser = gmailService.getStoredUser();

      if (token && storedUser) {
        // Verify session is still valid
        const status = await gmailService.checkAuthStatus();
        if (status.authenticated && status.user) {
          setSessionToken(token);
          setUser(status.user);
          setIsAuthenticated(true);
        } else {
          // Session expired, clear data
          gmailService.clearAuthData();
        }
      }
      setIsLoading(false);
    };

    checkSession();
  }, []);

  // Fetch labels when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      gmailService
        .listLabels()
        .then(response => setLabels(response.labels))
        .catch(console.error);
    }
  }, [isAuthenticated]);

  // Connect to Gmail (start OAuth flow)
  const connect = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { auth_url } = await gmailService.initOAuth(getRedirectUri());

      // Redirect to Google OAuth
      window.location.href = auth_url;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to connect';
      setError(message);
      toast({
        title: 'Connection Failed',
        description: message,
        variant: 'destructive',
      });
      setIsLoading(false);
    }
  }, [toast]);

  // Handle OAuth callback
  const handleOAuthCallback = useCallback(
    async (code: string, state: string): Promise<boolean> => {
      try {
        setIsLoading(true);
        setError(null);

        const response = await gmailService.exchangeCode(code, state, getRedirectUri());

        setUser(response.user);
        setSessionToken(response.session_token);
        setIsAuthenticated(true);

        toast({
          title: 'Connected to Gmail',
          description: `Signed in as ${response.user.email}`,
        });

        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Authentication failed';
        setError(message);
        toast({
          title: 'Authentication Failed',
          description: message,
          variant: 'destructive',
        });
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [toast]
  );

  // Disconnect from Gmail
  const disconnect = useCallback(async () => {
    await gmailService.revokeAuth();
    setUser(null);
    setSessionToken(null);
    setIsAuthenticated(false);
    setEmails([]);
    setCurrentEmail(null);
    setLabels([]);
    setNextPageToken(null);

    toast({
      title: 'Disconnected',
      description: 'Gmail account disconnected',
    });
  }, [toast]);

  // Fetch emails
  const fetchEmails = useCallback(
    async (labelId: string = currentLabel, pageToken?: string) => {
      if (!isAuthenticated) return;

      try {
        setIsLoadingEmails(true);
        if (!pageToken) {
          setCurrentLabel(labelId);
        }

        const response = await gmailService.listMessages({
          labelIds: labelId,
          maxResults: 20,
          pageToken,
        });

        if (!response.messages || response.messages.length === 0) {
          if (!pageToken) {
            setEmails([]);
          }
          setNextPageToken(null);
          return;
        }

        // Fetch full message details for each message
        const emailDetails = await Promise.all(
          response.messages.map(async msg => {
            const full = await gmailService.getMessage(msg.id);
            return gmailService.parseMessageListItem(full);
          })
        );

        if (pageToken) {
          // Append to existing emails
          setEmails(prev => [...prev, ...emailDetails]);
        } else {
          // Replace emails
          setEmails(emailDetails);
        }

        setNextPageToken(response.nextPageToken || null);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to fetch emails';
        toast({
          title: 'Error',
          description: message,
          variant: 'destructive',
        });
      } finally {
        setIsLoadingEmails(false);
      }
    },
    [isAuthenticated, currentLabel, toast]
  );

  // Load more emails (pagination)
  const loadMoreEmails = useCallback(async () => {
    if (nextPageToken) {
      await fetchEmails(currentLabel, nextPageToken);
    }
  }, [fetchEmails, currentLabel, nextPageToken]);

  // Fetch single email
  const fetchEmail = useCallback(
    async (messageId: string) => {
      if (!isAuthenticated) return;

      try {
        setIsLoadingEmail(true);
        const message = await gmailService.getMessage(messageId);
        const parsed = gmailService.parseMessage(message);
        setCurrentEmail(parsed);

        // Mark as read if unread
        if (!parsed.isRead) {
          await gmailService.markAsRead(messageId);
          // Update email in list
          setEmails(prev =>
            prev.map(e => (e.id === messageId ? { ...e, isRead: true } : e))
          );
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to fetch email';
        toast({
          title: 'Error',
          description: message,
          variant: 'destructive',
        });
      } finally {
        setIsLoadingEmail(false);
      }
    },
    [isAuthenticated, toast]
  );

  // Send email
  const sendEmail = useCallback(
    async (data: ComposeEmailData) => {
      if (!isAuthenticated) return;

      try {
        setIsSending(true);
        await gmailService.sendMessage(data);

        toast({
          title: 'Email Sent',
          description: `Email sent to ${data.to}`,
        });

        // Refresh sent folder if viewing it
        if (currentLabel === 'SENT') {
          await fetchEmails('SENT');
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to send email';
        toast({
          title: 'Send Failed',
          description: message,
          variant: 'destructive',
        });
        throw err;
      } finally {
        setIsSending(false);
      }
    },
    [isAuthenticated, currentLabel, fetchEmails, toast]
  );

  // Refresh emails
  const refreshEmails = useCallback(async () => {
    await fetchEmails(currentLabel);
  }, [fetchEmails, currentLabel]);

  // Mark as read
  const markAsRead = useCallback(
    async (messageId: string) => {
      await gmailService.markAsRead(messageId);
      setEmails(prev =>
        prev.map(e => (e.id === messageId ? { ...e, isRead: true } : e))
      );
      if (currentEmail?.id === messageId) {
        setCurrentEmail(prev => (prev ? { ...prev, isRead: true } : null));
      }
    },
    [currentEmail?.id]
  );

  // Mark as unread
  const markAsUnread = useCallback(
    async (messageId: string) => {
      await gmailService.markAsUnread(messageId);
      setEmails(prev =>
        prev.map(e => (e.id === messageId ? { ...e, isRead: false } : e))
      );
      if (currentEmail?.id === messageId) {
        setCurrentEmail(prev => (prev ? { ...prev, isRead: false } : null));
      }
    },
    [currentEmail?.id]
  );

  // Star message
  const starMessage = useCallback(
    async (messageId: string) => {
      await gmailService.starMessage(messageId);
      setEmails(prev =>
        prev.map(e => (e.id === messageId ? { ...e, isStarred: true } : e))
      );
      if (currentEmail?.id === messageId) {
        setCurrentEmail(prev => (prev ? { ...prev, isStarred: true } : null));
      }
    },
    [currentEmail?.id]
  );

  // Unstar message
  const unstarMessage = useCallback(
    async (messageId: string) => {
      await gmailService.unstarMessage(messageId);
      setEmails(prev =>
        prev.map(e => (e.id === messageId ? { ...e, isStarred: false } : e))
      );
      if (currentEmail?.id === messageId) {
        setCurrentEmail(prev => (prev ? { ...prev, isStarred: false } : null));
      }
    },
    [currentEmail?.id]
  );

  // Archive message
  const archiveMessage = useCallback(
    async (messageId: string) => {
      await gmailService.archiveMessage(messageId);
      // Remove from list if viewing inbox
      if (currentLabel === 'INBOX') {
        setEmails(prev => prev.filter(e => e.id !== messageId));
      }
      toast({ title: 'Email archived' });
    },
    [currentLabel, toast]
  );

  // Trash message
  const trashMessage = useCallback(
    async (messageId: string) => {
      await gmailService.trashMessage(messageId);
      // Remove from list if not viewing trash
      if (currentLabel !== 'TRASH') {
        setEmails(prev => prev.filter(e => e.id !== messageId));
      }
      toast({ title: 'Email moved to trash' });
    },
    [currentLabel, toast]
  );

  // Clear current email
  const clearCurrentEmail = useCallback(() => {
    setCurrentEmail(null);
  }, []);

  return (
    <GmailContext.Provider
      value={{
        // Auth state
        isAuthenticated,
        isLoading,
        user,
        sessionToken,
        error,

        // Auth actions
        connect,
        disconnect,
        handleOAuthCallback,

        // Email data
        emails,
        currentEmail,
        labels,
        currentLabel,
        nextPageToken,

        // Email actions
        fetchEmails,
        fetchEmail,
        sendEmail,
        refreshEmails,
        loadMoreEmails,
        setCurrentLabel,
        markAsRead,
        markAsUnread,
        starMessage,
        unstarMessage,
        archiveMessage,
        trashMessage,
        clearCurrentEmail,

        // Loading states
        isLoadingEmails,
        isLoadingEmail,
        isSending,
      }}
    >
      {children}
    </GmailContext.Provider>
  );
}

export function useGmail() {
  const context = useContext(GmailContext);
  if (context === undefined) {
    throw new Error('useGmail must be used within a GmailProvider');
  }
  return context;
}
