/**
 * OpenAlex API Service
 * https://docs.openalex.org/
 *
 * Free and open, no API key required.
 * Polite pool (with email) gets better rate limits: 100k requests/day
 * Without email: 10 requests/second, 100k requests/day
 */

const BASE_URL = 'https://api.openalex.org';

export interface OpenAlexConfig {
  email?: string; // For polite pool access
}

let config: OpenAlexConfig = {};

export function configureOpenAlex(newConfig: OpenAlexConfig) {
  config = newConfig;
}

function buildUrl(path: string, params: URLSearchParams): string {
  if (config.email) {
    params.set('mailto', config.email);
  }
  return `${BASE_URL}${path}?${params}`;
}

// Types
export interface OpenAlexWork {
  id: string;
  doi?: string;
  title: string;
  display_name: string;
  publication_year?: number;
  publication_date?: string;
  type: string;
  cited_by_count: number;
  is_oa: boolean;
  open_access?: {
    is_oa: boolean;
    oa_status: string;
    oa_url?: string;
  };
  authorships: Array<{
    author_position: string;
    author: {
      id: string;
      display_name: string;
      orcid?: string;
    };
    institutions: Array<{
      id: string;
      display_name: string;
      country_code?: string;
    }>;
  }>;
  concepts: Array<{
    id: string;
    display_name: string;
    level: number;
    score: number;
  }>;
  abstract_inverted_index?: Record<string, number[]>;
  referenced_works: string[];
  related_works: string[];
  ids: {
    openalex?: string;
    doi?: string;
    pmid?: string;
    mag?: string;
  };
}

export interface OpenAlexAuthor {
  id: string;
  orcid?: string;
  display_name: string;
  display_name_alternatives: string[];
  works_count: number;
  cited_by_count: number;
  summary_stats?: {
    h_index: number;
    i10_index: number;
    '2yr_mean_citedness': number;
  };
  last_known_institution?: {
    id: string;
    display_name: string;
    country_code?: string;
    type: string;
  };
  x_concepts: Array<{
    id: string;
    display_name: string;
    level: number;
    score: number;
  }>;
  counts_by_year: Array<{
    year: number;
    works_count: number;
    cited_by_count: number;
  }>;
}

export interface OpenAlexInstitution {
  id: string;
  display_name: string;
  country_code?: string;
  type: string;
  homepage_url?: string;
  works_count: number;
  cited_by_count: number;
}

export interface OpenAlexResponse<T> {
  meta: {
    count: number;
    db_response_time_ms: number;
    page: number;
    per_page: number;
  };
  results: T[];
}

/**
 * Search for works (papers)
 */
export async function searchWorks(
  query: string,
  options: {
    page?: number;
    perPage?: number;
    filter?: string;
    sort?: string;
  } = {}
): Promise<OpenAlexResponse<OpenAlexWork>> {
  const { page = 1, perPage = 25, filter, sort } = options;

  const params = new URLSearchParams({
    search: query,
    page: page.toString(),
    per_page: perPage.toString(),
  });

  if (filter) params.set('filter', filter);
  if (sort) params.set('sort', sort);

  const response = await fetch(buildUrl('/works', params));

  if (!response.ok) {
    throw new Error(`OpenAlex API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * Get work by ID (OpenAlex ID, DOI, etc.)
 */
export async function getWork(workId: string): Promise<OpenAlexWork> {
  const params = new URLSearchParams();
  const url = buildUrl(`/works/${encodeURIComponent(workId)}`, params);

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`OpenAlex API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * Get work by DOI
 */
export async function getWorkByDoi(doi: string): Promise<OpenAlexWork> {
  return getWork(`doi:${doi}`);
}

/**
 * Search for authors
 */
export async function searchAuthors(
  query: string,
  options: {
    page?: number;
    perPage?: number;
    filter?: string;
  } = {}
): Promise<OpenAlexResponse<OpenAlexAuthor>> {
  const { page = 1, perPage = 25, filter } = options;

  const params = new URLSearchParams({
    search: query,
    page: page.toString(),
    per_page: perPage.toString(),
  });

  if (filter) params.set('filter', filter);

  const response = await fetch(buildUrl('/authors', params));

  if (!response.ok) {
    throw new Error(`OpenAlex API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * Get author by ID (OpenAlex ID or ORCID)
 */
export async function getAuthor(authorId: string): Promise<OpenAlexAuthor> {
  const params = new URLSearchParams();
  const url = buildUrl(`/authors/${encodeURIComponent(authorId)}`, params);

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`OpenAlex API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * Get author by ORCID
 */
export async function getAuthorByOrcid(orcid: string): Promise<OpenAlexAuthor> {
  return getAuthor(`orcid:${orcid}`);
}

/**
 * Get author's works
 */
export async function getAuthorWorks(
  authorId: string,
  options: {
    page?: number;
    perPage?: number;
    sort?: string;
  } = {}
): Promise<OpenAlexResponse<OpenAlexWork>> {
  const { page = 1, perPage = 25, sort = 'cited_by_count:desc' } = options;

  const params = new URLSearchParams({
    filter: `author.id:${authorId}`,
    page: page.toString(),
    per_page: perPage.toString(),
    sort,
  });

  const response = await fetch(buildUrl('/works', params));

  if (!response.ok) {
    throw new Error(`OpenAlex API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * Search for institutions
 */
export async function searchInstitutions(
  query: string,
  options: {
    page?: number;
    perPage?: number;
  } = {}
): Promise<OpenAlexResponse<OpenAlexInstitution>> {
  const { page = 1, perPage = 25 } = options;

  const params = new URLSearchParams({
    search: query,
    page: page.toString(),
    per_page: perPage.toString(),
  });

  const response = await fetch(buildUrl('/institutions', params));

  if (!response.ok) {
    throw new Error(`OpenAlex API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * Get institution by ID
 */
export async function getInstitution(institutionId: string): Promise<OpenAlexInstitution> {
  const params = new URLSearchParams();
  const url = buildUrl(`/institutions/${encodeURIComponent(institutionId)}`, params);

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`OpenAlex API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * Get citations for a work
 */
export async function getWorkCitations(
  workId: string,
  options: { page?: number; perPage?: number } = {}
): Promise<OpenAlexResponse<OpenAlexWork>> {
  const { page = 1, perPage = 25 } = options;

  const params = new URLSearchParams({
    filter: `cites:${workId}`,
    page: page.toString(),
    per_page: perPage.toString(),
  });

  const response = await fetch(buildUrl('/works', params));

  if (!response.ok) {
    throw new Error(`OpenAlex API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * Reconstruct abstract from inverted index
 */
export function reconstructAbstract(invertedIndex: Record<string, number[]> | undefined): string {
  if (!invertedIndex) return '';

  const words: Array<{ word: string; position: number }> = [];

  for (const [word, positions] of Object.entries(invertedIndex)) {
    for (const position of positions) {
      words.push({ word, position });
    }
  }

  words.sort((a, b) => a.position - b.position);
  return words.map(w => w.word).join(' ');
}

/**
 * Test API connectivity
 */
export async function testConnection(): Promise<boolean> {
  try {
    const params = new URLSearchParams({ search: 'test', per_page: '1' });
    const response = await fetch(buildUrl('/works', params));
    return response.ok;
  } catch {
    return false;
  }
}
