-- Створення таблиці для збереження постів
CREATE TABLE IF NOT EXISTS posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  image_url TEXT NOT NULL,
  caption TEXT NOT NULL,
  hashtags TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Вимкнення RLS для MVP (Row Level Security)
ALTER TABLE posts DISABLE ROW LEVEL SECURITY;

-- Індекс для швидкого сортування за датою
CREATE INDEX IF NOT EXISTS posts_created_at_idx ON posts(created_at DESC);

-- Перевірка таблиці
SELECT
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'posts'
ORDER BY ordinal_position;
