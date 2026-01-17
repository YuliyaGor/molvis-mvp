"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/useAuth";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Loader2, LogOut, Instagram, Trash2, Plus, X, Check } from "lucide-react";
import { InstagramAccount } from "@/lib/types";

interface FetchedAccount {
  pageId: string;
  pageName: string;
  instagramId: string;
  username: string;
  avatarUrl: string | null;
  name: string;
}

export default function SettingsPage() {
  const { user, loading: authLoading, signOut } = useAuth();
  const [accounts, setAccounts] = useState<InstagramAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const searchParams = useSearchParams();

  // State for account selection dialog
  const [showSelectDialog, setShowSelectDialog] = useState(false);
  const [fetchedAccounts, setFetchedAccounts] = useState<FetchedAccount[]>([]);
  const [selectedAccountIds, setSelectedAccountIds] = useState<Set<string>>(new Set());
  const [savingAccounts, setSavingAccounts] = useState(false);
  const [tempAccessToken, setTempAccessToken] = useState<string | null>(null);

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

      // 1. Спочатку обмінюємо код на токен через connect endpoint
      const connectResponse = await fetch("/api/instagram/connect", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session?.access_token || ""}`,
        },
        body: JSON.stringify({ code }),
      });

      const connectData = await connectResponse.json();

      if (!connectResponse.ok) {
        toast.error(connectData.error || "Помилка підключення акаунту");
        setConnecting(false);
        return;
      }

      // Зберігаємо токен для подальшого використання
      const accessToken = connectData.accessToken;
      setTempAccessToken(accessToken);

      // 2. Отримуємо список доступних акаунтів
      const fetchResponse = await fetch("/api/instagram/fetch-accounts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session?.access_token || ""}`,
        },
        body: JSON.stringify({ accessToken }),
      });

      const fetchData = await fetchResponse.json();

      if (!fetchResponse.ok) {
        toast.error(fetchData.error || "Помилка отримання акаунтів");
        setConnecting(false);
        return;
      }

      if (fetchData.accounts.length === 0) {
        toast.error("Не знайдено Instagram Business акаунтів. Переконайтеся, що ваш Instagram є Business/Creator і пов'язаний з Facebook сторінкою.");
        setConnecting(false);
        return;
      }

      // 3. Показуємо діалог вибору акаунтів
      setFetchedAccounts(fetchData.accounts);
      setSelectedAccountIds(new Set(fetchData.accounts.map((a: FetchedAccount) => a.instagramId)));
      setShowSelectDialog(true);
      setConnecting(false);

    } catch (error) {
      console.error("Connect error:", error);
      toast.error("Помилка підключення до Instagram");
      setConnecting(false);
    }
  };

  const handleSaveSelectedAccounts = async () => {
    if (selectedAccountIds.size === 0) {
      toast.error("Виберіть хоча б один акаунт");
      return;
    }

    setSavingAccounts(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();

      const selectedAccounts = fetchedAccounts
        .filter(a => selectedAccountIds.has(a.instagramId))
        .map(a => ({ pageId: a.pageId, instagramId: a.instagramId }));

      const response = await fetch("/api/instagram/save-accounts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session?.access_token || ""}`,
        },
        body: JSON.stringify({
          accessToken: tempAccessToken,
          selectedAccounts,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(`Успішно підключено ${data.accounts.length} акаунт(ів)!`);
        setShowSelectDialog(false);
        setFetchedAccounts([]);
        setSelectedAccountIds(new Set());
        setTempAccessToken(null);
        fetchAccounts();
      } else {
        toast.error(data.error || "Помилка збереження акаунтів");
      }
    } catch (error) {
      console.error("Save error:", error);
      toast.error("Помилка збереження акаунтів");
    } finally {
      setSavingAccounts(false);
    }
  };

  const toggleAccountSelection = (instagramId: string) => {
    setSelectedAccountIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(instagramId)) {
        newSet.delete(instagramId);
      } else {
        newSet.add(instagramId);
      }
      return newSet;
    });
  };

  const closeDialog = () => {
    setShowSelectDialog(false);
    setFetchedAccounts([]);
    setSelectedAccountIds(new Set());
    setTempAccessToken(null);
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

      {/* Account Selection Dialog */}
      {showSelectDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={closeDialog}
          />

          {/* Dialog */}
          <div className="relative bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg max-h-[80vh] overflow-hidden shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-700">
              <h3 className="text-xl font-semibold text-white flex items-center gap-3">
                <Instagram className="w-6 h-6 text-pink-500" />
                Виберіть акаунти
              </h3>
              <button
                onClick={closeDialog}
                className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 max-h-[50vh] overflow-y-auto">
              <p className="text-gray-400 text-sm mb-4">
                Знайдено {fetchedAccounts.length} Instagram Business акаунт(ів).
                Виберіть ті, які хочете підключити:
              </p>

              <div className="space-y-3">
                {fetchedAccounts.map((account) => {
                  const isSelected = selectedAccountIds.has(account.instagramId);
                  return (
                    <button
                      key={account.instagramId}
                      onClick={() => toggleAccountSelection(account.instagramId)}
                      className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-all ${
                        isSelected
                          ? "bg-purple-500/20 border-purple-500"
                          : "bg-gray-800/50 border-gray-700 hover:border-gray-600"
                      }`}
                    >
                      {/* Avatar */}
                      {account.avatarUrl ? (
                        <img
                          src={account.avatarUrl}
                          alt={account.username}
                          className="w-12 h-12 rounded-full border-2 border-pink-500/50"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                          <Instagram className="w-6 h-6 text-white" />
                        </div>
                      )}

                      {/* Info */}
                      <div className="flex-1 text-left">
                        <p className="text-white font-semibold">
                          @{account.username}
                        </p>
                        <p className="text-gray-400 text-sm">
                          {account.name} • {account.pageName}
                        </p>
                      </div>

                      {/* Checkbox */}
                      <div
                        className={`w-6 h-6 rounded-md flex items-center justify-center transition-all ${
                          isSelected
                            ? "bg-purple-500"
                            : "bg-gray-700 border border-gray-600"
                        }`}
                      >
                        {isSelected && <Check className="w-4 h-4 text-white" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between gap-4 p-6 border-t border-gray-700 bg-gray-800/50">
              <p className="text-sm text-gray-400">
                Вибрано: {selectedAccountIds.size} з {fetchedAccounts.length}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={closeDialog}
                  className="px-4 py-2 text-gray-400 hover:text-white hover:bg-gray-700 border border-gray-700 rounded-xl transition-all"
                >
                  Скасувати
                </button>
                <button
                  onClick={handleSaveSelectedAccounts}
                  disabled={selectedAccountIds.size === 0 || savingAccounts}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:from-gray-600 disabled:to-gray-600 text-white font-semibold rounded-xl transition-all disabled:cursor-not-allowed"
                >
                  {savingAccounts ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Зберігаємо...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      Підключити вибрані
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
