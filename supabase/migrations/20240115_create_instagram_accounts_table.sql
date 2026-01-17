-- Таблиця для зберігання підключених Instagram акаунтів
CREATE TABLE IF NOT EXISTS instagram_accounts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  instagram_business_id TEXT NOT NULL,
  page_id TEXT NOT NULL,
  username TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Унікальний індекс: один Instagram акаунт на одного користувача
  UNIQUE(user_id, instagram_business_id)
);

-- Індекс для швидкого пошуку по user_id
CREATE INDEX idx_instagram_accounts_user_id ON instagram_accounts(user_id);

-- Увімкнення Row Level Security
ALTER TABLE instagram_accounts ENABLE ROW LEVEL SECURITY;

-- Політика: користувач може бачити тільки свої акаунти
CREATE POLICY "Users can view own instagram accounts"
  ON instagram_accounts
  FOR SELECT
  USING (auth.uid() = user_id);

-- Політика: користувач може додавати тільки свої акаунти
CREATE POLICY "Users can insert own instagram accounts"
  ON instagram_accounts
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Політика: користувач може оновлювати тільки свої акаунти
CREATE POLICY "Users can update own instagram accounts"
  ON instagram_accounts
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Політика: користувач може видаляти тільки свої акаунти
CREATE POLICY "Users can delete own instagram accounts"
  ON instagram_accounts
  FOR DELETE
  USING (auth.uid() = user_id);

-- Тригер для автоматичного оновлення updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_instagram_accounts_updated_at
  BEFORE UPDATE ON instagram_accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
