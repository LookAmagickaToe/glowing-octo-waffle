# Execution Plan: Multi-Tenant PostgreSQL (Database-per-Tenant)

This plan outlines the implementation of a multi-tenant architecture where each organization gets its own isolated database within a shared Cloud SQL PostgreSQL instance.

---

## Architecture Overview

```
Cloud SQL Instance (research-sql-instance)
├── postgres (system database)
├── tenant_registry (management database)
├── org_acme (tenant database)
├── org_globex (tenant database)
└── org_initech (tenant database)
```

Each tenant database contains the full schema (researchers, papers, authorship).

---

## Phase 1: Create Management Database

The `tenant_registry` database tracks all tenants and their metadata.

### 1. Create the Registry Database

```bash
gcloud sql databases create tenant_registry --instance=research-sql-instance
```

### 2. Create Registry Schema

Save as `infrastructure/tenant_registry_schema.sql`:

```sql
-- Tenant Registry Schema
CREATE TABLE organizations (
  org_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_slug VARCHAR(63) NOT NULL UNIQUE,  -- Used as database name
  org_name TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  status VARCHAR(20) DEFAULT 'active',  -- active, suspended, deleted
  metadata JSONB
);

-- Track database provisioning status
CREATE TABLE tenant_databases (
  org_id UUID PRIMARY KEY REFERENCES organizations(org_id),
  database_name VARCHAR(63) NOT NULL UNIQUE,
  provisioned_at TIMESTAMP,
  schema_version INTEGER DEFAULT 1,
  last_migration_at TIMESTAMP
);

-- Audit log for tenant operations
CREATE TABLE tenant_audit_log (
  log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(org_id),
  action VARCHAR(50) NOT NULL,  -- created, suspended, deleted, migrated
  performed_at TIMESTAMP DEFAULT NOW(),
  details JSONB
);
```

### 3. Apply Registry Schema

```bash
PGPASSWORD='ResearchDB2026' psql -h <INSTANCE_IP> -U postgres -d tenant_registry \
  -f infrastructure/tenant_registry_schema.sql
```

---

## Phase 2: Tenant Database Template

Create a template for new tenant databases.

### 1. Create Base Schema File

Save as `infrastructure/tenant_schema_template.sql`:

```sql
-- Standard tenant schema (same structure for all tenants)

CREATE TABLE researchers (
  researcher_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  attributes JSONB
);

CREATE TABLE papers (
  paper_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  abstract TEXT,
  publish_date DATE,
  attributes JSONB
);

CREATE TABLE authorship (
  researcher_id UUID REFERENCES researchers(researcher_id),
  paper_id UUID REFERENCES papers(paper_id),
  role TEXT,
  PRIMARY KEY (researcher_id, paper_id)
);

-- Schema version tracking within tenant DB
CREATE TABLE _schema_info (
  version INTEGER PRIMARY KEY,
  applied_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO _schema_info (version) VALUES (1);
```

---

## Phase 3: Tenant Provisioning Scripts

### 1. Create New Tenant Script

Save as `scripts/create_tenant.sh`:

```bash
#!/bin/bash
# Usage: ./create_tenant.sh <org_slug> <org_name>

set -e

ORG_SLUG=$1
ORG_NAME=$2
INSTANCE="research-sql-instance"
DB_NAME="org_${ORG_SLUG}"
INSTANCE_IP=$(gcloud sql instances describe $INSTANCE --format='value(ipAddresses[0].ipAddress)')

if [ -z "$ORG_SLUG" ] || [ -z "$ORG_NAME" ]; then
  echo "Usage: ./create_tenant.sh <org_slug> <org_name>"
  exit 1
fi

echo "Creating tenant: $ORG_NAME ($ORG_SLUG)"

# Step 1: Create the database
echo "Creating database: $DB_NAME"
gcloud sql databases create "$DB_NAME" --instance=$INSTANCE

# Step 2: Apply tenant schema
echo "Applying schema..."
PGPASSWORD='ResearchDB2026' psql -h "$INSTANCE_IP" -U postgres -d "$DB_NAME" \
  -f infrastructure/tenant_schema_template.sql

# Step 3: Register in tenant_registry
echo "Registering tenant..."
PGPASSWORD='ResearchDB2026' psql -h "$INSTANCE_IP" -U postgres -d tenant_registry <<EOF
INSERT INTO organizations (org_slug, org_name)
VALUES ('$ORG_SLUG', '$ORG_NAME')
RETURNING org_id;

INSERT INTO tenant_databases (org_id, database_name, provisioned_at)
SELECT org_id, '$DB_NAME', NOW()
FROM organizations WHERE org_slug = '$ORG_SLUG';

INSERT INTO tenant_audit_log (org_id, action, details)
SELECT org_id, 'created', '{"database": "$DB_NAME"}'::jsonb
FROM organizations WHERE org_slug = '$ORG_SLUG';
EOF

echo "Tenant '$ORG_NAME' created successfully!"
echo "Database: $DB_NAME"
```

### 2. List Tenants Script

Save as `scripts/list_tenants.sh`:

