/**
 * ORCID Public API Service
 * https://info.orcid.org/documentation/api-tutorials/
 *
 * The public API doesn't require authentication.
 * Rate limit: 24 requests per second, 10,000 per day
 */

const BASE_URL = 'https://pub.orcid.org/v3.0';

export interface OrcidPerson {
  name?: {
    'given-names'?: { value: string };
    'family-name'?: { value: string };
    'credit-name'?: { value: string };
  };
  biography?: {
    content: string;
  };
  emails?: {
    email: Array<{
      email: string;
      primary: boolean;
      verified: boolean;
      visibility: string;
    }>;
  };
  urls?: {
    url: Array<{
      'url-name': string;
      url: { value: string };
    }>;
  };
  'external-identifiers'?: {
    'external-identifier': Array<{
      'external-id-type': string;
      'external-id-value': string;
      'external-id-url'?: { value: string };
    }>;
  };
}

export interface OrcidEmployment {
  'employment-summary': Array<{
    'department-name'?: string;
    'role-title'?: string;
    'start-date'?: {
      year: { value: string };
      month?: { value: string };
    };
    'end-date'?: {
      year: { value: string };
      month?: { value: string };
    };
    organization: {
      name: string;
      address?: {
        city?: string;
        region?: string;
        country?: string;
      };
    };
  }>;
}

export interface OrcidWork {
  'work-summary': Array<{
    'put-code': number;
    title: {
      title: { value: string };
      subtitle?: { value: string };
    };
    'publication-date'?: {
      year: { value: string };
      month?: { value: string };
    };
    type: string;
    'external-ids'?: {
      'external-id': Array<{
        'external-id-type': string;
        'external-id-value': string;
        'external-id-url'?: { value: string };
      }>;
    };
    'journal-title'?: { value: string };
  }>;
}

export interface OrcidRecord {
  'orcid-identifier': {
    uri: string;
    path: string;
    host: string;
  };
  person?: OrcidPerson;
  'activities-summary'?: {
    employments?: {
      'affiliation-group': Array<{
        summaries: OrcidEmployment[];
      }>;
    };
    works?: {
      group: Array<OrcidWork>;
    };
  };
}

export interface OrcidSearchResult {
  'num-found': number;
  result: Array<{
    'orcid-identifier': {
      uri: string;
      path: string;
    };
  }>;
}

/**
 * Get full ORCID record
 */
export async function getRecord(orcidId: string): Promise<OrcidRecord> {
  const response = await fetch(`${BASE_URL}/${orcidId}/record`, {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`ORCID API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * Get person details (name, bio, emails, urls)
 */
export async function getPerson(orcidId: string): Promise<OrcidPerson> {
  const response = await fetch(`${BASE_URL}/${orcidId}/person`, {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`ORCID API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * Get employment history
 */
export async function getEmployments(orcidId: string): Promise<{ 'affiliation-group': Array<{ summaries: OrcidEmployment[] }> }> {
  const response = await fetch(`${BASE_URL}/${orcidId}/employments`, {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`ORCID API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * Get works/publications
 */
export async function getWorks(orcidId: string): Promise<{ group: Array<OrcidWork> }> {
  const response = await fetch(`${BASE_URL}/${orcidId}/works`, {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`ORCID API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * Search for ORCID profiles
 * Query syntax: https://info.orcid.org/documentation/api-tutorials/api-tutorial-searching-the-orcid-registry/
 * Examples:
 *   - "family-name:Einstein"
 *   - "given-names:Albert AND family-name:Einstein"
 *   - "affiliation-org-name:MIT"
 *   - "orcid:0000-0002-1825-0097"
 */
export async function search(
  query: string,
  options: { start?: number; rows?: number } = {}
): Promise<OrcidSearchResult> {
  const { start = 0, rows = 10 } = options;

  const params = new URLSearchParams({
    q: query,
    start: start.toString(),
    rows: rows.toString(),
  });

  const response = await fetch(`${BASE_URL}/search?${params}`, {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`ORCID API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * Search by name
 */
export async function searchByName(
  givenName: string,
  familyName: string,
  options?: { start?: number; rows?: number }
): Promise<OrcidSearchResult> {
  const query = `given-names:${givenName} AND family-name:${familyName}`;
  return search(query, options);
}

/**
 * Search by affiliation
 */
export async function searchByAffiliation(
  organization: string,
  options?: { start?: number; rows?: number }
): Promise<OrcidSearchResult> {
  const query = `affiliation-org-name:${organization}`;
  return search(query, options);
}

/**
 * Extract display name from ORCID person data
 */
export function getDisplayName(person: OrcidPerson): string {
  if (person.name?.['credit-name']?.value) {
    return person.name['credit-name'].value;
  }
  const givenName = person.name?.['given-names']?.value || '';
  const familyName = person.name?.['family-name']?.value || '';
  return `${givenName} ${familyName}`.trim() || 'Unknown';
}

/**
 * Extract primary email from ORCID person data (if public)
 */
export function getPrimaryEmail(person: OrcidPerson): string | null {
  const emails = person.emails?.email || [];
  const primaryEmail = emails.find(e => e.primary && e.visibility === 'PUBLIC');
  return primaryEmail?.email || emails.find(e => e.visibility === 'PUBLIC')?.email || null;
}

/**
 * Extract URLs from ORCID person data
 */
export function getUrls(person: OrcidPerson): Array<{ name: string; url: string }> {
  return (person.urls?.url || []).map(u => ({
    name: u['url-name'],
    url: u.url.value,
  }));
}

/**
 * Test API connectivity
 */
export async function testConnection(): Promise<boolean> {
  try {
    // Search for a known ORCID
    const response = await fetch(`${BASE_URL}/search?q=*:*&rows=1`, {
      headers: {
        Accept: 'application/json',
      },
    });
    return response.ok;
  } catch {
    return false;
  }
}
