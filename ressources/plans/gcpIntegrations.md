# Execution Plan: GCP-Native Integrations for Multi-Tenant PostgreSQL

This plan enhances the multi-tenant PostgreSQL setup with deeper GCP service integrations for security, automation, and scalability.

---

## Overview

| Integration | Purpose |
|-------------|---------|
| Secret Manager | Secure credential storage |
| Cloud IAM | Database authentication without passwords |
| Cloud Functions | Automated tenant provisioning |
| Pub/Sub | Event-driven architecture |
| Cloud Scheduler | Automated backups |

---

## Phase 1: Secret Manager Integration

Replace hardcoded passwords with Secret Manager.

### 1. Enable Secret Manager API

```bash
gcloud services enable secretmanager.googleapis.com
```

### 2. Store Database Credentials

```bash
# Store the postgres password
echo -n "ResearchDB2026" | gcloud secrets create postgres-password --data-file=-

# Store any API keys or service credentials
echo -n "your-api-key" | gcloud secrets create api-key --data-file=-
```

### 3. Grant Access to Services

```bash
# Allow Cloud Functions to access secrets
gcloud secrets add-iam-policy-binding postgres-password \
    --member="serviceAccount:PROJECT_ID@appspot.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor"
```

### 4. Updated Connection Script

Save as `scripts/get_db_password.sh`:

```bash
#!/bin/bash
# Retrieve database password from Secret Manager

gcloud secrets versions access latest --secret=postgres-password
```

### 5. Usage in Scripts

```bash
# In create_tenant.sh, replace hardcoded password:
DB_PASS=$(gcloud secrets versions access latest --secret=postgres-password)
PGPASSWORD="$DB_PASS" psql -h "$INSTANCE_IP" -U postgres -d "$DB_NAME" ...
```

---

## Phase 2: Cloud IAM Database Authentication

Use GCP IAM identities instead of database passwords.

### 1. Enable IAM Authentication on Instance

```bash
gcloud sql instances patch research-sql-instance \
    --database-flags=cloudsql.iam_authentication=on
```

### 2. Create Service Account for Application

```bash
# Create service account
gcloud iam service-accounts create tenant-manager \
    --display-name="Tenant Manager Service"

# Get the email
SA_EMAIL="tenant-manager@PROJECT_ID.iam.gserviceaccount.com"
```

### 3. Create IAM Database User

```bash
# Create IAM user in Cloud SQL
gcloud sql users create tenant-manager@PROJECT_ID.iam \
    --instance=research-sql-instance \
    --type=CLOUD_IAM_SERVICE_ACCOUNT

# Grant Cloud SQL Client role
gcloud projects add-iam-policy-binding PROJECT_ID \
    --member="serviceAccount:$SA_EMAIL" \
    --role="roles/cloudsql.client"
```

### 4. Grant Database Permissions

```bash
# Connect as postgres and grant permissions
PGPASSWORD=$(gcloud secrets versions access latest --secret=postgres-password) \
psql -h INSTANCE_IP -U postgres -d tenant_registry <<EOF
GRANT ALL PRIVILEGES ON DATABASE tenant_registry TO "tenant-manager@PROJECT_ID.iam";
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO "tenant-manager@PROJECT_ID.iam";
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO "tenant-manager@PROJECT_ID.iam";
EOF
```

### 5. Connect Using IAM Authentication

```bash
# Generate IAM token
TOKEN=$(gcloud sql generate-login-token)

# Connect with token as password
PGPASSWORD="$TOKEN" psql -h INSTANCE_IP \
    -U "tenant-manager@PROJECT_ID.iam" \
    -d tenant_registry
```

---

## Phase 3: Cloud Functions for Tenant Provisioning

Automate tenant creation via HTTP endpoints.

### 1. Enable Cloud Functions API

```bash
gcloud services enable cloudfunctions.googleapis.com
gcloud services enable cloudbuild.googleapis.com
```

### 2. Create Function Directory

```bash
mkdir -p functions/tenant-provisioner
```

### 3. Function Code

Save as `functions/tenant-provisioner/main.py`:

