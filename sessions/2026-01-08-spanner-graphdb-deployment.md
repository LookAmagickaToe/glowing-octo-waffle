# Session: Spanner GraphDB Deployment

**Date:** 2026-01-08

## Overview
Deployed an empty Spanner GraphDB instance to the `waffle-mm` GCP project for the academic research graph.

## GCP Resources Created

### Spanner Instance
- **Name:** research-graph-instance
- **Region:** us-central1
- **Edition:** Enterprise (required for Graph capabilities)
- **Processing Units:** 100
- **Status:** READY

### Spanner Database
- **Name:** research-db
- **Dialect:** GOOGLE_STANDARD_SQL
- **Status:** READY

## Schema Applied

### Tables (Nodes)
1. **Researchers**
   - `researcher_id` STRING(36) - Primary Key
   - `first_name` STRING(MAX)
   - `last_name` STRING(MAX)
   - `university` STRING(MAX)
   - `attributes` JSON

2. **Papers**
   - `paper_id` STRING(36) - Primary Key
   - `title` STRING(MAX)
   - `abstract` STRING(MAX)
   - `publish_date` DATE
   - `attributes` JSON

### Tables (Edges)
3. **Authorship**
   - `researcher_id` STRING(36) - FK to Researchers
   - `paper_id` STRING(36) - FK to Papers
   - `contribution_role` STRING(MAX)
   - Primary Key: (researcher_id, paper_id)

### Property Graph
- **Name:** ResearchGraph
- **Node Tables:** Researchers, Papers
- **Edge Tables:** Authorship (label: WorkedOn)

## Files Created
- `infrastructure/initial_schema.sql` - Schema definition file

## Commands Used
```bash
gcloud config set project waffle-mm
gcloud services enable spanner.googleapis.com
gcloud spanner instances create research-graph-instance \
    --config=regional-us-central1 \
    --description="Academic Research Graph" \
    --edition=ENTERPRISE \
    --processing-units=100
gcloud spanner databases create research-db \
    --instance=research-graph-instance \
    --database-dialect=GOOGLE_STANDARD_SQL
gcloud spanner databases ddl update research-db \
    --instance=research-graph-instance \
    --ddl-file=infrastructure/initial_schema.sql
```

## Next Steps
- Insert data using the operations guide in `ressources/plans/graphdbSpanner.md`
- Consider adding a Search Index on the `abstract` field for text search
