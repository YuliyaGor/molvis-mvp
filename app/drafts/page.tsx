"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/useAuth";
import { toast } from "sonner";
import Link from "next/link";
import { ArrowLeft, Loader2, LogOut, Instagram, ChevronDown } from "lucide-react";
import { InstagramAccount } from "@/lib/types";

interface Post {
  id: string;
  image_url: string;
  caption: string;
  hashtags: string[];
  created_at: string;
}

export default function DraftsPage() {
  const { user, loading: authLoading, signOut } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedPosts, setExpandedPosts] = useState<Set<string>>(new Set());
  const [instagramAccounts, setInstagramAccounts] = useState<InstagramAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string>("");
  const [publishingPostId, setPublishingPostId] = useState<string | null>(null);
  const [showAccountSelector, setShowAccountSelector] = useState<string | null>(null);

  useEffect(() => {
    fetchPosts();
    fetchInstagramAccounts();
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

  const fetchInstagramAccounts = async () => {
    try {
      const { data, error } = await supabase
        .from('instagram_accounts' as any)
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching Instagram accounts:', error);
      } else {
        const accounts = (data || []) as InstagramAccount[];
        setInstagramAccounts(accounts);
        // Якщо є тільки один акаунт, вибираємо його автоматично
        if (accounts.length === 1) {
          setSelectedAccount(accounts[0].id);
        }
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const handlePublishToInstagram = async (post: Post, accountId: string) => {
    if (!accountId) {
      toast.error('Виберіть Instagram акаунт');
      return;
    }

    setPublishingPostId(post.id);
    setShowAccountSelector(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch('/api/instagram/publish', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || ''}`,
        },
        body: JSON.stringify({
          imageUrl: post.image_url,
          caption: post.caption + (post.hashtags?.length ? '\n\n' + post.hashtags.join(' ') : ''),
          accountId: accountId,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success('🎉 Пост опубліковано в Instagram!');
      } else {
        toast.error(data.error || 'Помилка публікації');
      }
    } catch (error) {
      console.error('Publish error:', error);
      toast.error('Помилка публікації в Instagram');
    } finally {
      setPublishingPostId(null);
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

  const handleDownloadImage = (imageUrl: string, postId: string) => {
    try {
      const link = document.createElement('a');
      link.href = imageUrl;
      link.download = `molvis-draft-${postId}-${Date.now()}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success('📥 Фото завантажено!');
    } catch (error) {
      console.error('Помилка завантаження:', error);
      toast.error('Не вдалося завантажити фото');
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

  if (authLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-900 via-black to-gray-900">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-purple-500" />
          <p className="text-gray-400">{authLoading ? "Перевірка авторизації..." : "Завантаження чернеток..."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900">
      {/* Header з кнопкою виходу */}
      <header className="absolute top-4 right-4 flex items-center gap-3">
        {user && (
          <>
            <span className="text-sm text-gray-400">{user.email}</span>
            <button
              onClick={signOut}
              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-400 hover:text-white bg-gray-800/50 hover:bg-gray-700/50 border border-gray-700 rounded-lg transition-all"
            >
              <LogOut className="w-4 h-4" />
              Вийти
            </button>
          </>
        )}
      </header>

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
            Мої чернетки
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
              const isPublishing = publishingPostId === post.id;
              const showSelector = showAccountSelector === post.id;

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

                    {/* Instagram Publish Button */}
                    {instagramAccounts.length > 0 && (
                      <div className="mb-3 relative">
                        {instagramAccounts.length === 1 ? (
                          <button
                            onClick={() => handlePublishToInstagram(post, instagramAccounts[0].id)}
                            disabled={isPublishing}
                            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:from-gray-600 disabled:to-gray-600 text-white text-sm font-medium py-2.5 px-4 rounded-lg transition-all"
                          >
                            {isPublishing ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Публікуємо...
                              </>
                            ) : (
                              <>
                                <Instagram className="w-4 h-4" />
                                Опублікувати в Instagram
                              </>
                            )}
                          </button>
                        ) : (
                          <>
                            <button
                              onClick={() => setShowAccountSelector(showSelector ? null : post.id)}
                              disabled={isPublishing}
                              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:from-gray-600 disabled:to-gray-600 text-white text-sm font-medium py-2.5 px-4 rounded-lg transition-all"
                            >
                              {isPublishing ? (
                                <>
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                  Публікуємо...
                                </>
                              ) : (
                                <>
                                  <Instagram className="w-4 h-4" />
                                  Опублікувати в Instagram
                                  <ChevronDown className="w-4 h-4" />
                                </>
                              )}
                            </button>

                            {/* Account selector dropdown */}
                            {showSelector && (
                              <div className="absolute top-full left-0 right-0 mt-2 bg-gray-800 border border-gray-600 rounded-lg shadow-xl z-10 overflow-hidden">
                                <p className="px-3 py-2 text-xs text-gray-400 border-b border-gray-700">
                                  Виберіть акаунт:
                                </p>
                                {instagramAccounts.map((account) => (
                                  <button
                                    key={account.id}
                                    onClick={() => handlePublishToInstagram(post, account.id)}
                                    className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-700 transition-colors text-left"
                                  >
                                    {account.avatar_url ? (
                                      <img
                                        src={account.avatar_url}
                                        alt={account.username}
                                        className="w-8 h-8 rounded-full"
                                      />
                                    ) : (
                                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                                        <Instagram className="w-4 h-4 text-white" />
                                      </div>
                                    )}
                                    <span className="text-white text-sm">@{account.username}</span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => handleDownloadImage(post.image_url, post.id)}
                        className="bg-gray-700/80 hover:bg-gray-600/80 border border-gray-600/50 hover:border-gray-500/50 text-white text-sm font-medium py-2 px-3 rounded-lg transition-all"
                        title="Завантажити фото"
                      >
                        📥
                      </button>
                      <button
                        onClick={() => handleCopy(post.caption)}
                        className="bg-gray-700/80 hover:bg-gray-600/80 border border-gray-600/50 hover:border-gray-500/50 text-white text-sm font-medium py-2 px-3 rounded-lg transition-all"
                        title="Копіювати текст"
                      >
                        📋
                      </button>
                      <button
                        onClick={() => handleDelete(post.id)}
                        className="bg-red-900/40 hover:bg-red-800/60 border border-red-800/50 hover:border-red-700/50 text-red-300 hover:text-red-200 text-sm font-medium py-2 px-3 rounded-lg transition-all"
                        title="Видалити"
                      >
                        🗑️
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
