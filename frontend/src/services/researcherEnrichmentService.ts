/**
 * Researcher Enrichment Service
 * Fetches additional data about researchers from multiple APIs
 */

import { Researcher, Paper } from '@/types';
import * as semanticScholar from './semanticScholarService';
import * as openAlex from './openAlexService';
import * as orcid from './orcidService';
import * as perplexity from './perplexityService';

export interface SourceResult {
  found: boolean;
  hIndex?: number;
  citations?: number;
  publications?: number;
  email?: string;
  homepage?: string;
  affiliation?: string;
  error?: string;
}

export interface EnrichmentResult {
  researcher: Researcher;
  sources: string[];
  details: {
    perplexity: SourceResult;
    semanticScholar: SourceResult;
    openAlex: SourceResult;
    orcid: SourceResult;
  };
}

/**
 * Convert Semantic Scholar paper to our Paper format
 */
function s2PaperToPaper(s2Paper: semanticScholar.S2Paper): Paper {
  return {
    id: `s2-${s2Paper.paperId}`,
    title: s2Paper.title,
    authors: s2Paper.authors?.map(a => a.name) || [],
    abstract: s2Paper.abstract || '',
    year: s2Paper.year || new Date().getFullYear(),
    source: 'Semantic Scholar',
    citations: s2Paper.citationCount,
    url: s2Paper.url,
    doi: s2Paper.externalIds?.DOI,
    arxivId: s2Paper.externalIds?.ArXiv,
    pdfUrl: s2Paper.openAccessPdf?.url,
  };
}

/**
 * Convert OpenAlex work to our Paper format
 */
function oaWorkToPaper(work: openAlex.OpenAlexWork): Paper {
  return {
    id: `oa-${work.id.split('/').pop()}`,
    title: work.title,
    authors: work.authorships?.map(a => a.author.display_name) || [],
    abstract: '',
    year: work.publication_year,
    source: 'OpenAlex',
    citations: work.cited_by_count,
    doi: work.doi?.replace('https://doi.org/', ''),
    url: work.doi || undefined,
  };
}

/**
 * Search for researcher in Semantic Scholar and get their ID
 */
async function findInSemanticScholar(name: string): Promise<{
  authorId: string;
  author: semanticScholar.S2Author;
} | null> {
  try {
    const results = await semanticScholar.searchAuthors(name, { limit: 5 });
    if (results.data.length > 0) {
      // Find best match by name similarity
      const match = results.data.find(
        a => a.name.toLowerCase() === name.toLowerCase()
      ) || results.data[0];

      // Get full author details
      const author = await semanticScholar.getAuthor(match.authorId, [
        'authorId', 'name', 'affiliations', 'homepage', 'paperCount',
        'citationCount', 'hIndex'
      ]);

      return { authorId: match.authorId, author };
    }
  } catch (err) {
    console.error('Semantic Scholar lookup failed:', err);
  }
  return null;
}

/**
 * Search for researcher in OpenAlex and get their ID
 */
async function findInOpenAlex(name: string): Promise<{
  authorId: string;
  author: openAlex.OpenAlexAuthor;
} | null> {
  try {
    const results = await openAlex.searchAuthors(name, { perPage: 5 });
    if (results.results.length > 0) {
      const match = results.results.find(
        a => a.display_name.toLowerCase() === name.toLowerCase()
      ) || results.results[0];

      return {
        authorId: match.id.split('/').pop() || match.id,
        author: match
      };
    }
  } catch (err) {
    console.error('OpenAlex lookup failed:', err);
  }
  return null;
}

/**
 * Search for researcher in ORCID
 */
