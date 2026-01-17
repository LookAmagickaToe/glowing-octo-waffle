# Session: Perplexity API Integration for Researcher Enrichment

**Date**: 2026-01-15
**Branch**: feat/infra-gcp

## Summary

Added Perplexity API integration as the **primary source** for fetching researcher email and lab/institution information during the enrichment process. The integration uses Perplexity's structured JSON output feature for reliable data extraction.

## Files Created

### Backend

**`/backend/functions/perplexity-enrich/main.py`**
- New Google Cloud Function that calls Perplexity API
- Uses `sonar-pro` model with structured JSON output via `response_format`
- Accepts researcher name and optional affiliation
- Returns: `{ success, email, lab, institution, found }`
- Includes CORS handling following existing patterns

**`/backend/functions/perplexity-enrich/requirements.txt`**
```
functions-framework==3.*
requests==2.*
flask==3.*
```

### Frontend

**`/frontend/src/services/perplexityService.ts`**
- New TypeScript service to call the perplexity-enrich Cloud Function
- Exports `enrichResearcher(name, affiliation?)` function
- Returns `PerplexityEnrichResult` type

## Files Modified

### Backend

**`/backend/deploy.sh`**
- Added `PERPLEXITY_ENV_VARS` for the API key
- Added deployment command for `perplexity-enrich` function
- Added function URL to output list

### Frontend

**`/frontend/src/services/researcherEnrichmentService.ts`**
- Added import for `perplexityService`
- Added `perplexity` to `EnrichmentResult.details` interface
- Modified `enrichResearcher()` to call Perplexity **first** as primary source
- Updated `findResearcherEmail()` to try Perplexity before ORCID fallback

## API Details

**Endpoint**: `POST https://us-central1-waffle-mm.cloudfunctions.net/perplexity-enrich`

**Request**:
```json
{
  "name": "Geoffrey Hinton",
  "affiliation": "University of Toronto"
}
```

**Response**:
```json
{
  "success": true,
  "email": "hinton@cs.toronto.edu",
  "lab": "Machine Learning Group",
  "institution": "University of Toronto",
  "found": true
}
```

**Perplexity API Configuration**:
- Model: `sonar-pro`
- Uses `response_format` with JSON schema for structured output
- Temperature: 0.1 (for factual responses)
- Timeout: 30 seconds

## Enrichment Flow (Updated)

```
User clicks "Enrich"
        │
        ▼
┌───────────────────────────┐
│ 1. Call Perplexity API    │ ← PRIMARY source for email/lab
│    (one call per person)  │
└───────────────────────────┘
        │
        ▼
┌───────────────────────────┐
│ 2. Call existing APIs     │
│    in parallel:           │
│    - Semantic Scholar     │
│    - OpenAlex             │
│    - ORCID                │
└───────────────────────────┘
        │
        ▼
┌───────────────────────────┐
│ 3. Merge results          │
│    (Perplexity takes      │
│     precedence for        │
│     email/institution)    │
└───────────────────────────┘
```

## Deployment

```bash
cd backend && ./deploy.sh
```

## Testing

```bash
# Test Cloud Function directly
curl -X POST https://us-central1-waffle-mm.cloudfunctions.net/perplexity-enrich \
  -H "Content-Type: application/json" \
  -d '{"name": "Geoffrey Hinton", "affiliation": "University of Toronto"}'
```

## Environment Variables

The `PERPLEXITY_API_KEY` is already in `.env` and is passed to the Cloud Function during deployment.
