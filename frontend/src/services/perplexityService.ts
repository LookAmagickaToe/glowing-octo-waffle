/**
 * Perplexity Researcher Enrichment Service
 * Calls the perplexity-enrich Cloud Function to find researcher email and lab info
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL ||
  'https://us-central1-waffle-mm.cloudfunctions.net';

export interface PerplexityEnrichResult {
  success: boolean;
  email: string | null;
  lab: string | null;
  institution: string | null;
  found: boolean;
  error?: string;
}

/**
 * Enrich researcher using Perplexity API
 * This is the primary source for email and lab information
 */
export async function enrichResearcher(
  name: string,
  affiliation?: string
): Promise<PerplexityEnrichResult> {
  const response = await fetch(`${API_BASE}/perplexity-enrich`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name,
      affiliation: affiliation || undefined,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Perplexity enrichment failed: ${response.status} - ${error}`);
  }

  return response.json();
}
