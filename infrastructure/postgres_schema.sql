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
