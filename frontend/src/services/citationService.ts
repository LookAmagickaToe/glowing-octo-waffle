/**
 * Citation Expansion Service
 * Uses Semantic Scholar API to fetch citation relationships
 */

import { Paper, GraphData, GraphNode, GraphLink } from '@/types';
import * as semanticScholar from './semanticScholarService';

export interface CitationExpansionOptions {
  maxDegrees?: number; // How many levels of citations to fetch (default 2)
  maxPapersPerDegree?: number; // Max papers to fetch per degree (default 10)
  maxTotalPapers?: number; // Max total papers in graph (default 100)
  includeCitations?: boolean; // Papers that cite this paper
  includeReferences?: boolean; // Papers this paper cites
}

export interface CitationGraph {
  papers: Map<string, Paper>;
  citations: Map<string, string[]>; // paperId -> [citing paper ids]
  references: Map<string, string[]>; // paperId -> [referenced paper ids]
}

/**
 * Convert a Paper to Semantic Scholar lookup ID
 * Prefers DOI, then arXiv ID, then title search
 */
function getPaperLookupId(paper: Paper): string | null {
  if (paper.doi) {
    return `DOI:${paper.doi}`;
  }
  if (paper.arxivId) {
    return `ArXiv:${paper.arxivId}`;
  }
  // Can't reliably look up by title
  return null;
}

/**
 * Convert Semantic Scholar paper to our Paper format
 */
