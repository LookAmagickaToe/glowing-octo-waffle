/**
 * Unified Search Service
 * Aggregates results from multiple academic APIs
 */

import { Paper } from '@/types';
import { searchArxiv } from './arxivService';
import * as semanticScholar from './semanticScholarService';
import * as openAlex from './openAlexService';
import * as crossRef from './crossrefService';

export interface SearchSource {
  id: string;
  name: string;
  enabled: boolean;
}

export interface UnifiedSearchOptions {
  maxResultsPerSource?: number;
  sources?: string[]; // Source IDs to search
}

export interface UnifiedSearchResult {
  papers: Paper[];
  sourceResults: {
    source: string;
    count: number;
    error?: string;
  }[];
}

/**
 * Search arXiv and convert to Paper format
 */
async function searchArxivSource(query: string, maxResults: number): Promise<Paper[]> {
  try {
    return await searchArxiv(query, { maxResults });
  } catch (error) {
    console.error('arXiv search failed:', error);
    throw error;
  }
}

/**
 * Search Semantic Scholar and convert to Paper format
 */
async function searchSemanticScholarSource(query: string, maxResults: number): Promise<Paper[]> {
  try {
    const response = await semanticScholar.searchPapers(query, {
      limit: maxResults,
      fields: ['paperId', 'title', 'abstract', 'year', 'citationCount', 'authors', 'externalIds', 'url', 'openAccessPdf'],
    });

    return response.data.map((paper): Paper => ({
      id: `s2-${paper.paperId}`,
      title: paper.title,
      authors: paper.authors?.map(a => a.name) || [],
      abstract: paper.abstract || '',
      year: paper.year || new Date().getFullYear(),
      source: 'Semantic Scholar',
      citations: paper.citationCount,
      url: paper.url,
      doi: paper.externalIds?.DOI,
      arxivId: paper.externalIds?.ArXiv,
      pdfUrl: paper.openAccessPdf?.url,
    }));
  } catch (error) {
    console.error('Semantic Scholar search failed:', error);
    throw error;
  }
}

/**
 * Search OpenAlex and convert to Paper format
 */
async function searchOpenAlexSource(query: string, maxResults: number): Promise<Paper[]> {
  try {
    const response = await openAlex.searchWorks(query, { perPage: maxResults });

    return response.results.map((work): Paper => ({
      id: `oa-${work.id.replace('https://openalex.org/', '')}`,
      title: work.display_name || work.title,
      authors: work.authorships.map(a => a.author.display_name),
      abstract: openAlex.reconstructAbstract(work.abstract_inverted_index),
      year: work.publication_year || new Date().getFullYear(),
      source: 'OpenAlex',
      citations: work.cited_by_count,
      url: work.id,
      doi: work.doi?.replace('https://doi.org/', ''),
      pdfUrl: work.open_access?.oa_url,
    }));
  } catch (error) {
    console.error('OpenAlex search failed:', error);
    throw error;
  }
}

/**
 * Search CrossRef and convert to Paper format
 */
async function searchCrossRefSource(query: string, maxResults: number): Promise<Paper[]> {
  try {
    const response = await crossRef.searchWorks(query, { rows: maxResults });

    return response.message.items.map((work): Paper => ({
      id: `cr-${work.DOI.replace(/\//g, '-')}`,
      title: work.title?.[0] || 'Untitled',
      authors: crossRef.formatAuthorName(work.author),
      abstract: work.abstract || '',
      year: crossRef.getPublicationYear(work) || new Date().getFullYear(),
      source: 'CrossRef',
      citations: work['is-referenced-by-count'],
      url: work.URL,
      doi: work.DOI,
    }));
  } catch (error) {
    console.error('CrossRef search failed:', error);
    throw error;
  }
}

/**
 * Unified search across multiple sources
 */
