"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";

interface Post {
  id: string;
  image_url: string;
  caption: string;
  hashtags: string[];
  created_at: string;
}

export default function DraftsPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedPosts, setExpandedPosts] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    try {
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Помилка завантаження:', error);
        toast.error(`Помилка: ${error.message}`);
      } else {
        setPosts(data || []);
      }
    } catch (error: any) {
      console.error('Помилка:', error);
      toast.error('Не вдалося завантажити чернетки');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('posts')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Помилка видалення:', error);
        toast.error(`Помилка: ${error.message}`);
      } else {
        // Миттєво прибираємо картку з екрану
        setPosts(posts.filter(post => post.id !== id));
        toast.success('🗑️ Чернетку видалено!');
      }
    } catch (error: any) {
      console.error('Помилка:', error);
      toast.error('Не вдалося видалити чернетку');
    }
  };

  const handleCopy = async (caption: string) => {
    try {
      await navigator.clipboard.writeText(caption);
      toast.success('📋 Текст скопійовано!');
    } catch (err) {
      toast.error('❌ Помилка копіювання');
    }
  };

  const toggleExpanded = (id: string) => {
    setExpandedPosts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const truncateText = (text: string, maxLength: number = 100) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-900 via-black to-gray-900">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-purple-500" />
          <p className="text-gray-400">Завантаження чернеток...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900">
      <div className="max-w-7xl mx-auto px-6 py-16">
        {/* Header */}
        <div className="mb-12">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-6"
          >
            <ArrowLeft className="w-5 h-5" />
            Назад на головну
          </Link>

          <h1 className="text-5xl font-bold text-white mb-4">
            📂 Мої чернетки
          </h1>
          <p className="text-xl text-gray-400">
            {posts.length === 0
              ? 'Немає збережених чернеток'
              : `Всього збережено: ${posts.length}`}
          </p>
        </div>

        {/* Grid */}
        {posts.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-gray-500 text-lg mb-6">
              Тут поки що порожньо. Створіть свій перший пост!
            </p>
            <Link
              href="/"
              className="inline-block bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold py-3 px-8 rounded-xl transition-all shadow-lg hover:shadow-xl"
            >
              Створити пост
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {posts.map((post) => {
              const isExpanded = expandedPosts.has(post.id);
              const displayText = isExpanded
                ? post.caption
                : truncateText(post.caption, 100);
              const needsTruncation = post.caption.length > 100;

              return (
                <div
                  key={post.id}
                  className="bg-gray-800/50 border border-gray-700 rounded-2xl overflow-hidden hover:border-purple-500/50 transition-all"
                >
                  {/* Image */}
                  <div className="relative w-full aspect-square bg-black">
                    <img
                      src={post.image_url}
                      alt="Post preview"
                      className="w-full h-full object-cover"
                    />
                  </div>

                  {/* Content */}
                  <div className="p-4">
                    {/* Caption */}
                    <div className="mb-3">
                      <p className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">
                        {displayText}
                      </p>
                      {needsTruncation && (
                        <button
                          onClick={() => toggleExpanded(post.id)}
                          className="text-xs text-purple-400 hover:text-purple-300 mt-1 font-medium"
                        >
                          {isExpanded ? 'згорнути' : 'більше...'}
                        </button>
                      )}
                    </div>

                    {/* Hashtags */}
                    {post.hashtags && post.hashtags.length > 0 && (
                      <div className="mb-4 flex flex-wrap gap-2">
                        {post.hashtags.map((tag, index) => (
                          <span
                            key={index}
                            className="text-xs text-blue-400 bg-blue-400/10 px-2 py-1 rounded"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Date */}
                    <p className="text-xs text-gray-500 mb-4">
                      {new Date(post.created_at).toLocaleDateString('uk-UA', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleCopy(post.caption)}
                        className="flex-1 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold py-2 px-4 rounded-lg transition-all"
                      >
                        📋 Копіювати
                      </button>
                      <button
                        onClick={() => handleDelete(post.id)}
                        className="flex-1 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold py-2 px-4 rounded-lg transition-all"
                      >
                        🗑️ Видалити
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
