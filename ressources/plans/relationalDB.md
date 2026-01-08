# Execution Plan: Relational Cloud SQL Deployment (PostgreSQL)

This plan outlines the deployment of a relational researcher-paper database on Google Cloud SQL using the PostgreSQL engine.

---

### 1. Project Initialization

```bash
# Enable the Cloud SQL Admin API
gcloud services enable sqladmin.googleapis.com

# Set your current project ID
gcloud config set project YOUR_PROJECT_ID

```

### 2. Infrastructure Provisioning

```bash
# Create a Cloud SQL PostgreSQL instance
gcloud sql instances create research-sql-instance \
    --database-version=POSTGRES_15 \
    --cpu=2 \
    --memory=7680MB \
    --region=us-central1 \
    --root-password=YOUR_STRONG_PASSWORD

# Create the specific research database
gcloud sql databases create research_db --instance=research-sql-instance

```

### 3. Schema Execution

Create a local file named `schema.sql`:

```sql
-- Table 1: Researchers
CREATE TABLE researchers (
  researcher_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  attributes JSONB -- Flexible metadata (equivalent to Spanner JSON)
);

-- Table 2: Papers
CREATE TABLE papers (
  paper_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  abstract TEXT, -- Long-form text attribute
  publish_date DATE,
  attributes JSONB
);

-- Table 3: Authorship (Join Table for Many-to-Many)
CREATE TABLE authorship (
  researcher_id UUID REFERENCES researchers(researcher_id),
  paper_id UUID REFERENCES papers(paper_id),
  role TEXT,
  PRIMARY KEY (researcher_id, paper_id)
);

```

Apply the schema (using Cloud Shell or a local `psql` client):

```bash
gcloud sql connect research-sql-instance --user=postgres --quiet < schema.sql

```

### 4. Migration Pattern (Extensibility)

To add "Hard" attributes later, use standard PostgreSQL migrations:

```bash
# Example: Adding a Department column
gcloud sql connect research-sql-instance --user=postgres --database=research_db \
    --execute="ALTER TABLE researchers ADD COLUMN department TEXT;"

```

### 5. Data Ingestion & Verification

```bash
# Insert Data
gcloud sql connect research-sql-instance --user=postgres --database=research_db <<EOF
INSERT INTO researchers (first_name, last_name) VALUES ('Marie', 'Curie');
INSERT INTO papers (title, abstract) VALUES ('Radioactive Substances', 'An inquiry into...');
INSERT INTO authorship (researcher_id, paper_id, role) 
SELECT researcher_id, paper_id, 'Lead Author' 
FROM researchers, papers WHERE last_name='Curie' AND title='Radioactive Substances';
EOF

# Verify with Join
gcloud sql connect research-sql-instance --user=postgres --database=research_db \
    --execute="SELECT p.title, r.last_name FROM papers p 
               JOIN authorship a ON p.paper_id = a.paper_id 
               JOIN researchers r ON a.researcher_id = r.researcher_id;"

```

---

[Connecting to a Cloud SQL Database with gcloud](https://www.youtube.com/watch?v=4H57rkMDqZw)
This video provides a quick tutorial on how to use the gcloud CLI to connect to your database instance, which is the primary method for executing the SQL commands in this plan.