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
