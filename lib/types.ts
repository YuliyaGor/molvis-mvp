// Типи для бази даних Supabase

export interface InstagramAccount {
  id: string;
  user_id: string;
  access_token: string;
  instagram_business_id: string;
  page_id: string;
  username: string;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Frame {
  id: string;
  name: string;
  storage_path: string;
  thumbnail_path: string | null;
  created_at: string;
  updated_at: string;
}

export interface Post {
  id: string;
  image_url: string;
  caption: string;
  hashtags: string[];
  created_at: string;
}

// Типи для вставки (без id та автоматичних полів)
export interface InstagramAccountInsert {
  user_id: string;
  access_token: string;
  instagram_business_id: string;
  page_id: string;
  username: string;
  avatar_url?: string | null;
}

export interface InstagramAccountUpdate {
  access_token?: string;
  username?: string;
  avatar_url?: string | null;
}

// Database schema type для Supabase
export interface Database {
  public: {
    Tables: {
      instagram_accounts: {
        Row: InstagramAccount;
        Insert: InstagramAccountInsert & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<InstagramAccountInsert> & {
          updated_at?: string;
        };
      };
      frames: {
        Row: Frame;
        Insert: Omit<Frame, 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<Frame, 'id' | 'created_at'>>;
      };
      posts: {
        Row: Post;
        Insert: Omit<Post, 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<Post, 'id' | 'created_at'>>;
      };
    };
  };
}
