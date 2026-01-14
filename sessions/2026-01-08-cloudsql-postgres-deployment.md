# Session: Cloud SQL PostgreSQL Deployment

**Date:** 2026-01-08

## Overview
Deployed a relational Cloud SQL PostgreSQL instance to the `waffle-mm` GCP project for the academic research database.

## GCP Resources Created

### Cloud SQL Instance
- **Name:** research-sql-instance
- **Engine:** PostgreSQL 15
- **Region:** us-central1-c
- **Tier:** db-custom-2-7680 (2 vCPUs, 7.5GB RAM)
- **Public IP:** 35.239.194.75
- **Status:** RUNNABLE

### Database
- **Name:** research_db
- **Charset:** UTF8
- **Collation:** en_US.UTF8

## Schema Applied

### Tables
1. **researchers**
   - `researcher_id` UUID - Primary Key (auto-generated)
   - `first_name` TEXT NOT NULL
   - `last_name` TEXT NOT NULL
   - `attributes` JSONB - Flexible metadata

2. **papers**
   - `paper_id` UUID - Primary Key (auto-generated)
   - `title` TEXT NOT NULL
   - `abstract` TEXT - Long-form text
   - `publish_date` DATE
   - `attributes` JSONB - Flexible metadata

3. **authorship** (Join Table)
   - `researcher_id` UUID - FK to researchers
   - `paper_id` UUID - FK to papers
   - `role` TEXT
   - Primary Key: (researcher_id, paper_id)

## Files Created
- `infrastructure/postgres_schema.sql` - PostgreSQL schema definition

## Commands Used
```bash
# Enable API
gcloud services enable sqladmin.googleapis.com

# Create instance
gcloud sql instances create research-sql-instance \
    --database-version=POSTGRES_15 \
    --cpu=2 \
    --memory=7680MB \
    --region=us-central1 \
    --root-password='ResearchDB2026'

# Create database
gcloud sql databases create research_db --instance=research-sql-instance

# Apply schema (requires psql client and IP allowlisting)
PGPASSWORD='ResearchDB2026' psql -h 35.239.194.75 -U postgres -d research_db -f infrastructure/postgres_schema.sql
```

## Connection Info
- **Host:** 35.239.194.75
- **Port:** 5432
- **User:** postgres
- **Password:** ResearchDB2026
- **Database:** research_db

**Note:** IP allowlisting required before connecting. Use `gcloud sql connect` to auto-allowlist your IP.

## Cost Estimate
~$25-30/month for this configuration

## Next Steps
- Insert sample data using the operations guide in `ressources/plans/relationalDB.md`
- Consider setting up Cloud SQL Auth proxy for secure connections
- Add indexes as query patterns emerge
