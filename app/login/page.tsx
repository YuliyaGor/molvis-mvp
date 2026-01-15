"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState(false);

  const handleGoogleAuth = async () => {
    setGoogleLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/`,
        },
      });

      if (error) {
        toast.error(error.message);
      }
    } catch (error: any) {
      toast.error("Помилка авторизації через Google");
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password) {
      toast.error("Заповніть всі поля");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        if (error.message.includes("Invalid login credentials")) {
          toast.error("Невірний email або пароль");
        } else if (error.message.includes("Email not confirmed")) {
          toast.error("Підтвердіть вашу пошту для входу");
        } else {
          toast.error(error.message);
        }
        return;
      }

      if (data.user) {
        toast.success("Успішний вхід!");
        router.push("/");
      }
    } catch (error: any) {
      toast.error("Помилка входу");
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password) {
      toast.error("Заповніть всі поля");
      return;
    }

    if (password.length < 6) {
      toast.error("Пароль має бути не менше 6 символів");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
        },
      });

      if (error) {
        if (error.message.includes("already registered")) {
          toast.error("Цей email вже зареєстрований");
        } else {
          toast.error(error.message);
        }
        return;
      }

      // Перевіряємо чи потрібне підтвердження email
      if (data.user && !data.session) {
        setConfirmEmail(true);
        toast.success("Перевірте вашу пошту для підтвердження!");
      } else if (data.session) {
        toast.success("Реєстрація успішна!");
        router.push("/");
      }
    } catch (error: any) {
      toast.error("Помилка реєстрації");
    } finally {
      setLoading(false);
    }
  };

  if (confirmEmail) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-8 text-center">
            <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">✉️</span>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">
              Перевірте вашу пошту
            </h2>
            <p className="text-gray-400 mb-6">
              Ми надіслали лист для підтвердження на <span className="text-white font-medium">{email}</span>
            </p>
            <p className="text-sm text-gray-500 mb-6">
              Натисніть на посилання в листі, щоб активувати ваш акаунт
            </p>
            <button
              onClick={() => {
                setConfirmEmail(false);
                setActiveTab("login");
              }}
              className="text-purple-400 hover:text-purple-300 text-sm font-medium"
            >
              ← Повернутися до входу
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo & Title */}
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold text-white mb-2">MOLVIS</h1>
          <p className="text-gray-400">Твій AI-SMM мольфар</p>
        </div>

        {/* Auth Card */}
        <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-8">
          {/* Google Button */}
          <button
            onClick={handleGoogleAuth}
            disabled={googleLoading}
            className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-100 disabled:bg-gray-200 text-gray-900 font-semibold py-3 px-4 rounded-xl transition-all disabled:cursor-not-allowed"
          >
            {googleLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
            )}
            {googleLoading ? "Завантаження..." : "Продовжити з Google"}
          </button>

          {/* Divider */}
          <div className="flex items-center gap-4 my-6">
            <div className="flex-1 h-px bg-gray-600" />
            <span className="text-gray-500 text-sm">або через пошту</span>
            <div className="flex-1 h-px bg-gray-600" />
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mb-6 bg-gray-900/50 p-1 rounded-lg">
            <button
              onClick={() => setActiveTab("login")}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
                activeTab === "login"
                  ? "bg-purple-600 text-white"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              Вхід
            </button>
            <button
              onClick={() => setActiveTab("signup")}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
                activeTab === "signup"
                  ? "bg-purple-600 text-white"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              Реєстрація
            </button>
          </div>

          {/* Form */}
          <form onSubmit={activeTab === "login" ? handleEmailLogin : handleEmailSignup}>
            <div className="space-y-4">
              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full bg-gray-900/50 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors"
                />
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Пароль
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={activeTab === "signup" ? "Мінімум 6 символів" : "••••••••"}
                  className="w-full bg-gray-900/50 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors"
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:from-gray-600 disabled:to-gray-700 text-white font-semibold py-3 px-4 rounded-xl transition-all disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    {activeTab === "login" ? "Вхід..." : "Реєстрація..."}
                  </>
                ) : (
                  <>{activeTab === "login" ? "Увійти" : "Зареєструватися"}</>
                )}
              </button>
            </div>
          </form>

          {/* Footer */}
          {activeTab === "login" && (
            <p className="text-center text-gray-500 text-sm mt-6">
              Немає акаунту?{" "}
              <button
                onClick={() => setActiveTab("signup")}
                className="text-purple-400 hover:text-purple-300 font-medium"
              >
                Зареєструватися
              </button>
            </p>
          )}

          {activeTab === "signup" && (
            <p className="text-center text-gray-500 text-sm mt-6">
              Вже маєте акаунт?{" "}
              <button
                onClick={() => setActiveTab("login")}
                className="text-purple-400 hover:text-purple-300 font-medium"
              >
                Увійти
              </button>
            </p>
          )}
        </div>

        {/* Back to Home */}
        <p className="text-center mt-6">
          <a
            href="/"
            className="text-gray-500 hover:text-gray-400 text-sm"
          >
            ← Повернутися на головну
          </a>
        </p>
      </div>
    </div>
  );
}
