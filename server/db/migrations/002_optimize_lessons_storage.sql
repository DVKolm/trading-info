-- Optimize lessons table for hybrid storage approach
-- Keep metadata in DB, store content in filesystem

-- Add new columns for optimized storage
ALTER TABLE lessons
ADD COLUMN IF NOT EXISTS content_preview TEXT, -- First 500 chars for search
ADD COLUMN IF NOT EXISTS file_size INTEGER,
ADD COLUMN IF NOT EXISTS has_images BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS has_videos BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS reading_time INTEGER, -- Estimated minutes
ADD COLUMN IF NOT EXISTS difficulty_level VARCHAR(50),
ADD COLUMN IF NOT EXISTS tags TEXT[]; -- Array of tags

-- Drop the large content columns (after migration)
-- ALTER TABLE lessons DROP COLUMN IF EXISTS content;
-- ALTER TABLE lessons DROP COLUMN IF EXISTS html_content;

-- Create better indexes
CREATE INDEX IF NOT EXISTS idx_lessons_tags ON lessons USING gin(tags);
CREATE INDEX IF NOT EXISTS idx_lessons_difficulty ON lessons(difficulty_level);

-- Create a separate table for lesson assets
CREATE TABLE IF NOT EXISTS lesson_assets (
  id BIGSERIAL PRIMARY KEY,
  lesson_id BIGINT REFERENCES lessons(id) ON DELETE CASCADE,
  asset_type VARCHAR(50), -- 'image', 'video', 'attachment'
  file_path VARCHAR(500),
  file_size INTEGER,
  mime_type VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_assets_lesson ON lesson_assets(lesson_id);
CREATE INDEX IF NOT EXISTS idx_assets_type ON lesson_assets(asset_type);

-- Create table for lesson search index (optional, for better search)
CREATE TABLE IF NOT EXISTS lesson_search_index (
  lesson_id BIGINT PRIMARY KEY REFERENCES lessons(id) ON DELETE CASCADE,
  search_vector tsvector,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_lesson_search_vector ON lesson_search_index USING gin(search_vector);