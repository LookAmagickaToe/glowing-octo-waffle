-- Migration: Add users table for OAuth user management
-- Links Firestore gmail_tokens with Cloud SQL data via shared UID

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    uid VARCHAR(64) PRIMARY KEY,                    -- UUID shared with Firestore
    email VARCHAR(255) UNIQUE NOT NULL,             -- User's email from OAuth
    name VARCHAR(255),                              -- Display name from Google profile
    picture_url TEXT,                               -- Profile picture URL
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index on email for lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Add user_uid foreign key to researchers table (if exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'researchers') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'researchers' AND column_name = 'user_uid') THEN
            ALTER TABLE researchers ADD COLUMN user_uid VARCHAR(64) REFERENCES users(uid);
            CREATE INDEX idx_researchers_user_uid ON researchers(user_uid);
        END IF;
    END IF;
END $$;

-- Add user_uid foreign key to papers table (if exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'papers') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'papers' AND column_name = 'user_uid') THEN
            ALTER TABLE papers ADD COLUMN user_uid VARCHAR(64) REFERENCES users(uid);
            CREATE INDEX idx_papers_user_uid ON papers(user_uid);
        END IF;
    END IF;
END $$;

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to auto-update updated_at
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