function s2ToPaper(s2Paper: semanticScholar.S2Paper): Paper {
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
 * Fetch citations for a single paper from Semantic Scholar
 */
async function fetchPaperCitations(
  paperId: string,
  limit: number = 10
): Promise<Paper[]> {
  try {
    const response = await semanticScholar.getPaperCitations(paperId, {
      limit,
      fields: ['paperId', 'title', 'abstract', 'year', 'citationCount', 'authors', 'externalIds', 'url', 'openAccessPdf'],
    });

    return response.data
      .filter(item => item.citingPaper && item.citingPaper.title)
      .map(item => s2ToPaper(item.citingPaper));
  } catch (error) {
    console.error(`Failed to fetch citations for ${paperId}:`, error);
    return [];
  }
}

/**
 * Fetch references for a single paper from Semantic Scholar
 */
async function fetchPaperReferences(
  paperId: string,
  limit: number = 10
): Promise<Paper[]> {
  try {
    const response = await semanticScholar.getPaperReferences(paperId, {
      limit,
      fields: ['paperId', 'title', 'abstract', 'year', 'citationCount', 'authors', 'externalIds', 'url', 'openAccessPdf'],
    });

    return response.data
      .filter(item => item.citedPaper && item.citedPaper.title)
      .map(item => s2ToPaper(item.citedPaper));
  } catch (error) {
    console.error(`Failed to fetch references for ${paperId}:`, error);
    return [];
  }
}

/**
 * Look up a paper in Semantic Scholar and get its S2 paper ID
 */
async function lookupPaperInS2(paper: Paper): Promise<string | null> {
  const lookupId = getPaperLookupId(paper);

  if (lookupId) {
    try {
      const s2Paper = await semanticScholar.getPaper(lookupId, ['paperId']);
      return s2Paper.paperId;
    } catch {
      // Paper not found in S2
    }
  }

  // Try searching by title
  try {
    const searchResult = await semanticScholar.searchPapers(paper.title, {
      limit: 1,
      fields: ['paperId', 'title'],
    });

    if (searchResult.data.length > 0) {
      // Verify title matches reasonably well
      const foundTitle = searchResult.data[0].title.toLowerCase();
      const searchTitle = paper.title.toLowerCase();
      if (foundTitle.includes(searchTitle.slice(0, 30)) || searchTitle.includes(foundTitle.slice(0, 30))) {
        return searchResult.data[0].paperId;
      }
    }
  } catch {
    // Search failed
  }

  return null;
}

/**
 * Expand papers to include citations up to N degrees
 */
export async function expandCitations(
  seedPapers: Paper[],
  options: CitationExpansionOptions = {},
  onProgress?: (message: string, current: number, total: number) => void
): Promise<{
  papers: Paper[];
  citationLinks: Array<{ from: string; to: string }>;
  referenceLinks: Array<{ from: string; to: string }>;
}> {
  const {
    maxDegrees = 2,
    maxPapersPerDegree = 10,
    maxTotalPapers = 100,
    includeCitations = true,
    includeReferences = false,
  } = options;

  const allPapers = new Map<string, Paper>();
  const citationLinks: Array<{ from: string; to: string }> = [];
  const referenceLinks: Array<{ from: string; to: string }> = [];
  const processedPaperIds = new Set<string>();

  // Map our paper IDs to S2 paper IDs
  const paperIdToS2Id = new Map<string, string>();

  // Add seed papers to the collection
  for (const paper of seedPapers) {
    allPapers.set(paper.id, paper);
  }

  // Queue of papers to process at each degree
  let currentDegreeQueue: Paper[] = [...seedPapers];

  for (let degree = 1; degree <= maxDegrees; degree++) {
    if (allPapers.size >= maxTotalPapers) break;
    if (currentDegreeQueue.length === 0) break;

    const nextDegreeQueue: Paper[] = [];
    const totalInDegree = currentDegreeQueue.length;

    onProgress?.(`Fetching degree ${degree} citations...`, 0, totalInDegree);

    for (let i = 0; i < currentDegreeQueue.length; i++) {
      const paper = currentDegreeQueue[i];

      if (processedPaperIds.has(paper.id)) continue;
      processedPaperIds.add(paper.id);

      onProgress?.(`Processing: ${paper.title.slice(0, 50)}...`, i + 1, totalInDegree);

      // Look up S2 ID if we don't have it
      let s2Id = paperIdToS2Id.get(paper.id);
      if (!s2Id) {
        s2Id = await lookupPaperInS2(paper);
        if (s2Id) {
          paperIdToS2Id.set(paper.id, s2Id);
        }
      }

      if (!s2Id) {
        console.log(`Could not find S2 ID for: ${paper.title}`);
        continue;
      }

      // Fetch citations (papers that cite this paper)
      if (includeCitations) {
        const citations = await fetchPaperCitations(s2Id, maxPapersPerDegree);

        for (const citingPaper of citations) {
          if (allPapers.size >= maxTotalPapers) break;

          if (!allPapers.has(citingPaper.id)) {
            allPapers.set(citingPaper.id, citingPaper);
            nextDegreeQueue.push(citingPaper);
            // Store S2 ID for the new paper
            paperIdToS2Id.set(citingPaper.id, citingPaper.id.replace('s2-', ''));
          }

          // Link: citing paper -> cited paper (this paper)
          citationLinks.push({ from: citingPaper.id, to: paper.id });
        }
      }

      // Fetch references (papers this paper cites)
      if (includeReferences) {
        const references = await fetchPaperReferences(s2Id, maxPapersPerDegree);

        for (const referencedPaper of references) {
          if (allPapers.size >= maxTotalPapers) break;

          if (!allPapers.has(referencedPaper.id)) {
            allPapers.set(referencedPaper.id, referencedPaper);
            nextDegreeQueue.push(referencedPaper);
            paperIdToS2Id.set(referencedPaper.id, referencedPaper.id.replace('s2-', ''));
          }

          // Link: this paper -> referenced paper
          referenceLinks.push({ from: paper.id, to: referencedPaper.id });
        }
      }

      // Small delay to respect rate limits
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    currentDegreeQueue = nextDegreeQueue;
  }

  onProgress?.('Citation expansion complete', allPapers.size, allPapers.size);

  return {
    papers: Array.from(allPapers.values()),
    citationLinks,
    referenceLinks,
  };
}

/**
 * Build a graph from papers with citation relationships
 */
export function buildCitationGraph(
  papers: Paper[],
  citationLinks: Array<{ from: string; to: string }>,
  referenceLinks: Array<{ from: string; to: string }> = []
): GraphData {
  const nodes: GraphNode[] = papers.map(paper => ({
    id: paper.id,
    name: paper.title,
    type: 'paper' as const,
    val: Math.max(5, Math.min(20, Math.log10((paper.citations || 1) + 1) * 5)),
    data: paper,
  }));

  // Create a set of valid node IDs for filtering links
  const validNodeIds = new Set(papers.map(p => p.id));

  // Combine and dedupe links
  const linkSet = new Set<string>();
  const links: GraphLink[] = [];

  for (const link of [...citationLinks, ...referenceLinks]) {
    // Only include links where both nodes exist
    if (!validNodeIds.has(link.from) || !validNodeIds.has(link.to)) continue;

    const linkKey = `${link.from}->${link.to}`;
    if (!linkSet.has(linkKey)) {
      linkSet.add(linkKey);
      links.push({ source: link.from, target: link.to, type: 'citation' });
    }
  }

  return { nodes, links };
}

/**
 * Test citation fetching with a known paper
 */
export async function testCitationFetch(): Promise<boolean> {
  try {
    // Test with "Attention Is All You Need" paper
    const citations = await fetchPaperCitations('204e3073870fae3d05bcbc2f6a8e263d9b72e776', 2);
    return citations.length > 0;
  } catch {
    return false;
  }
}
