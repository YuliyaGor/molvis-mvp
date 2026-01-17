"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/useAuth";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Loader2, LogOut, Instagram, Trash2, Plus } from "lucide-react";
import { InstagramAccount } from "@/lib/types";

export default function SettingsPage() {
  const { user, loading: authLoading, signOut } = useAuth();
  const [accounts, setAccounts] = useState<InstagramAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const searchParams = useSearchParams();

  // Обробка callback від Facebook OAuth
  useEffect(() => {
    const code = searchParams.get("code");
    const error = searchParams.get("error");

    if (error) {
      toast.error("Авторизацію скасовано");
      // Очищаємо URL
      window.history.replaceState({}, "", "/settings");
    } else if (code) {
      // Обробляємо код авторизації
      handleOAuthCallback(code);
    }
  }, [searchParams]);

  // Завантаження підключених акаунтів
  useEffect(() => {
    if (user) {
      fetchAccounts();
    }
  }, [user]);

  const fetchAccounts = async () => {
    try {
      const { data, error } = await supabase
        .from("instagram_accounts")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching accounts:", error);
        toast.error("Помилка завантаження акаунтів");
      } else {
        setAccounts(data || []);
      }
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleConnectInstagram = () => {
    const appId = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID;
    const redirectUri = `${window.location.origin}/settings`;
    const scope = "pages_show_list,instagram_basic,instagram_content_publish,pages_read_engagement";

    // Redirect to Facebook OAuth
    const authUrl = `https://www.facebook.com/v18.0/dialog/oauth?` +
      `client_id=${appId}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `scope=${encodeURIComponent(scope)}&` +
      `response_type=code`;

    window.location.href = authUrl;
  };

  const handleOAuthCallback = async (code: string) => {
    setConnecting(true);

    // Очищаємо URL одразу
    window.history.replaceState({}, "", "/settings");

    try {
      // Отримуємо токен сесії для авторизації API
      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch("/api/instagram/connect", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session?.access_token || ""}`,
        },
        body: JSON.stringify({ code }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(`Акаунт @${data.account.username} успішно підключено!`);
        fetchAccounts();
      } else {
        toast.error(data.error || "Помилка підключення акаунту");
      }
    } catch (error) {
      console.error("Connect error:", error);
      toast.error("Помилка підключення до Instagram");
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async (accountId: string, username: string) => {
    if (!confirm(`Ви впевнені, що хочете відключити акаунт @${username}?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from("instagram_accounts")
        .delete()
        .eq("id", accountId);

      if (error) {
        toast.error("Помилка видалення акаунту");
      } else {
        toast.success(`Акаунт @${username} відключено`);
        setAccounts(accounts.filter((a) => a.id !== accountId));
      }
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("Помилка видалення");
    }
  };

  // Показуємо завантаження
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-purple-500 mx-auto mb-4" />
          <p className="text-gray-400">Завантаження...</p>
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

      <div className="max-w-4xl mx-auto px-6 py-16">
        {/* Navigation */}
        <div className="mb-12">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-6"
          >
            <ArrowLeft className="w-5 h-5" />
            Назад на головну
          </Link>

          <h1 className="text-5xl font-bold text-white mb-4">
            Налаштування
          </h1>
          <p className="text-xl text-gray-400">
            Керуйте підключеними акаунтами та налаштуваннями
          </p>
        </div>

        {/* Підключені акаунти */}
        <div className="space-y-6">
          <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-semibold text-white flex items-center gap-3">
                <Instagram className="w-7 h-7 text-pink-500" />
                Підключені акаунти
              </h2>

              <button
                onClick={handleConnectInstagram}
                disabled={connecting}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:from-gray-600 disabled:to-gray-600 text-white font-semibold rounded-xl transition-all disabled:cursor-not-allowed"
              >
                {connecting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Підключення...
                  </>
                ) : (
                  <>
                    <Plus className="w-5 h-5" />
                    Connect Instagram (via Facebook)
                  </>
                )}
              </button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
              </div>
            ) : accounts.length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed border-gray-700 rounded-xl">
                <Instagram className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400 text-lg mb-2">
                  Немає підключених акаунтів
                </p>
                <p className="text-gray-500 text-sm">
                  Підключіть Instagram Business акаунт через Facebook для публікації постів
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {accounts.map((account) => (
                  <div
                    key={account.id}
                    className="flex items-center justify-between p-4 bg-gray-900/50 border border-gray-700 rounded-xl hover:border-gray-600 transition-all"
                  >
                    <div className="flex items-center gap-4">
                      {account.avatar_url ? (
                        <img
                          src={account.avatar_url}
                          alt={account.username}
                          className="w-12 h-12 rounded-full border-2 border-pink-500/50"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                          <Instagram className="w-6 h-6 text-white" />
                        </div>
                      )}
                      <div>
                        <p className="text-white font-semibold text-lg">
                          @{account.username}
                        </p>
                        <p className="text-gray-400 text-sm">
                          Підключено {new Date(account.created_at).toLocaleDateString("uk-UA")}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => handleDisconnect(account.id, account.username)}
                      className="flex items-center gap-2 px-3 py-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-transparent hover:border-red-500/30 rounded-lg transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                      Відключити
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Інформація про права */}
            <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
              <p className="text-blue-300 text-sm">
                <strong>Примітка:</strong> Для підключення потрібен Instagram Business або Creator акаунт,
                пов'язаний з Facebook сторінкою. Ми запитуємо права для перегляду сторінок та публікації контенту.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