```python
import functions_framework
from google.cloud import secretmanager
from google.cloud.sql.connector import Connector
import sqlalchemy
import json

PROJECT_ID = "waffle-mm"
INSTANCE_CONNECTION = "waffle-mm:us-central1:research-sql-instance"

def get_password():
    client = secretmanager.SecretManagerServiceClient()
    name = f"projects/{PROJECT_ID}/secrets/postgres-password/versions/latest"
    response = client.access_secret_version(request={"name": name})
    return response.payload.data.decode("UTF-8")

def get_connection():
    connector = Connector()
    conn = connector.connect(
        INSTANCE_CONNECTION,
        "pg8000",
        user="postgres",
        password=get_password(),
        db="tenant_registry"
    )
    return conn

@functions_framework.http
def create_tenant(request):
    """HTTP Cloud Function to create a new tenant."""
    request_json = request.get_json(silent=True)

    if not request_json or 'org_slug' not in request_json:
        return json.dumps({"error": "org_slug required"}), 400

    org_slug = request_json['org_slug']
    org_name = request_json.get('org_name', org_slug)
    db_name = f"org_{org_slug}"

    pool = sqlalchemy.create_engine(
        "postgresql+pg8000://",
        creator=get_connection
    )

    with pool.connect() as conn:
        # Check if tenant exists
        result = conn.execute(
            sqlalchemy.text("SELECT 1 FROM organizations WHERE org_slug = :slug"),
            {"slug": org_slug}
        )
        if result.fetchone():
            return json.dumps({"error": "Tenant already exists"}), 409

        # Register tenant
        conn.execute(
            sqlalchemy.text("""
                INSERT INTO organizations (org_slug, org_name)
                VALUES (:slug, :name)
            """),
            {"slug": org_slug, "name": org_name}
        )
        conn.commit()

    # Create database via gcloud (Cloud Function needs appropriate permissions)
    import subprocess
    subprocess.run([
        "gcloud", "sql", "databases", "create", db_name,
        "--instance=research-sql-instance"
    ], check=True)

    return json.dumps({
        "status": "created",
        "org_slug": org_slug,
        "database": db_name
    }), 201


@functions_framework.http
def list_tenants(request):
    """HTTP Cloud Function to list all tenants."""
    pool = sqlalchemy.create_engine(
        "postgresql+pg8000://",
        creator=get_connection
    )

    with pool.connect() as conn:
        result = conn.execute(sqlalchemy.text("""
            SELECT org_slug, org_name, status, created_at::text
            FROM organizations
            ORDER BY created_at
        """))
        tenants = [dict(row._mapping) for row in result]

    return json.dumps({"tenants": tenants}), 200
```

### 4. Requirements File

Save as `functions/tenant-provisioner/requirements.txt`:

```
functions-framework==3.*
google-cloud-secret-manager==2.*
cloud-sql-python-connector[pg8000]==1.*
sqlalchemy==2.*
pg8000==1.*
```

### 5. Deploy Functions

```bash
# Deploy create_tenant function
gcloud functions deploy create-tenant \
    --gen2 \
    --runtime=python311 \
    --region=us-central1 \
    --source=functions/tenant-provisioner \
    --entry-point=create_tenant \
    --trigger-http \
    --allow-unauthenticated

# Deploy list_tenants function
gcloud functions deploy list-tenants \
    --gen2 \
    --runtime=python311 \
    --region=us-central1 \
    --source=functions/tenant-provisioner \
    --entry-point=list_tenants \
    --trigger-http \
    --allow-unauthenticated
```

### 6. Usage

```bash
# Create a tenant
curl -X POST https://us-central1-waffle-mm.cloudfunctions.net/create-tenant \
    -H "Content-Type: application/json" \
    -d '{"org_slug": "acme", "org_name": "Acme Corporation"}'

# List tenants
curl https://us-central1-waffle-mm.cloudfunctions.net/list-tenants
```

---

## Phase 4: Pub/Sub for Event-Driven Architecture

Publish events when tenants are created/modified.

### 1. Enable Pub/Sub API

```bash
gcloud services enable pubsub.googleapis.com
```

### 2. Create Topics

```bash
# Tenant lifecycle events
gcloud pubsub topics create tenant-created
gcloud pubsub topics create tenant-deleted
gcloud pubsub topics create tenant-suspended
```

### 3. Create Subscriptions

```bash
# For downstream processing (e.g., welcome emails, audit logging)
gcloud pubsub subscriptions create tenant-created-handler \
    --topic=tenant-created \
    --push-endpoint=https://your-handler-url.com/on-tenant-created

# Or pull subscription for batch processing
gcloud pubsub subscriptions create tenant-events-archive \
    --topic=tenant-created
```

### 4. Publish Events from Functions

Add to `main.py`:

