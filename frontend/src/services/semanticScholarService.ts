/**
 * Semantic Scholar API Service
 * https://api.semanticscholar.org/
 *
 * Rate limits:
 * - Without API key: 100 requests per 5 minutes
 * - With API key: Higher limits available
 *
 * NOTE: Semantic Scholar API does not support CORS.
 * For browser usage, you need either:
 * 1. A backend proxy
 * 2. A CORS proxy service (set via corsProxyUrl config)
 */

const S2_BASE_URL = 'https://api.semanticscholar.org/graph/v1';

// Semantic Scholar API now supports CORS directly, no proxy needed
// You can still set a proxy if needed via configureSemanticScholar({ corsProxyUrl: '...' })

export interface SemanticScholarConfig {
  apiKey?: string;
  corsProxyUrl?: string; // e.g., 'https://corsproxy.io/?' or '' to disable
}

let config: SemanticScholarConfig = {
  corsProxyUrl: '', // CORS proxy disabled - S2 API supports CORS natively now
};

export function configureSemanticScholar(newConfig: SemanticScholarConfig) {
  config = newConfig;
}

function getBaseUrl(): string {
  if (config.corsProxyUrl) {
    return `${config.corsProxyUrl}${encodeURIComponent(S2_BASE_URL)}`;
  }
  return S2_BASE_URL;
}

function buildUrl(path: string, params?: URLSearchParams): string {
  const baseUrl = config.corsProxyUrl
    ? `${config.corsProxyUrl}${encodeURIComponent(`${S2_BASE_URL}${path}${params ? '?' + params.toString() : ''}`)}`
    : `${S2_BASE_URL}${path}${params ? '?' + params.toString() : ''}`;
  return baseUrl;
}

function getHeaders(): HeadersInit {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  if (config.apiKey) {
    headers['x-api-key'] = config.apiKey;
  }
  return headers;
}

// Paper fields that can be requested
export const PAPER_FIELDS = [
  'paperId', 'title', 'abstract', 'year', 'citationCount', 'referenceCount',
  'influentialCitationCount', 'isOpenAccess', 'openAccessPdf', 'fieldsOfStudy',
  'authors', 'authors.name', 'authors.authorId', 'authors.url',
  'externalIds', 'url', 'venue', 'publicationDate'
] as const;

// Author fields that can be requested
export const AUTHOR_FIELDS = [
  'authorId', 'name', 'url', 'affiliations', 'homepage', 'paperCount',
  'citationCount', 'hIndex'
] as const;

export interface S2Paper {
  paperId: string;
  title: string;
  abstract?: string;
  year?: number;
  citationCount?: number;
  referenceCount?: number;
  influentialCitationCount?: number;
  isOpenAccess?: boolean;
  openAccessPdf?: { url: string };
  fieldsOfStudy?: string[];
  authors?: S2Author[];
  externalIds?: {
    ArXiv?: string;
    DOI?: string;
    PubMed?: string;
  };
  url?: string;
  venue?: string;
  publicationDate?: string;
}

export interface S2Author {
  authorId: string;
  name: string;
  url?: string;
  affiliations?: string[];
  homepage?: string;
  paperCount?: number;
  citationCount?: number;
  hIndex?: number;
}

export interface S2SearchResponse {
  total: number;
  offset: number;
  next?: number;
  data: S2Paper[];
}

/**
 * Search for papers
 */
