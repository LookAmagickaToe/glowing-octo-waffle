/**
 * CrossRef API Service
 * https://api.crossref.org/swagger-ui/index.html
 *
 * Free and open, no API key required.
 * Polite pool (with email) gets better rate limits: 50 requests/second
 * Without email: Rate limited more aggressively
 */

const BASE_URL = 'https://api.crossref.org';

export interface CrossRefConfig {
  email?: string; // For polite pool access
}

let config: CrossRefConfig = {};

export function configureCrossRef(newConfig: CrossRefConfig) {
  config = newConfig;
}

function getHeaders(): HeadersInit {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  if (config.email) {
    headers['User-Agent'] = `PaperScraper/1.0 (mailto:${config.email})`;
  }
  return headers;
}

// Types
export interface CrossRefWork {
  DOI: string;
  URL: string;
  title: string[];
  author?: Array<{
    given?: string;
    family?: string;
    name?: string;
    ORCID?: string;
    affiliation?: Array<{ name: string }>;
  }>;
  'container-title'?: string[];
  'published-print'?: { 'date-parts': number[][] };
  'published-online'?: { 'date-parts': number[][] };
  created?: { 'date-parts': number[][] };
  issued?: { 'date-parts': number[][] };
  type: string;
  abstract?: string;
  subject?: string[];
  'is-referenced-by-count': number;
  'references-count': number;
  publisher?: string;
  ISSN?: string[];
  ISBN?: string[];
  license?: Array<{
    URL: string;
    'content-version': string;
  }>;
  link?: Array<{
    URL: string;
    'content-type': string;
  }>;
  reference?: Array<{
    key: string;
    DOI?: string;
    'article-title'?: string;
    author?: string;
    year?: string;
  }>;
}

export interface CrossRefResponse<T> {
  status: string;
  'message-type': string;
  'message-version': string;
  message: T;
}

export interface CrossRefListMessage<T> {
  facets: Record<string, unknown>;
  'total-results': number;
  items: T[];
  'items-per-page': number;
  query: {
    'start-index': number;
    'search-terms': string;
  };
}

/**
 * Search for works (papers)
 */
export async function searchWorks(
  query: string,
  options: {
    rows?: number;
    offset?: number;
    filter?: string;
    sort?: string;
    order?: 'asc' | 'desc';
  } = {}
): Promise<CrossRefResponse<CrossRefListMessage<CrossRefWork>>> {
  const { rows = 20, offset = 0, filter, sort, order } = options;

  const params = new URLSearchParams({
    query,
    rows: rows.toString(),
    offset: offset.toString(),
  });

  if (filter) params.set('filter', filter);
  if (sort) params.set('sort', sort);
  if (order) params.set('order', order);

  const response = await fetch(`${BASE_URL}/works?${params}`, {
    headers: getHeaders(),
  });

  if (!response.ok) {
    throw new Error(`CrossRef API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * Get work by DOI
 */
export async function getWork(doi: string): Promise<CrossRefResponse<CrossRefWork>> {
  const response = await fetch(`${BASE_URL}/works/${encodeURIComponent(doi)}`, {
    headers: getHeaders(),
  });

  if (!response.ok) {
    throw new Error(`CrossRef API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * Get works citing a DOI
 */
export async function getCitations(
  doi: string,
  options: { rows?: number; offset?: number } = {}
): Promise<CrossRefResponse<CrossRefListMessage<CrossRefWork>>> {
  const { rows = 20, offset = 0 } = options;

  const params = new URLSearchParams({
    filter: `references:${doi}`,
    rows: rows.toString(),
    offset: offset.toString(),
  });

  const response = await fetch(`${BASE_URL}/works?${params}`, {
    headers: getHeaders(),
  });

  if (!response.ok) {
    throw new Error(`CrossRef API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * Search works by author ORCID
 */
export async function getWorksByOrcid(
  orcid: string,
  options: { rows?: number; offset?: number } = {}
): Promise<CrossRefResponse<CrossRefListMessage<CrossRefWork>>> {
  const { rows = 20, offset = 0 } = options;

  const params = new URLSearchParams({
    filter: `orcid:${orcid}`,
    rows: rows.toString(),
    offset: offset.toString(),
  });

  const response = await fetch(`${BASE_URL}/works?${params}`, {
    headers: getHeaders(),
  });

  if (!response.ok) {
    throw new Error(`CrossRef API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * Search works by funder DOI
 */
export async function getWorksByFunder(
  funderDoi: string,
  options: { rows?: number; offset?: number } = {}
): Promise<CrossRefResponse<CrossRefListMessage<CrossRefWork>>> {
  const { rows = 20, offset = 0 } = options;

  const params = new URLSearchParams({
    filter: `funder:${funderDoi}`,
    rows: rows.toString(),
    offset: offset.toString(),
  });

  const response = await fetch(`${BASE_URL}/works?${params}`, {
    headers: getHeaders(),
  });

  if (!response.ok) {
    throw new Error(`CrossRef API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * Get journal information by ISSN
 */
export async function getJournal(issn: string): Promise<CrossRefResponse<{
  title: string;
  publisher: string;
  ISSN: string[];
  'is-referenced-by-count': number;
  'works-count': number;
  subjects: Array<{ name: string }>;
}>> {
  const response = await fetch(`${BASE_URL}/journals/${issn}`, {
    headers: getHeaders(),
  });

  if (!response.ok) {
    throw new Error(`CrossRef API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * Search for funders
 */
export async function searchFunders(
  query: string,
  options: { rows?: number; offset?: number } = {}
): Promise<CrossRefResponse<CrossRefListMessage<{
  id: string;
  name: string;
  location: string;
  'alt-names': string[];
  uri: string;
  'work-count': number;
}>>> {
  const { rows = 20, offset = 0 } = options;

  const params = new URLSearchParams({
    query,
    rows: rows.toString(),
    offset: offset.toString(),
  });

  const response = await fetch(`${BASE_URL}/funders?${params}`, {
    headers: getHeaders(),
  });

  if (!response.ok) {
    throw new Error(`CrossRef API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * Extract publication year from CrossRef work
 */
export function getPublicationYear(work: CrossRefWork): number | null {
  const dateParts =
    work['published-print']?.['date-parts']?.[0] ||
    work['published-online']?.['date-parts']?.[0] ||
    work.issued?.['date-parts']?.[0] ||
    work.created?.['date-parts']?.[0];

  return dateParts?.[0] || null;
}

/**
 * Format author name from CrossRef author object
 */
export function formatAuthorName(author: CrossRefWork['author']): string[] {
  if (!author) return [];
  return author.map(a => {
    if (a.name) return a.name;
    return `${a.given || ''} ${a.family || ''}`.trim();
  }).filter(Boolean);
}

/**
 * Test API connectivity
 */
export async function testConnection(): Promise<boolean> {
  try {
    const response = await fetch(`${BASE_URL}/works?query=test&rows=1`, {
      headers: getHeaders(),
    });
    return response.ok;
  } catch {
    return false;
  }
}