export async function unifiedSearch(
  query: string,
  options: UnifiedSearchOptions = {}
): Promise<UnifiedSearchResult> {
  const {
    maxResultsPerSource = 10,
    sources = ['arxiv', 'semantic-scholar', 'openalex', 'crossref'],
  } = options;

  const sourceResults: UnifiedSearchResult['sourceResults'] = [];
  const allPapers: Paper[] = [];

  // Create search promises for enabled sources
  const searchPromises: Promise<void>[] = [];

  if (sources.includes('arxiv')) {
    searchPromises.push(
      searchArxivSource(query, maxResultsPerSource)
        .then(papers => {
          allPapers.push(...papers);
          sourceResults.push({ source: 'arXiv', count: papers.length });
        })
        .catch(error => {
          sourceResults.push({ source: 'arXiv', count: 0, error: error.message });
        })
    );
  }

  if (sources.includes('semantic-scholar')) {
    searchPromises.push(
      searchSemanticScholarSource(query, maxResultsPerSource)
        .then(papers => {
          allPapers.push(...papers);
          sourceResults.push({ source: 'Semantic Scholar', count: papers.length });
        })
        .catch(error => {
          sourceResults.push({ source: 'Semantic Scholar', count: 0, error: error.message });
        })
    );
  }

  if (sources.includes('openalex')) {
    searchPromises.push(
      searchOpenAlexSource(query, maxResultsPerSource)
        .then(papers => {
          allPapers.push(...papers);
          sourceResults.push({ source: 'OpenAlex', count: papers.length });
        })
        .catch(error => {
          sourceResults.push({ source: 'OpenAlex', count: 0, error: error.message });
        })
    );
  }

  if (sources.includes('crossref')) {
    searchPromises.push(
      searchCrossRefSource(query, maxResultsPerSource)
        .then(papers => {
          allPapers.push(...papers);
          sourceResults.push({ source: 'CrossRef', count: papers.length });
        })
        .catch(error => {
          sourceResults.push({ source: 'CrossRef', count: 0, error: error.message });
        })
    );
  }

  // Wait for all searches to complete
  await Promise.all(searchPromises);

  // Deduplicate by DOI if available, keeping the one with most data
  const deduplicatedPapers = deduplicatePapers(allPapers);

  return {
    papers: deduplicatedPapers,
    sourceResults,
  };
}

/**
 * Deduplicate papers by DOI, preferring entries with more data
 */
function deduplicatePapers(papers: Paper[]): Paper[] {
  const doiMap = new Map<string, Paper>();
  const noDoi: Paper[] = [];

  for (const paper of papers) {
    if (paper.doi) {
      const normalizedDoi = paper.doi.toLowerCase();
      const existing = doiMap.get(normalizedDoi);

      if (!existing || scorePaper(paper) > scorePaper(existing)) {
        doiMap.set(normalizedDoi, paper);
      }
    } else {
      noDoi.push(paper);
    }
  }

  return [...doiMap.values(), ...noDoi];
}

/**
 * Score a paper based on data completeness
 */
function scorePaper(paper: Paper): number {
  let score = 0;
  if (paper.title) score += 1;
  if (paper.abstract && paper.abstract.length > 50) score += 2;
  if (paper.authors.length > 0) score += 1;
  if (paper.citations !== undefined) score += 1;
  if (paper.pdfUrl) score += 1;
  if (paper.doi) score += 1;
  if (paper.arxivId) score += 1;
  return score;
}

/**
 * Test all API connections
 */
export async function testAllConnections(): Promise<Record<string, boolean>> {
  const results: Record<string, boolean> = {};

  const tests = [
    { name: 'arXiv', test: () => searchArxiv('test', { maxResults: 1 }).then(() => true).catch(() => false) },
    { name: 'Semantic Scholar', test: semanticScholar.testConnection },
    { name: 'OpenAlex', test: openAlex.testConnection },
    { name: 'CrossRef', test: crossRef.testConnection },
  ];

  await Promise.all(
    tests.map(async ({ name, test }) => {
      try {
        results[name] = await test();
      } catch {
        results[name] = false;
      }
    })
  );

  return results;
}