async function findInOrcid(name: string): Promise<{
  orcidId: string;
  email?: string;
  homepage?: string;
} | null> {
  try {
    // Parse name into parts for better search
    const nameParts = name.trim().split(/\s+/);
    let query: string;

    if (nameParts.length >= 2) {
      // Assume "Given Family" format
      const givenName = nameParts.slice(0, -1).join(' ');
      const familyName = nameParts[nameParts.length - 1];
      query = `given-names:${givenName} AND family-name:${familyName}`;
    } else {
      // Single name, search in both fields
      query = `given-names:${name} OR family-name:${name}`;
    }

    const results = await orcid.search(query, { rows: 5 });
    if (results.result && results.result.length > 0) {
      const match = results.result[0];
      const orcidId = match['orcid-identifier'].path;

      // Get full profile for email and URLs
      try {
        const person = await orcid.getPerson(orcidId);
        const email = orcid.getPrimaryEmail(person);
        const urls = orcid.getUrls(person);
        const homepage = urls.find(u =>
          u.name?.toLowerCase().includes('homepage') ||
          u.name?.toLowerCase().includes('website') ||
          u.name?.toLowerCase().includes('personal')
        )?.url || urls[0]?.url;

        return { orcidId, email: email || undefined, homepage };
      } catch {
        return { orcidId };
      }
    }
  } catch (err) {
    console.error('ORCID lookup failed:', err);
  }
  return null;
}

/**
 * Fetch publications for a researcher from Semantic Scholar
 */
async function fetchS2Publications(authorId: string, limit: number = 20): Promise<Paper[]> {
  try {
    const response = await semanticScholar.getAuthorPapers(authorId, {
      limit,
      fields: ['paperId', 'title', 'abstract', 'year', 'citationCount', 'authors', 'externalIds', 'url', 'openAccessPdf'],
    });

    return response.data
      .filter(p => p.title)
      .map(s2PaperToPaper);
  } catch (err) {
    console.error('Failed to fetch S2 publications:', err);
    return [];
  }
}

/**
 * Fetch publications for a researcher from OpenAlex
 */
async function fetchOAPublications(authorId: string, limit: number = 20): Promise<Paper[]> {
  try {
    const response = await openAlex.getAuthorWorks(authorId, { perPage: limit });

    return response.results
      .filter(w => w.title)
      .map(oaWorkToPaper);
  } catch (err) {
    console.error('Failed to fetch OA publications:', err);
    return [];
  }
}

/**
 * Enrich a researcher with data from multiple APIs
 */
