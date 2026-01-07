/**
 * Unpaywall API Service
 * https://unpaywall.org/products/api
 *
 * Free and open. Requires email parameter for identification.
 * Rate limit: 100,000 requests per day
 *
 * Unpaywall helps find free/open access versions of academic papers.
 */

const BASE_URL = 'https://api.unpaywall.org/v2';

export interface UnpaywallConfig {
  email: string; // Required for API access
}

let config: UnpaywallConfig = { email: '' };

export function configureUnpaywall(newConfig: UnpaywallConfig) {
  config = newConfig;
}

// Types
export interface UnpaywallOaLocation {
  updated: string;
  url: string;
  url_for_pdf?: string;
  url_for_landing_page?: string;
  evidence: string;
  license?: string;
  version: string;
  host_type: 'publisher' | 'repository';
  is_best: boolean;
  pmh_id?: string;
  endpoint_id?: string;
  repository_institution?: string;
}

export interface UnpaywallResult {
  doi: string;
  doi_url: string;
  title?: string;
  genre?: string;
  is_paratext: boolean;
  published_date?: string;
  year?: number;
  journal_name?: string;
  journal_issns?: string;
  journal_issn_l?: string;
  journal_is_oa: boolean;
  journal_is_in_doaj: boolean;
  publisher?: string;
  is_oa: boolean;
  oa_status: 'gold' | 'hybrid' | 'bronze' | 'green' | 'closed';
  has_repository_copy: boolean;
  best_oa_location?: UnpaywallOaLocation;
  first_oa_location?: UnpaywallOaLocation;
  oa_locations: UnpaywallOaLocation[];
  oa_locations_embargoed: UnpaywallOaLocation[];
  updated: string;
  data_standard: number;
  z_authors?: Array<{
    family?: string;
    given?: string;
    ORCID?: string;
    affiliation?: Array<{ name: string }>;
  }>;
}

/**
 * Get open access information for a DOI
 */
export async function getByDoi(doi: string): Promise<UnpaywallResult> {
  if (!config.email) {
    throw new Error('Unpaywall requires an email address. Configure it in Settings.');
  }

  const params = new URLSearchParams({
    email: config.email,
  });

  const response = await fetch(`${BASE_URL}/${encodeURIComponent(doi)}?${params}`);

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`DOI not found in Unpaywall: ${doi}`);
    }
    throw new Error(`Unpaywall API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * Check if a DOI has an open access version available
 */
export async function isOpenAccess(doi: string): Promise<boolean> {
  try {
    const result = await getByDoi(doi);
    return result.is_oa;
  } catch {
    return false;
  }
}

/**
 * Get the best open access PDF URL for a DOI
 */
export async function getBestPdfUrl(doi: string): Promise<string | null> {
  try {
    const result = await getByDoi(doi);
    return result.best_oa_location?.url_for_pdf || result.best_oa_location?.url || null;
  } catch {
    return null;
  }
}

/**
 * Get all open access locations for a DOI
 */
export async function getOaLocations(doi: string): Promise<UnpaywallOaLocation[]> {
  try {
    const result = await getByDoi(doi);
    return result.oa_locations;
  } catch {
    return [];
  }
}

/**
 * Get OA status description
 */
export function getOaStatusDescription(status: UnpaywallResult['oa_status']): string {
  switch (status) {
    case 'gold':
      return 'Published in a fully open access journal';
    case 'hybrid':
      return 'Open access in a subscription journal (author paid APC)';
    case 'bronze':
      return 'Free to read on publisher site, but no clear license';
    case 'green':
      return 'Available in a repository (preprint/postprint)';
    case 'closed':
      return 'No open access version found';
    default:
      return 'Unknown status';
  }
}

/**
 * Get OA status color for UI
 */
export function getOaStatusColor(status: UnpaywallResult['oa_status']): string {
  switch (status) {
    case 'gold':
      return '#FFD700'; // Gold
    case 'hybrid':
      return '#FFA500'; // Orange
    case 'bronze':
      return '#CD7F32'; // Bronze
    case 'green':
      return '#228B22'; // Forest green
    case 'closed':
      return '#808080'; // Gray
    default:
      return '#808080';
  }
}

/**
 * Batch lookup DOIs (sequential to respect rate limits)
 */
export async function batchLookup(
  dois: string[],
  onProgress?: (completed: number, total: number) => void
): Promise<Map<string, UnpaywallResult | null>> {
  const results = new Map<string, UnpaywallResult | null>();

  for (let i = 0; i < dois.length; i++) {
    const doi = dois[i];
    try {
      const result = await getByDoi(doi);
      results.set(doi, result);
    } catch {
      results.set(doi, null);
    }

    if (onProgress) {
      onProgress(i + 1, dois.length);
    }

    // Small delay to be polite to the API
    if (i < dois.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  return results;
}

/**
 * Test API connectivity
 */
export async function testConnection(): Promise<boolean> {
  if (!config.email) {
    return false;
  }

  try {
    // Test with a known DOI
    const params = new URLSearchParams({ email: config.email });
    const response = await fetch(`${BASE_URL}/10.1038/nature12373?${params}`);
    return response.ok;
  } catch {
    return false;
  }
}