```bash
#!/bin/bash
# List all tenants and their databases

INSTANCE="research-sql-instance"
INSTANCE_IP=$(gcloud sql instances describe $INSTANCE --format='value(ipAddresses[0].ipAddress)')

PGPASSWORD='ResearchDB2026' psql -h "$INSTANCE_IP" -U postgres -d tenant_registry <<EOF
SELECT
  o.org_name,
  o.org_slug,
  t.database_name,
  o.status,
  o.created_at::date as created
FROM organizations o
JOIN tenant_databases t ON o.org_id = t.org_id
ORDER BY o.created_at;
EOF
```

### 3. Delete Tenant Script

Save as `scripts/delete_tenant.sh`:

```bash
#!/bin/bash
# Usage: ./delete_tenant.sh <org_slug>

set -e

ORG_SLUG=$1
INSTANCE="research-sql-instance"
DB_NAME="org_${ORG_SLUG}"
INSTANCE_IP=$(gcloud sql instances describe $INSTANCE --format='value(ipAddresses[0].ipAddress)')

if [ -z "$ORG_SLUG" ]; then
  echo "Usage: ./delete_tenant.sh <org_slug>"
  exit 1
fi

read -p "Are you sure you want to delete tenant '$ORG_SLUG'? (yes/no): " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
  echo "Aborted."
  exit 0
fi

# Step 1: Mark as deleted in registry
PGPASSWORD='ResearchDB2026' psql -h "$INSTANCE_IP" -U postgres -d tenant_registry <<EOF
UPDATE organizations SET status = 'deleted' WHERE org_slug = '$ORG_SLUG';

INSERT INTO tenant_audit_log (org_id, action)
SELECT org_id, 'deleted' FROM organizations WHERE org_slug = '$ORG_SLUG';
EOF

# Step 2: Drop the database
gcloud sql databases delete "$DB_NAME" --instance=$INSTANCE --quiet

echo "Tenant '$ORG_SLUG' deleted."
```

---

## Phase 4: Schema Migrations

When you need to update the schema across all tenant databases.

### 1. Migration Script Template

Save as `scripts/run_migration.sh`:

```bash
#!/bin/bash
# Usage: ./run_migration.sh <migration_file>

set -e

MIGRATION_FILE=$1
INSTANCE="research-sql-instance"
INSTANCE_IP=$(gcloud sql instances describe $INSTANCE --format='value(ipAddresses[0].ipAddress)')

if [ -z "$MIGRATION_FILE" ]; then
  echo "Usage: ./run_migration.sh <migration_file>"
  exit 1
fi

# Get all active tenant databases
DATABASES=$(PGPASSWORD='ResearchDB2026' psql -h "$INSTANCE_IP" -U postgres -d tenant_registry -t -c \
  "SELECT database_name FROM tenant_databases t
   JOIN organizations o ON t.org_id = o.org_id
   WHERE o.status = 'active'")

for DB in $DATABASES; do
  DB=$(echo $DB | xargs)  # trim whitespace
  echo "Migrating: $DB"
  PGPASSWORD='ResearchDB2026' psql -h "$INSTANCE_IP" -U postgres -d "$DB" -f "$MIGRATION_FILE"
done

echo "Migration complete!"
```

### 2. Example Migration File

Save as `infrastructure/migrations/002_add_department.sql`:

```sql
-- Migration: Add department column to researchers
ALTER TABLE researchers ADD COLUMN IF NOT EXISTS department TEXT;

-- Update schema version
INSERT INTO _schema_info (version) VALUES (2)
ON CONFLICT (version) DO NOTHING;
```

---

## Phase 5: Application Connection Pattern

### Connection String per Tenant

```python
# Python example
def get_tenant_connection(org_slug: str):
    db_name = f"org_{org_slug}"
    return f"postgresql://postgres:ResearchDB2026@{INSTANCE_IP}:5432/{db_name}"

# Usage
conn = psycopg2.connect(get_tenant_connection("acme"))
```

### Connection Pooling Consideration

For many tenants, use PgBouncer or Cloud SQL Auth Proxy with connection pooling:

```bash
# Cloud SQL Proxy with connection limit
cloud-sql-proxy research-sql-instance --max-connections=100
```

---

## Operations Summary

| Task | Command |
|------|---------|
| Create tenant | `./scripts/create_tenant.sh acme "Acme Corp"` |
| List tenants | `./scripts/list_tenants.sh` |
| Delete tenant | `./scripts/delete_tenant.sh acme` |
| Run migration | `./scripts/run_migration.sh infrastructure/migrations/002_add_department.sql` |
| Backup tenant | `gcloud sql export sql research-sql-instance gs://bucket/org_acme.sql --database=org_acme` |

---

## Cost Considerations

- All tenant databases share the same Cloud SQL instance (~$25-30/month base)
- Storage is charged per GB across all databases
- No additional per-database cost
- Consider instance sizing based on total tenant load

---

## Limitations

- Cloud SQL has a soft limit of ~500 databases per instance
- Each database connection counts against instance connection limit
- Cross-tenant queries require connecting to each database separately
- Migrations must be run against each database individually