export async function enrichResearcher(
  researcher: Researcher,
  onProgress?: (message: string) => void
): Promise<EnrichmentResult> {
  const sources: string[] = [];
  let enriched: Researcher = { ...researcher };
  let publications: Paper[] = [];

  // Initialize details for each source
  const details: EnrichmentResult['details'] = {
    perplexity: { found: false },
    semanticScholar: { found: false },
    openAlex: { found: false },
    orcid: { found: false },
  };

  // Call Perplexity first as PRIMARY source for email and lab
  onProgress?.('Searching for contact info via Perplexity...');
  try {
    const perplexityResult = await perplexity.enrichResearcher(
      researcher.name,
      researcher.affiliation
    );

    if (perplexityResult.success && perplexityResult.found) {
      sources.push('Perplexity');
      details.perplexity = {
        found: true,
        email: perplexityResult.email || undefined,
        affiliation: perplexityResult.institution || undefined,
      };

      // Use Perplexity results as primary source
      if (perplexityResult.email) {
        enriched.email = perplexityResult.email;
      }
      if (perplexityResult.institution) {
        enriched.affiliation = perplexityResult.institution;
      }
    }
  } catch (err) {
    console.error('Perplexity enrichment failed:', err);
    details.perplexity = {
      found: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }

  onProgress?.('Looking up researcher profiles...');

  // Search all APIs in parallel
  const [s2Result, oaResult, orcidResult] = await Promise.all([
    findInSemanticScholar(researcher.name),
    findInOpenAlex(researcher.name),
    findInOrcid(researcher.name),
  ]);

  // Enrich from Semantic Scholar
  if (s2Result) {
    sources.push('Semantic Scholar');
    details.semanticScholar = {
      found: true,
      hIndex: s2Result.author.hIndex,
      citations: s2Result.author.citationCount,
      publications: s2Result.author.paperCount,
      homepage: s2Result.author.homepage,
      affiliation: s2Result.author.affiliations?.[0],
    };

    enriched.semanticScholarId = s2Result.authorId;
    enriched.hIndex = enriched.hIndex || s2Result.author.hIndex;
    enriched.citations = enriched.citations || s2Result.author.citationCount;
    enriched.homepage = enriched.homepage || s2Result.author.homepage;

    if (s2Result.author.affiliations?.length) {
      enriched.affiliation = enriched.affiliation || s2Result.author.affiliations[0];
    }

    // Fetch publications from S2
    onProgress?.('Fetching publications from Semantic Scholar...');
    const s2Pubs = await fetchS2Publications(s2Result.authorId, 20);
    publications.push(...s2Pubs);
  }

  // Enrich from OpenAlex
  if (oaResult) {
    sources.push('OpenAlex');
    details.openAlex = {
      found: true,
      hIndex: oaResult.author.summary_stats?.h_index,
      citations: oaResult.author.cited_by_count,
      publications: oaResult.author.works_count,
      affiliation: oaResult.author.last_known_institution?.display_name,
    };

    enriched.openAlexId = oaResult.authorId;
    enriched.hIndex = enriched.hIndex || oaResult.author.summary_stats?.h_index;
    enriched.citations = enriched.citations || oaResult.author.cited_by_count;

    if (oaResult.author.last_known_institution?.display_name) {
      enriched.affiliation = enriched.affiliation || oaResult.author.last_known_institution.display_name;
    }

    // Fetch publications from OpenAlex if we don't have enough
    if (publications.length < 10) {
      onProgress?.('Fetching publications from OpenAlex...');
      const oaPubs = await fetchOAPublications(oaResult.authorId, 20);

      // Dedupe by title
      const existingTitles = new Set(publications.map(p => p.title.toLowerCase()));
      for (const pub of oaPubs) {
        if (!existingTitles.has(pub.title.toLowerCase())) {
          publications.push(pub);
          existingTitles.add(pub.title.toLowerCase());
        }
      }
    }
  }

  // Enrich from ORCID (especially for email)
  if (orcidResult) {
    sources.push('ORCID');
    details.orcid = {
      found: true,
      email: orcidResult.email,
      homepage: orcidResult.homepage,
    };

    enriched.orcidId = orcidResult.orcidId;
    enriched.email = enriched.email || orcidResult.email;
    enriched.homepage = enriched.homepage || orcidResult.homepage;
  }

  // Sort publications by citations (descending)
  publications.sort((a, b) => (b.citations || 0) - (a.citations || 0));

  // Limit to top 50 publications
  enriched.publications = publications.slice(0, 50);
  enriched.papers = enriched.publications.map(p => p.id);
  enriched.enrichedAt = new Date().toISOString();

  onProgress?.(`Enriched from ${sources.length} sources`);

  return { researcher: enriched, sources, details };
}

/**
 * Quick lookup to try to find email for a researcher
 */
export async function findResearcherEmail(name: string, affiliation?: string): Promise<string | null> {
  // Try Perplexity first (primary source)
  try {
    const perplexityResult = await perplexity.enrichResearcher(name, affiliation);
    if (perplexityResult.success && perplexityResult.email) {
      return perplexityResult.email;
    }
  } catch (err) {
    console.error('Perplexity email lookup failed:', err);
  }

  // Fallback to ORCID
  const orcidResult = await findInOrcid(name);
  if (orcidResult?.email) {
    return orcidResult.email;
  }

  // Try Semantic Scholar for homepage (might extract email from there)
  const s2Result = await findInSemanticScholar(name);
  if (s2Result?.author.homepage) {
    // Could potentially scrape homepage for email, but that's beyond scope
    return null;
  }

  return null;
}
