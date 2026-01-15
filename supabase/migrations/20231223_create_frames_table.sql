-- Створення таблиці для збереження рамок
CREATE TABLE IF NOT EXISTS frames (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  storage_path TEXT NOT NULL,
  thumbnail_path TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Індекс для швидкого пошуку
CREATE INDEX IF NOT EXISTS idx_frames_created_at ON frames(created_at DESC);

-- Enable RLS
ALTER TABLE frames ENABLE ROW LEVEL SECURITY;

-- Політики доступу для таблиці frames (публічний доступ)
-- Спочатку видаляємо старі політики якщо є
DROP POLICY IF EXISTS "Anyone can read frames" ON frames;
DROP POLICY IF EXISTS "Anyone can insert frames" ON frames;
DROP POLICY IF EXISTS "Anyone can update frames" ON frames;
DROP POLICY IF EXISTS "Anyone can delete frames" ON frames;

-- Створюємо нові політики
CREATE POLICY "Anyone can read frames"
ON frames FOR SELECT
USING (true);

CREATE POLICY "Anyone can insert frames"
ON frames FOR INSERT
WITH CHECK (true);

CREATE POLICY "Anyone can update frames"
ON frames FOR UPDATE
USING (true);

CREATE POLICY "Anyone can delete frames"
ON frames FOR DELETE
USING (true);

-- ВАЖЛИВО: Storage bucket "frames" потрібно створити вручну через Dashboard!
-- 1. Перейдіть у Storage
-- 2. New Bucket -> назва "frames" -> Public bucket ✅