```python
from google.cloud import pubsub_v1

publisher = pubsub_v1.PublisherClient()

def publish_event(topic_name: str, data: dict):
    topic_path = publisher.topic_path(PROJECT_ID, topic_name)
    message = json.dumps(data).encode("utf-8")
    publisher.publish(topic_path, message)

# In create_tenant function, after successful creation:
publish_event("tenant-created", {
    "org_slug": org_slug,
    "org_name": org_name,
    "database": db_name,
    "timestamp": datetime.utcnow().isoformat()
})
```

---

## Phase 5: Cloud Scheduler for Automated Backups

Schedule daily backups for all tenant databases.

### 1. Enable Cloud Scheduler API

```bash
gcloud services enable cloudscheduler.googleapis.com
```

### 2. Create Backup Function

Save as `functions/tenant-provisioner/backup.py`:

```python
@functions_framework.http
def backup_all_tenants(request):
    """Backup all tenant databases to Cloud Storage."""
    import subprocess
    from datetime import datetime

    timestamp = datetime.utcnow().strftime("%Y%m%d-%H%M%S")

    pool = sqlalchemy.create_engine(
        "postgresql+pg8000://",
        creator=get_connection
    )

    with pool.connect() as conn:
        result = conn.execute(sqlalchemy.text("""
            SELECT database_name FROM tenant_databases t
            JOIN organizations o ON t.org_id = o.org_id
            WHERE o.status = 'active'
        """))
        databases = [row[0] for row in result]

    backup_results = []
    for db in databases:
        uri = f"gs://waffle-mm-backups/tenants/{db}/{timestamp}.sql"
        try:
            subprocess.run([
                "gcloud", "sql", "export", "sql",
                "research-sql-instance", uri,
                f"--database={db}"
            ], check=True)
            backup_results.append({"database": db, "uri": uri, "status": "success"})
        except Exception as e:
            backup_results.append({"database": db, "status": "failed", "error": str(e)})

    return json.dumps({"backups": backup_results}), 200
```

### 3. Create Backup Bucket

```bash
gcloud storage buckets create gs://waffle-mm-backups \
    --location=us-central1 \
    --uniform-bucket-level-access

# Grant Cloud SQL export permission
gcloud storage buckets add-iam-policy-binding gs://waffle-mm-backups \
    --member="serviceAccount:PROJECT_NUMBER@gcp-sa-cloud-sql.iam.gserviceaccount.com" \
    --role="roles/storage.objectCreator"
```

### 4. Deploy Backup Function

```bash
gcloud functions deploy backup-tenants \
    --gen2 \
    --runtime=python311 \
    --region=us-central1 \
    --source=functions/tenant-provisioner \
    --entry-point=backup_all_tenants \
    --trigger-http \
    --no-allow-unauthenticated
```

### 5. Schedule Daily Backup

```bash
gcloud scheduler jobs create http daily-tenant-backup \
    --location=us-central1 \
    --schedule="0 2 * * *" \
    --uri="https://us-central1-waffle-mm.cloudfunctions.net/backup-tenants" \
    --http-method=POST \
    --oidc-service-account-email=tenant-manager@waffle-mm.iam.gserviceaccount.com
```

---

## Summary: GCP Services Used

| Service | Purpose | Monthly Cost Estimate |
|---------|---------|----------------------|
| Cloud SQL | PostgreSQL databases | ~$25-30 |
| Secret Manager | Credential storage | ~$0.06 per secret |
| Cloud Functions | Tenant automation | Pay per invocation |
| Pub/Sub | Event messaging | ~$0.40 per million messages |
| Cloud Scheduler | Cron jobs | ~$0.10 per job/month |
| Cloud Storage | Backups | ~$0.02 per GB |

---

## Required IAM Roles

For the service account running Cloud Functions:

```bash
SA_EMAIL="tenant-manager@waffle-mm.iam.gserviceaccount.com"

gcloud projects add-iam-policy-binding waffle-mm \
    --member="serviceAccount:$SA_EMAIL" \
    --role="roles/cloudsql.client"

gcloud projects add-iam-policy-binding waffle-mm \
    --member="serviceAccount:$SA_EMAIL" \
    --role="roles/cloudsql.admin"

gcloud projects add-iam-policy-binding waffle-mm \
    --member="serviceAccount:$SA_EMAIL" \
    --role="roles/secretmanager.secretAccessor"

gcloud projects add-iam-policy-binding waffle-mm \
    --member="serviceAccount:$SA_EMAIL" \
    --role="roles/pubsub.publisher"
```
