-- Add missing html_content column if it doesn't exist
ALTER TABLE lessons
ADD COLUMN IF NOT EXISTS html_content TEXT;

-- Add missing content column if it doesn't exist
ALTER TABLE lessons
ADD COLUMN IF NOT EXISTS content TEXT;

-- Ensure all required columns exist
ALTER TABLE lessons
ADD COLUMN IF NOT EXISTS frontmatter JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS word_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS parent_folder VARCHAR(500),
ADD COLUMN IF NOT EXISTS lesson_number INTEGER,
ADD COLUMN IF NOT EXISTS file_hash VARCHAR(64);

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_lessons_path ON lessons(path);
CREATE INDEX IF NOT EXISTS idx_lessons_folder ON lessons(parent_folder);