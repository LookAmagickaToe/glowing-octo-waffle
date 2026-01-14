/**
 * Gmail API service - handles all Gmail API communication via Cloud Functions backend
 */

import type {
  AuthInitResponse,
  TokenExchangeResponse,
  GmailMessagesResponse,
  GmailMessage,
  GmailLabelsResponse,
  GmailDraftsResponse,
  GmailDraft,
  ComposeEmailData,
  GmailUser,
  ParsedEmail,
  EmailListItem,
  LabelModification,
  SYSTEM_LABELS,
} from '@/types/gmail';

// API base URL - Cloud Functions endpoint
const API_BASE = import.meta.env.VITE_GMAIL_API_URL ||
  'https://us-central1-waffle-mm.cloudfunctions.net';

// Storage keys
const STORAGE_KEYS = {
  SESSION_TOKEN: 'gmail_session_token',
  CODE_VERIFIER: 'gmail_code_verifier',
  STATE: 'gmail_state',
  USER: 'gmail_user',
} as const;

// ============================================================================
// Authentication
// ============================================================================

/**
 * Initialize OAuth flow - get authorization URL with PKCE
 */
export async function initOAuth(redirectUri: string): Promise<AuthInitResponse> {
  const response = await fetch(`${API_BASE}/gmail-auth-init`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ redirect_uri: redirectUri }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to initialize OAuth');
  }

  const data: AuthInitResponse = await response.json();

  // Store state and code verifier for callback validation
  sessionStorage.setItem(STORAGE_KEYS.CODE_VERIFIER, data.code_verifier);
  sessionStorage.setItem(STORAGE_KEYS.STATE, data.state);

  return data;
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCode(
  code: string,
  state: string,
  redirectUri: string
): Promise<TokenExchangeResponse> {
  // Verify state matches to prevent CSRF
  const storedState = sessionStorage.getItem(STORAGE_KEYS.STATE);
  if (state !== storedState) {
    throw new Error('State mismatch - possible CSRF attack');
  }

  const codeVerifier = sessionStorage.getItem(STORAGE_KEYS.CODE_VERIFIER);
  if (!codeVerifier) {
    throw new Error('Code verifier not found');
  }

  const response = await fetch(`${API_BASE}/gmail-auth-callback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code,
      code_verifier: codeVerifier,
      redirect_uri: redirectUri,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Token exchange failed');
  }

  const data: TokenExchangeResponse = await response.json();

  // Store session token and user info
  localStorage.setItem(STORAGE_KEYS.SESSION_TOKEN, data.session_token);
  localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(data.user));

  // Clear temporary OAuth data
  sessionStorage.removeItem(STORAGE_KEYS.CODE_VERIFIER);
  sessionStorage.removeItem(STORAGE_KEYS.STATE);

  return data;
}

/**
 * Get stored session token
 */
export function getSessionToken(): string | null {
  return localStorage.getItem(STORAGE_KEYS.SESSION_TOKEN);
}

/**
 * Get stored user info
 */
export function getStoredUser(): GmailUser | null {
  const userStr = localStorage.getItem(STORAGE_KEYS.USER);
  return userStr ? JSON.parse(userStr) : null;
}

/**
 * Clear all stored auth data (logout)
 */
export function clearAuthData(): void {
  localStorage.removeItem(STORAGE_KEYS.SESSION_TOKEN);
  localStorage.removeItem(STORAGE_KEYS.USER);
  sessionStorage.removeItem(STORAGE_KEYS.CODE_VERIFIER);
  sessionStorage.removeItem(STORAGE_KEYS.STATE);
}

/**
 * Check authentication status with backend
 */
export async function checkAuthStatus(): Promise<{ authenticated: boolean; user?: GmailUser }> {
  const sessionToken = getSessionToken();
  if (!sessionToken) {
    return { authenticated: false };
  }

  try {
    const response = await fetch(`${API_BASE}/gmail-auth-status`, {
      headers: { Authorization: `Bearer ${sessionToken}` },
    });

    if (!response.ok) {
      return { authenticated: false };
    }

    return await response.json();
  } catch {
    return { authenticated: false };
  }
}

/**
 * Revoke tokens and logout
 */
export async function revokeAuth(): Promise<void> {
  const sessionToken = getSessionToken();
  if (sessionToken) {
    try {
      await fetch(`${API_BASE}/gmail-auth-revoke`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
    } catch {
      // Ignore errors - we'll clear local data anyway
    }
  }
  clearAuthData();
}

// ============================================================================
// API Helpers
// ============================================================================

/**
 * Make authenticated request to Gmail API backend
 */
async function gmailRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const sessionToken = getSessionToken();
  if (!sessionToken) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${sessionToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (response.status === 401) {
    clearAuthData();
    throw new Error('Session expired - please re-authenticate');
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `API error: ${response.status}`);
  }

  return response.json();
}

// ============================================================================
// Messages
// ============================================================================

/**
 * List emails from Gmail
 */
export async function listMessages(params: {
  labelIds?: string;
  maxResults?: number;
  pageToken?: string;
  q?: string;
}): Promise<GmailMessagesResponse> {
  const queryParams = new URLSearchParams();
  if (params.labelIds) queryParams.set('labelIds', params.labelIds);
  if (params.maxResults) queryParams.set('maxResults', params.maxResults.toString());
  if (params.pageToken) queryParams.set('pageToken', params.pageToken);
  if (params.q) queryParams.set('q', params.q);

  return gmailRequest(`/gmail-messages?${queryParams}`);
}

/**
 * Get a single message with full content
 */
export async function getMessage(messageId: string): Promise<GmailMessage> {
  return gmailRequest(`/gmail-message?id=${messageId}`);
}

/**
 * Send an email
 */
export async function sendMessage(data: ComposeEmailData): Promise<{ id: string }> {
  return gmailRequest('/gmail-send', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Modify message labels (mark read/unread, star, archive, etc.)
 */
export async function modifyMessage(
  messageId: string,
  modification: LabelModification
): Promise<GmailMessage> {
  return gmailRequest(`/gmail-modify?id=${messageId}`, {
    method: 'POST',
    body: JSON.stringify(modification),
  });
}

/**
 * Mark message as read
 */
export async function markAsRead(messageId: string): Promise<GmailMessage> {
  return modifyMessage(messageId, { removeLabelIds: ['UNREAD'] });
}

/**
 * Mark message as unread
 */
export async function markAsUnread(messageId: string): Promise<GmailMessage> {
  return modifyMessage(messageId, { addLabelIds: ['UNREAD'] });
}

/**
 * Star a message
 */
export async function starMessage(messageId: string): Promise<GmailMessage> {
  return modifyMessage(messageId, { addLabelIds: ['STARRED'] });
}

/**
 * Unstar a message
 */
export async function unstarMessage(messageId: string): Promise<GmailMessage> {
  return modifyMessage(messageId, { removeLabelIds: ['STARRED'] });
}

/**
 * Archive a message (remove from INBOX)
 */
export async function archiveMessage(messageId: string): Promise<GmailMessage> {
  return modifyMessage(messageId, { removeLabelIds: ['INBOX'] });
}

/**
 * Move message to trash
 */
export async function trashMessage(messageId: string): Promise<GmailMessage> {
  return modifyMessage(messageId, { addLabelIds: ['TRASH'] });
}

// ============================================================================
// Labels
// ============================================================================

/**
 * List Gmail labels
 */
export async function listLabels(): Promise<GmailLabelsResponse> {
  return gmailRequest('/gmail-labels');
}

// ============================================================================
// Drafts
// ============================================================================

/**
 * List drafts
 */
export async function listDrafts(): Promise<GmailDraftsResponse> {
  return gmailRequest('/gmail-drafts');
}

/**
 * Create a draft
 */
export async function createDraft(data: ComposeEmailData): Promise<GmailDraft> {
  return gmailRequest('/gmail-drafts', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Get a specific draft
 */
export async function getDraft(draftId: string): Promise<GmailDraft> {
  return gmailRequest(`/gmail-draft?id=${draftId}`);
}

/**
 * Update a draft
 */
export async function updateDraft(draftId: string, data: ComposeEmailData): Promise<GmailDraft> {
  return gmailRequest(`/gmail-draft?id=${draftId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

/**
 * Delete a draft
 */
export async function deleteDraft(draftId: string): Promise<void> {
  await gmailRequest(`/gmail-draft?id=${draftId}`, {
    method: 'DELETE',
  });
}

// ============================================================================
// Parsing Utilities
// ============================================================================

/**
 * Get header value from message
 */
function getHeader(headers: Array<{ name: string; value: string }>, name: string): string {
  const header = headers.find(h => h.name.toLowerCase() === name.toLowerCase());
  return header?.value || '';
}

/**
 * Decode base64url encoded string
 */
function decodeBase64Url(data: string): string {
  try {
    const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
    return decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
  } catch {
    return '';
  }
}

/**
 * Extract body content from message payload
 */
function extractBody(payload: GmailMessage['payload']): { text: string; html?: string } {
  let text = '';
  let html: string | undefined;

  const processPayload = (part: GmailMessage['payload']) => {
    if (part.body?.data) {
      const decoded = decodeBase64Url(part.body.data);
      if (part.mimeType === 'text/html') {
        html = decoded;
      } else if (part.mimeType === 'text/plain') {
        text = decoded;
      }
    }
    if (part.parts) {
      part.parts.forEach(processPayload);
    }
  };

  processPayload(payload);
  return { text, html };
}

/**
 * Parse Gmail message into display-friendly format
 */
export function parseMessage(message: GmailMessage): ParsedEmail {
  const headers = message.payload.headers;
  const { text, html } = extractBody(message.payload);

  return {
    id: message.id,
    threadId: message.threadId,
    from: getHeader(headers, 'From'),
    to: getHeader(headers, 'To'),
    cc: getHeader(headers, 'Cc') || undefined,
    subject: getHeader(headers, 'Subject'),
    date: new Date(parseInt(message.internalDate)),
    body: text,
    htmlBody: html,
    labels: message.labelIds,
    isRead: !message.labelIds.includes('UNREAD'),
    isStarred: message.labelIds.includes('STARRED'),
  };
}

/**
 * Parse Gmail message into list item format
 */
export function parseMessageListItem(message: GmailMessage): EmailListItem {
  const headers = message.payload.headers;

  // Check for attachments
  const hasAttachments = message.payload.parts?.some(
    part => part.filename && part.filename.length > 0
  ) || false;

  return {
    id: message.id,
    threadId: message.threadId,
    from: getHeader(headers, 'From'),
    to: getHeader(headers, 'To'),
    subject: getHeader(headers, 'Subject'),
    snippet: message.snippet,
    date: new Date(parseInt(message.internalDate)),
    isRead: !message.labelIds.includes('UNREAD'),
    isStarred: message.labelIds.includes('STARRED'),
    labels: message.labelIds,
    hasAttachments,
  };
}

/**
 * Parse email address from "Name <email>" format
 */
export function parseEmailAddress(address: string): { name: string; email: string } {
  const match = address.match(/^(.+?)\s*<(.+?)>$/);
  if (match) {
    return { name: match[1].trim(), email: match[2].trim() };
  }
  return { name: address, email: address };
}

/**
 * Format date for display
 */
export function formatEmailDate(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    return date.toLocaleDateString([], { weekday: 'short' });
  } else if (date.getFullYear() === now.getFullYear()) {
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  } else {
    return date.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
  }
}
