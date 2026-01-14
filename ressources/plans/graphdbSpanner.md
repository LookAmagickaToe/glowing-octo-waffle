To ensure your database handles academic abstracts effectively, we will update the schema to include a `STRING(MAX)` field for the text. In Spanner, `STRING(MAX)` is ideal for long-form text like abstracts (up to 2.6GB), as it is stored efficiently and can be indexed for full-text search if needed later.

Here is your updated, comprehensive instruction manual.

---

# Instruction Manual: Spanner Graph DB for Research

**Topic:** Researcher-Paper Academic Graph

**Version:** 1.1 (Includes Abstracts & Extensibility)

## Phase 1: Infrastructure Setup

### 1. Enable Spanner API

```bash
gcloud services enable spanner.googleapis.com

```

### 2. Create the Spanner Instance

We use the **Enterprise** edition to unlock Graph capabilities.

```bash
gcloud spanner instances create research-graph-instance \
    --config=regional-us-central1 \
    --description="Academic Research Graph" \
    --edition=ENTERPRISE \
    --processing-units=100

```

### 3. Create the Database

```bash
gcloud spanner databases create research-db \
    --instance=research-graph-instance \
    --database-dialect=GOOGLE_STANDARD_SQL

```

---

## Phase 2: The Extensible Schema (Initial)

We will use a "Hybrid Schema" approach:

1. **Strict Columns:** For structured data (Names, Dates, Abstracts).
2. **Flexible JSON:** An `attributes` column for metadata that changes per-record (e.g., funding sources, keywords).

### 1. Define the Schema (`initial_schema.sql`)

Save this file locally. It defines the tables and the graph "view."

```sql
-- Node Table: Researchers
CREATE TABLE Researchers (
  researcher_id STRING(36) NOT NULL,
  first_name STRING(MAX),
  last_name STRING(MAX),
  university STRING(MAX),
  attributes JSON, -- Metadata like 'h_index' or 'office_location'
) PRIMARY KEY (researcher_id);

-- Node Table: Papers
CREATE TABLE Papers (
  paper_id STRING(36) NOT NULL,
  title STRING(MAX),
  abstract STRING(MAX), -- Added for long-form text
  publish_date DATE,
  attributes JSON, -- Metadata like 'journal_name' or 'impact_factor'
) PRIMARY KEY (paper_id);

-- Edge Table: Authorship (Connects Researchers to Papers)
CREATE TABLE Authorship (
  researcher_id STRING(36) NOT NULL,
  paper_id STRING(36) NOT NULL,
  contribution_role STRING(MAX), -- e.g., 'Primary', 'Co-author'
  CONSTRAINT fk_researcher FOREIGN KEY (researcher_id) REFERENCES Researchers (researcher_id),
  CONSTRAINT fk_paper FOREIGN KEY (paper_id) REFERENCES Papers (paper_id)
) PRIMARY KEY (researcher_id, paper_id);

-- Define the Graph
CREATE PROPERTY GRAPH ResearchGraph
  NODE TABLES (
    Researchers,
    Papers
  )
  EDGE TABLES (
    Authorship
    SOURCE KEY (researcher_id) REFERENCES Researchers (researcher_id)
    DESTINATION KEY (paper_id) REFERENCES Papers (paper_id)
    LABEL WorkedOn
  );

```

### 2. Apply the Schema

```bash
gcloud spanner databases ddl update research-db \
    --instance=research-graph-instance \
    --ddl-file=initial_schema.sql

```

---

## Phase 3: Extending the Schema (Migrations)

Spanner allows online schema changes. If you need to add a "Hard" attribute (a column you want to index or sort by), follow this migration pattern.

### Example: Adding a "Department" column

**1. Create `migration_v2.sql`:**

```sql
-- Step A: Alter the base table
ALTER TABLE Researchers ADD COLUMN department STRING(MAX);

-- Step B: Re-sync the Graph Definition
-- This 'refreshes' the graph to recognize the new column
CREATE OR REPLACE PROPERTY GRAPH ResearchGraph
  NODE TABLES (
    Researchers,
    Papers
  )
  EDGE TABLES (
    Authorship
    SOURCE KEY (researcher_id) REFERENCES Researchers (researcher_id)
    DESTINATION KEY (paper_id) REFERENCES Papers (paper_id)
    LABEL WorkedOn
  );

```

**2. Run the migration:**

```bash
gcloud spanner databases ddl update research-db \
    --instance=research-graph-instance \
    --ddl-file=migration_v2.sql

```

---

## Phase 4: Operations

### Inserting a Paper with an Abstract

```bash
gcloud spanner databases execute-sql research-db \
    --instance=research-graph-instance \
    --sql="INSERT INTO Papers (paper_id, title, abstract, publish_date) 
           VALUES ('p101', 'Quantum Gravity', 'A study on spacetime...', '2026-01-08')"

```

### Querying the Graph (GQL)

To find the names of all researchers who worked on a paper containing "Quantum" in the title:

```bash
gcloud spanner databases execute-sql research-db \
    --instance=research-graph-instance \
    --sql="GRAPH ResearchGraph 
           MATCH (r:Researchers)-[:WorkedOn]->(p:Papers) 
           WHERE p.title LIKE '%Quantum%'
           RETURN r.first_name, r.last_name, p.title"

```

---

## Best Practices for Researchers/Papers

* **Search:** For the `abstract` field, consider adding a **Search Index** in Spanner if you plan to do keyword-based discovery (e.g., finding papers about "AI" within the abstract).
* **IDs:** Use UUIDs (strings) for `researcher_id` and `paper_id` to prevent hotspotting during high-volume ingestion.
* **JSON usage:** Only use the `attributes` JSON column for data that is **not** part of a `WHERE` clause frequently, as standard columns are more performant for filtering.

**Would you like me to show you how to add a Search Index to the 'abstract' field so you can perform fuzzy text searches?**
