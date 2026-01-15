"use client";

import { useState } from "react";
import { toast } from "sonner";
import Link from "next/link";
import { ArrowLeft, Loader2, Wand2, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/useAuth";

export default function StudioPage() {
  const { user, loading: authLoading, signOut } = useAuth();
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [currentPrompt, setCurrentPrompt] = useState<string>("");
  const [translatedPrompt, setTranslatedPrompt] = useState<string>("");
  const router = useRouter();

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error("Введіть опис зображення");
      return;
    }

    setLoading(true);
    setGeneratedImage(null);
    setTranslatedPrompt("");

    try {
      const response = await fetch("/api/generate-image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt: prompt.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 403) {
          toast.error("Функція генерації поки недоступна для вашого тарифу API");
        } else if (response.status === 429) {
          toast.error("Перевищено ліміт запитів. Спробуйте через хвилину.");
        } else {
          toast.error(data.error || "Помилка генерації зображення");
        }
        return;
      }

      setGeneratedImage(data.image);
      setCurrentPrompt(prompt);
      setTranslatedPrompt(data.translatedPrompt || "");
      toast.success("🎨 Зображення згенеровано!");

    } catch (error: any) {
      console.error("Помилка:", error);
      toast.error("Не вдалося згенерувати зображення");
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePost = () => {
    if (!generatedImage) return;

    // Зберігаємо зображення в localStorage для передачі на головну сторінку
    localStorage.setItem("generated_image", generatedImage);
    localStorage.setItem("generated_prompt", currentPrompt);

    // Перенаправляємо на головну сторінку
    router.push("/?from=studio");
    toast.success("Перехід до створення посту...");
  };

  const handleSaveToGallery = async () => {
    if (!generatedImage) return;

    try {
      // Тут можна додати збереження в Supabase або локально
      // Поки що просто завантажуємо файл
      const link = document.createElement('a');
      link.href = `data:image/png;base64,${generatedImage}`;
      link.download = `molvis-${Date.now()}.png`;
      link.click();

      toast.success("💾 Зображення збережено!");
    } catch (error) {
      console.error("Помилка збереження:", error);
      toast.error("Не вдалося зберегти зображення");
    }
  };

  const examplePrompts = [
    "Кіберпанк Львів з неоновими вивісками",
    "Футуристичний Київ у стилі sci-fi",
    "VR гарнітура на фоні Карпат",
    "Український орнамент в стилі digital art",
    "Космічна станція над Дніпром",
  ];

  // Показуємо завантаження поки перевіряємо авторизацію
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
        {/* Header */}
        <div className="mb-12">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-6"
          >
            <ArrowLeft className="w-5 h-5" />
            Назад на головну
          </Link>

          <h1 className="text-5xl font-bold text-white mb-4 flex items-center gap-3">
            🎨 AI Студія
          </h1>
          <p className="text-xl text-gray-400">
            Створюйте унікальні зображення за допомогою штучного інтелекту
          </p>
        </div>

        {/* Input Section */}
        <div className="space-y-6">
          {/* Prompt Input */}
          <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-6">
            <label className="block text-sm font-medium text-gray-300 mb-3">
              Опишіть, що ви хочете створити
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Наприклад: кіберпанк Львів з неоновими вивісками, цифрове мистецтво, детально"
              className="w-full h-32 bg-gray-900/50 border border-gray-600 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors resize-none"
              disabled={loading}
            />

            {/* Translated Prompt Display */}
            {translatedPrompt && (
              <div className="mt-3 p-3 bg-gray-900/50 border border-gray-600 rounded-lg">
                <p className="text-xs text-gray-500 mb-1">Переклад AI:</p>
                <p className="text-sm text-gray-300 italic">{translatedPrompt}</p>
              </div>
            )}

            {/* Example Prompts */}
            <div className="mt-4">
              <p className="text-xs text-gray-500 mb-2">Приклади промптів:</p>
              <div className="flex flex-wrap gap-2">
                {examplePrompts.map((example, index) => (
                  <button
                    key={index}
                    onClick={() => setPrompt(example)}
                    className="text-xs bg-gray-700/50 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded-lg transition-colors"
                    disabled={loading}
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Generate Button */}
          <button
            onClick={handleGenerate}
            disabled={loading || !prompt.trim()}
            className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:from-gray-600 disabled:to-gray-700 text-white font-semibold py-4 px-6 rounded-xl transition-all shadow-lg hover:shadow-xl disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Генеруємо зображення...
              </>
            ) : (
              <>
                <Wand2 className="w-5 h-5" />
                🚀 Згенерувати
              </>
            )}
          </button>

          {/* Generated Image */}
          {generatedImage && (
            <div className="space-y-4">
              {/* Image Preview */}
              <div className="bg-gray-800/50 border border-gray-700 rounded-2xl overflow-hidden">
                <div className="p-4 border-b border-gray-700">
                  <p className="text-sm text-gray-400">
                    Промпт: <span className="text-white">{currentPrompt}</span>
                  </p>
                </div>
                <div className="relative w-full aspect-square bg-black">
                  <img
                    src={`data:image/png;base64,${generatedImage}`}
                    alt="Generated"
                    className="w-full h-full object-contain"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <button
                  onClick={handleCreatePost}
                  className="bg-purple-600/80 hover:bg-purple-500/80 border border-purple-500/50 hover:border-purple-400/50 text-white font-medium py-3 px-6 rounded-xl transition-all flex items-center justify-center gap-2"
                >
                  📝 Створити пост з цим фото
                </button>
                <button
                  onClick={handleSaveToGallery}
                  className="bg-gray-700/80 hover:bg-gray-600/80 border border-gray-600/50 hover:border-gray-500/50 text-white font-medium py-3 px-6 rounded-xl transition-all flex items-center justify-center gap-2"
                >
                  📥 Завантажити фото
                </button>
              </div>
            </div>
          )}

          {/* Info Block */}
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-blue-400 mb-2">
              💡 Поради для кращих результатів:
            </h3>
            <ul className="text-xs text-gray-400 space-y-1">
              <li>• Використовуйте конкретні деталі та стилі (наприклад: "цифрове мистецтво", "реалістично")</li>
              <li>• Описуйте освітлення, кольори та настрій</li>
              <li>• Згадуйте відомі українські локації для унікальних результатів</li>
              <li>• Експериментуйте з різними художніми стилями</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