export async function searchPapers(
  query: string,
  options: { limit?: number; offset?: number; fields?: string[] } = {}
): Promise<S2SearchResponse> {
  const { limit = 10, offset = 0, fields = ['paperId', 'title', 'abstract', 'year', 'citationCount', 'authors'] } = options;

  const params = new URLSearchParams({
    query,
    limit: limit.toString(),
    offset: offset.toString(),
    fields: fields.join(','),
  });

  const response = await fetch(buildUrl('/paper/search', params), {
    headers: getHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Semantic Scholar API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * Get paper details by ID (Semantic Scholar ID, DOI, ArXiv ID, etc.)
 */
export async function getPaper(
  paperId: string,
  fields: string[] = ['paperId', 'title', 'abstract', 'year', 'citationCount', 'authors', 'externalIds']
): Promise<S2Paper> {
  const params = new URLSearchParams({ fields: fields.join(',') });

  const response = await fetch(buildUrl(`/paper/${paperId}`, params), {
    headers: getHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Semantic Scholar API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * Get paper by arXiv ID
 */
export async function getPaperByArxiv(arxivId: string, fields?: string[]): Promise<S2Paper> {
  return getPaper(`ArXiv:${arxivId}`, fields);
}

/**
 * Get paper by DOI
 */
export async function getPaperByDoi(doi: string, fields?: string[]): Promise<S2Paper> {
  return getPaper(`DOI:${doi}`, fields);
}

/**
 * Get paper citations
 */
export async function getPaperCitations(
  paperId: string,
  options: { limit?: number; offset?: number; fields?: string[] } = {}
): Promise<{ data: Array<{ citingPaper: S2Paper }> }> {
  const { limit = 100, offset = 0, fields = ['paperId', 'title', 'year', 'citationCount'] } = options;

  const params = new URLSearchParams({
    limit: limit.toString(),
    offset: offset.toString(),
    fields: fields.join(','),
  });

  const response = await fetch(buildUrl(`/paper/${paperId}/citations`, params), {
    headers: getHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Semantic Scholar API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * Get paper references
 */
export async function getPaperReferences(
  paperId: string,
  options: { limit?: number; offset?: number; fields?: string[] } = {}
): Promise<{ data: Array<{ citedPaper: S2Paper }> }> {
  const { limit = 100, offset = 0, fields = ['paperId', 'title', 'year', 'citationCount'] } = options;

  const params = new URLSearchParams({
    limit: limit.toString(),
    offset: offset.toString(),
    fields: fields.join(','),
  });

  const response = await fetch(buildUrl(`/paper/${paperId}/references`, params), {
    headers: getHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Semantic Scholar API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * Get author details
 */
export async function getAuthor(
  authorId: string,
  fields: string[] = ['authorId', 'name', 'url', 'affiliations', 'homepage', 'paperCount', 'citationCount', 'hIndex']
): Promise<S2Author> {
  const params = new URLSearchParams({ fields: fields.join(',') });

  const response = await fetch(buildUrl(`/author/${authorId}`, params), {
    headers: getHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Semantic Scholar API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * Search for authors
 */
export async function searchAuthors(
  query: string,
  options: { limit?: number; offset?: number; fields?: string[] } = {}
): Promise<{ total: number; data: S2Author[] }> {
  const { limit = 10, offset = 0, fields = ['authorId', 'name', 'affiliations', 'paperCount', 'citationCount'] } = options;

  const params = new URLSearchParams({
    query,
    limit: limit.toString(),
    offset: offset.toString(),
    fields: fields.join(','),
  });

  const response = await fetch(buildUrl('/author/search', params), {
    headers: getHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Semantic Scholar API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * Get author's papers
 */
export async function getAuthorPapers(
  authorId: string,
  options: { limit?: number; offset?: number; fields?: string[] } = {}
): Promise<{ data: S2Paper[] }> {
  const { limit = 100, offset = 0, fields = ['paperId', 'title', 'year', 'citationCount'] } = options;

  const params = new URLSearchParams({
    limit: limit.toString(),
    offset: offset.toString(),
    fields: fields.join(','),
  });

  const response = await fetch(buildUrl(`/author/${authorId}/papers`, params), {
    headers: getHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Semantic Scholar API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * Test API connectivity
 */
export async function testConnection(): Promise<boolean> {
  try {
    const params = new URLSearchParams({ query: 'test', limit: '1' });
    const response = await fetch(buildUrl('/paper/search', params), {
      headers: getHeaders(),
    });
    return response.ok;
  } catch {
    return false;
  }
}
