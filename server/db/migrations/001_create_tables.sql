-- Users table
CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  telegram_id BIGINT UNIQUE NOT NULL,
  username VARCHAR(255),
  first_name VARCHAR(255),
  last_name VARCHAR(255),
  language_code VARCHAR(10),
  is_premium BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  last_active TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for users
CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id);
CREATE INDEX IF NOT EXISTS idx_users_last_active ON users(last_active);

-- Lessons table
CREATE TABLE IF NOT EXISTS lessons (
  id BIGSERIAL PRIMARY KEY,
  path VARCHAR(500) UNIQUE NOT NULL,
  title VARCHAR(500) NOT NULL,
  content TEXT NOT NULL,
  html_content TEXT NOT NULL,
  frontmatter JSONB DEFAULT '{}',
  word_count INTEGER DEFAULT 0,
  parent_folder VARCHAR(500),
  lesson_number INTEGER,
  file_hash VARCHAR(64), -- For detecting file changes
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for lessons
CREATE UNIQUE INDEX IF NOT EXISTS idx_lessons_path ON lessons(path);
CREATE INDEX IF NOT EXISTS idx_lessons_title ON lessons(title);
CREATE INDEX IF NOT EXISTS idx_lessons_folder ON lessons(parent_folder);
CREATE INDEX IF NOT EXISTS idx_lessons_number ON lessons(lesson_number);
CREATE INDEX IF NOT EXISTS idx_lessons_updated ON lessons(updated_at);

-- Full-text search index for lessons
CREATE INDEX IF NOT EXISTS idx_lessons_search ON lessons USING gin(to_tsvector('russian', title || ' ' || content));

-- User progress table
CREATE TABLE IF NOT EXISTS user_progress (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
  lesson_path VARCHAR(500) NOT NULL,
  time_spent INTEGER DEFAULT 0, -- milliseconds
  scroll_progress DECIMAL(5,2) DEFAULT 0, -- 0-100%
  reading_speed DECIMAL(8,2) DEFAULT 0, -- WPM
  completion_score DECIMAL(3,2) DEFAULT 0, -- 0-1
  visits INTEGER DEFAULT 0,
  last_visited TIMESTAMP WITH TIME ZONE,
  engagement_level VARCHAR(10) DEFAULT 'low',
  completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for user_progress
CREATE UNIQUE INDEX IF NOT EXISTS idx_progress_user_lesson ON user_progress(user_id, lesson_path);
CREATE INDEX IF NOT EXISTS idx_progress_user ON user_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_progress_lesson ON user_progress(lesson_path);
CREATE INDEX IF NOT EXISTS idx_progress_completed ON user_progress(completed);
CREATE INDEX IF NOT EXISTS idx_progress_updated ON user_progress(updated_at);

-- Analytics events table
CREATE TABLE IF NOT EXISTS analytics_events (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
  lesson_path VARCHAR(500),
  event_type VARCHAR(50) NOT NULL, -- 'open', 'scroll', 'complete', 'close'
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  data JSONB DEFAULT '{}',
  session_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for analytics_events
CREATE INDEX IF NOT EXISTS idx_events_user ON analytics_events(user_id);
CREATE INDEX IF NOT EXISTS idx_events_lesson ON analytics_events(lesson_path);
CREATE INDEX IF NOT EXISTS idx_events_type ON analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_timestamp ON analytics_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_events_session ON analytics_events(session_id);
CREATE INDEX IF NOT EXISTS idx_events_created ON analytics_events(created_at);

-- User sessions table
CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
  lesson_path VARCHAR(500),
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE,
  active_time INTEGER DEFAULT 0, -- milliseconds
  max_scroll_progress DECIMAL(5,2) DEFAULT 0,
  engagement_points INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for user_sessions
CREATE INDEX IF NOT EXISTS idx_sessions_user ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_lesson ON user_sessions(lesson_path);
CREATE INDEX IF NOT EXISTS idx_sessions_active ON user_sessions(is_active);
CREATE INDEX IF NOT EXISTS idx_sessions_start ON user_sessions(start_time);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_lessons_updated_at 
    BEFORE UPDATE ON lessons 
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_user_progress_updated_at 
    BEFORE UPDATE ON user_progress 
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_user_sessions_updated_at 
    BEFORE UPDATE ON user_sessions 
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Insert some initial data (optional)
-- You can remove this if you don't want test data
INSERT INTO users (telegram_id, username, first_name, language_code) 
VALUES (123456789, 'test_user', 'Test User', 'ru') 
ON CONFLICT (telegram_id) DO NOTHING;