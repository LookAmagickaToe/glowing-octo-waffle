import { Paper } from '@/types';

// Use proxy in development to avoid CORS issues
// In production, you'd need a backend proxy or serverless function
const ARXIV_API_URL = import.meta.env.DEV
  ? '/api/arxiv/query'  // Proxied through Vite dev server
  : 'https://export.arxiv.org/api/query';

const DEFAULT_MAX_RESULTS = 20;

export interface ArxivSearchOptions {
  maxResults?: number;
  start?: number;
  dateFrom?: string; // Format: YYYY-MM-DD or YYYY
  dateTo?: string;   // Format: YYYY-MM-DD or YYYY
}

/**
 * Search arXiv for papers matching the query
 */
export async function searchArxiv(
  query: string,
  options: ArxivSearchOptions = {}
): Promise<Paper[]> {
  if (!query.trim()) {
    return [];
  }

  const { maxResults = DEFAULT_MAX_RESULTS, start = 0, dateFrom, dateTo } = options;

  // Build search query - search in all fields
  let searchQuery = `all:${query}`;

  // Add date range filter if provided
  // arXiv format: submittedDate:[YYYYMMDDHHMM TO YYYYMMDDHHMM]
  if (dateFrom || dateTo) {
    const fromDate = dateFrom ? formatArxivDate(dateFrom, true) : '*';
    const toDate = dateTo ? formatArxivDate(dateTo, false) : '*';
    searchQuery += ` AND submittedDate:[${fromDate} TO ${toDate}]`;
  }

  const encodedQuery = encodeURIComponent(searchQuery);
  const url = `${ARXIV_API_URL}?search_query=${encodedQuery}&start=${start}&max_results=${maxResults}&sortBy=submittedDate&sortOrder=descending`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`arXiv API error: ${response.status} ${response.statusText}`);
    }

    const xmlText = await response.text();
    return parseArxivXml(xmlText);
  } catch (error) {
    console.error('arXiv search failed:', error);
    throw error;
  }
}

/**
 * Parse arXiv Atom XML response into Paper objects
 */
export function parseArxivXml(xmlText: string): Paper[] {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, 'text/xml');

  // Check for parse errors
  const parseError = xmlDoc.querySelector('parsererror');
  if (parseError) {
    throw new Error('Failed to parse arXiv XML response');
  }

  const entries = xmlDoc.querySelectorAll('entry');
  const papers: Paper[] = [];

  entries.forEach((entry) => {
    const paper = parseArxivEntry(entry);
    if (paper) {
      papers.push(paper);
    }
  });

  return papers;
}

/**
 * Parse a single arXiv entry into a Paper object
 */
function parseArxivEntry(entry: Element): Paper | null {
  try {
    // Extract arXiv ID from the id URL (e.g., http://arxiv.org/abs/1234.5678v1)
    const idUrl = getTextContent(entry, 'id');
    const arxivId = extractArxivId(idUrl);

    if (!arxivId) {
      return null;
    }

    // Get title (remove extra whitespace)
    const title = getTextContent(entry, 'title')?.replace(/\s+/g, ' ').trim() || 'Untitled';

    // Get abstract/summary
    const abstract = getTextContent(entry, 'summary')?.replace(/\s+/g, ' ').trim() || '';

    // Get authors
    const authorElements = entry.querySelectorAll('author name');
    const authors: string[] = [];
    authorElements.forEach((authorEl) => {
      const name = authorEl.textContent?.trim();
      if (name) {
        authors.push(name);
      }
    });

    // Get publication date and extract year
    const published = getTextContent(entry, 'published') || '';
    const year = published ? new Date(published).getFullYear() : new Date().getFullYear();

    // Get updated date
    const updated = getTextContent(entry, 'updated') || '';

    // Get PDF URL from links
    const links = entry.querySelectorAll('link');
    let pdfUrl: string | undefined;
    let url: string | undefined;

    links.forEach((link) => {
      const href = link.getAttribute('href');
      const linkTitle = link.getAttribute('title');
      const rel = link.getAttribute('rel');

      if (linkTitle === 'pdf' && href) {
        pdfUrl = href;
      } else if (rel === 'alternate' && href) {
        url = href;
      }
    });

    // Get categories
    const categoryElements = entry.querySelectorAll('category');
    const categories: string[] = [];
    categoryElements.forEach((catEl) => {
      const term = catEl.getAttribute('term');
      if (term) {
        categories.push(term);
      }
    });

    // Get DOI if available (from arxiv:doi element)
    const doi = getTextContent(entry, 'arxiv\\:doi') || getTextContent(entry, 'doi');

    return {
      id: arxivId,
      arxivId,
      title,
      authors,
      abstract,
      year,
      source: 'arXiv',
      url,
      pdfUrl,
      published,
      updated,
      categories,
      doi: doi || undefined,
    };
  } catch (error) {
    console.error('Error parsing arXiv entry:', error);
    return null;
  }
}

/**
 * Extract arXiv ID from URL
 * Example: http://arxiv.org/abs/1234.5678v1 -> 1234.5678v1
 */
function extractArxivId(idUrl: string | null): string | null {
  if (!idUrl) return null;

  // Match patterns like /abs/1234.5678 or /abs/1234.5678v1
  const match = idUrl.match(/\/abs\/(.+)$/);
  return match ? match[1] : null;
}

/**
 * Helper to get text content of first matching element
 */
function getTextContent(parent: Element, selector: string): string | null {
  const element = parent.querySelector(selector);
  return element?.textContent || null;
}

/**
 * Format date for arXiv API query
 * Input: YYYY-MM-DD or YYYY
 * Output: YYYYMMDDHHMM (arXiv format)
 */
function formatArxivDate(date: string, isStart: boolean): string {
  // If just a year, expand to full date
  if (/^\d{4}$/.test(date)) {
    return isStart ? `${date}01010000` : `${date}12312359`;
  }

  // Parse YYYY-MM-DD format
  const parts = date.split('-');
  const year = parts[0];
  const month = parts[1] || (isStart ? '01' : '12');
  const day = parts[2] || (isStart ? '01' : '31');
  const time = isStart ? '0000' : '2359';

  return `${year}${month.padStart(2, '0')}${day.padStart(2, '0')}${time}`;
}

/**
 * Test arXiv API connectivity
 */
export async function testArxivConnection(): Promise<boolean> {
  try {
    const url = `${ARXIV_API_URL}?search_query=all:test&max_results=1`;
    const response = await fetch(url);
    return response.ok;
  } catch {
    return false;
  }
}
