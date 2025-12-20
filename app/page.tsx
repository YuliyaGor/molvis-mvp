"use client";

import { Upload, Loader2, Heart, MessageCircle, Send, Bookmark, MoreHorizontal } from "lucide-react";
import { useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import Link from "next/link";

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [editableText, setEditableText] = useState<string>("");
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [enhancedImage, setEnhancedImage] = useState<string | null>(null);
  const [isAutoEnhance, setIsAutoEnhance] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [isTextExpanded, setIsTextExpanded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const convertToBase64 = (file: File): Promise<{ base64: string; mimeType: string }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const dataUrl = reader.result as string;
        const [mimePart, base64String] = dataUrl.split(",");
        const mimeType = mimePart.match(/:(.*?);/)?.[1] || "image/jpeg";
        resolve({ base64: base64String, mimeType });
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const enhanceImage = (base64Image: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        // Створюємо canvas
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          reject(new Error('Не вдалося створити canvas context'));
          return;
        }

        // Малюємо оригінальне зображення
        ctx.drawImage(img, 0, 0);

        // Отримуємо дані пікселів
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        // Параметри покращення
        const brightness = 1.10; // +10%
        const contrast = 1.10;   // +10%
        const saturation = 1.15; // +15%

        // Обробляємо кожен піксель
        for (let i = 0; i < data.length; i += 4) {
          let r = data[i];
          let g = data[i + 1];
          let b = data[i + 2];

          // Яскравість
          r *= brightness;
          g *= brightness;
          b *= brightness;

          // Контраст
          r = ((r / 255 - 0.5) * contrast + 0.5) * 255;
          g = ((g / 255 - 0.5) * contrast + 0.5) * 255;
          b = ((b / 255 - 0.5) * contrast + 0.5) * 255;

          // Насиченість (конвертуємо в HSL і назад)
          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          const l = (max + min) / 2;

          if (max !== min) {
            const d = max - min;
            const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            const newS = Math.min(s * saturation, 1);

            const factor = newS / s;
            r = l + (r - l) * factor;
            g = l + (g - l) * factor;
            b = l + (b - l) * factor;
          }

          // Обмежуємо значення 0-255
          data[i] = Math.min(255, Math.max(0, r));
          data[i + 1] = Math.min(255, Math.max(0, g));
          data[i + 2] = Math.min(255, Math.max(0, b));
        }

        // Застосовуємо змінені дані
        ctx.putImageData(imageData, 0, 0);

        // Конвертуємо в base64
        const enhancedBase64 = canvas.toDataURL('image/jpeg', 0.95).split(',')[1];
        resolve(enhancedBase64);
      };

      img.onerror = () => reject(new Error('Помилка завантаження зображення'));
      img.src = `data:image/jpeg;base64,${base64Image}`;
    });
  };

  const formatInstagramPost = (text: string): string => {
    // Видаляємо ** для markdown форматування
    let formatted = text.replace(/\*\*/g, '');

    // Видаляємо весь текст до слова "Ось" якщо воно є (це зазвичай аналіз AI)
    const osIndex = formatted.toLowerCase().indexOf('ось');
    if (osIndex > 0 && osIndex < formatted.length / 2) {
      // Якщо "Ось" в першій половині тексту - беремо все після нього
      formatted = formatted.substring(osIndex);
    }

    // Видаляємо всі службові фрази
    formatted = formatted.replace(/^.*?(Чудово!|Аналізуємо зображення|як SMM-експерт|я бачу|проаналізував).*?\n/gi, '');
    formatted = formatted.replace(/Ось мій варіант посту для Instagram:/gi, '');
    formatted = formatted.replace(/Ось варіант посту:/gi, '');
    formatted = formatted.replace(/Ось пост:/gi, '');
    formatted = formatted.replace(/Ось:/gi, '');
    formatted = formatted.replace(/Варіант посту:/gi, '');
    formatted = formatted.replace(/Пост для Instagram:/gi, '');
    formatted = formatted.replace(/---+/g, '');

    // Розділяємо на рядки
    const lines = formatted.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);

    // Видаляємо нумеровані списки та аналітику
    const cleanedLines = lines.filter(line => {
      const lower = line.toLowerCase();
      const trimmed = line.trim();

      // Видаляємо нумеровані пункти (1., 2., 3. тощо)
      if (/^\d+\./.test(trimmed)) return false;

      // Видаляємо ТІЛЬКИ аналітичні фрази з двокрапкою
      if (lower.includes('головні елементи:') ||
          lower.includes('емоції:') ||
          lower.includes('дія:') ||
          lower.includes('кольори:') ||
          lower.includes('настрій:') ||
          lower.includes('цільова аудиторія:') ||
          lower.includes('повідомлення:') ||
          lower.includes('бренд:') ||
          lower.includes('елементи:')) {
        return false;
      }

      // Видаляємо загальні службові фрази (без двокрапки)
      if (lower.includes('чудово!') ||
          lower.includes('аналізуємо') ||
          lower.includes('як smm-експерт') ||
          lower.includes('я бачу тут') ||
          lower.includes('ідеальний матеріал для')) {
        return false;
      }

      return true;
    });

    // Знаходимо заголовок (перший непорожній рядок)
    const title = cleanedLines[0] || '';

    // Знаходимо хештеги
    const hashtagLines = cleanedLines.filter(line => line.trim().startsWith('#'));
    const hashtags = hashtagLines.map(line =>
      line.trim().split(/\s+/).filter(word => word.startsWith('#')).join(' ')
    ).join(' ');

    // Текст - це все між заголовком і хештегами
    const bodyLines = cleanedLines.filter(line => {
      return line !== title &&
             !line.startsWith('#') &&
             line.length > 0;
    });
    const body = bodyLines.join('\n');

    // Форматуємо у Instagram стилі
    return `${title}\n\n${body}\n\n${hashtags}`.trim();
  };

  const handleFileSelect = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Будь ласка, оберіть файл зображення");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    setEnhancedImage(null);
    setOriginalImage(null);

    try {
      const { base64, mimeType } = await convertToBase64(file);

      // Зберігаємо оригінал
      setOriginalImage(base64);

      // Покращуємо зображення якщо Auto-Enhance увімкнено
      let imageToAnalyze = base64;
      if (isAutoEnhance) {
        try {
          imageToAnalyze = await enhanceImage(base64);
          setEnhancedImage(imageToAnalyze);
        } catch (enhanceError) {
          console.error('Помилка покращення зображення:', enhanceError);
          // Якщо покращення не вдалося, використовуємо оригінал
          imageToAnalyze = base64;
          setEnhancedImage(base64);
        }
      } else {
        setEnhancedImage(base64);
      }

      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ image: imageToAnalyze, mimeType }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Помилка при обробці зображення");
      }

      const data = await response.json();
      setResult(data.result);
      // Форматуємо текст для Instagram: розділяємо на заголовок, текст і хештеги
      const formattedText = formatInstagramPost(data.result);
      setEditableText(formattedText);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Щось пішло не так");
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(editableText);
      setSavedMessage("✅ Текст скопійовано!");
      setTimeout(() => setSavedMessage(null), 3000);
    } catch (err) {
      setSavedMessage("❌ Помилка копіювання");
      setTimeout(() => setSavedMessage(null), 3000);
    }
  };

  const handleSaveDraft = async () => {
    if (!enhancedImage || !editableText) {
      toast.error("Немає даних для збереження");
      return;
    }

    try {
      // Витягуємо хештеги з тексту
      const hashtagMatches = editableText.match(/#[\wа-яА-ЯіїєґІЇЄҐ]+/g) || [];

      // Зберігаємо в Supabase
      const { data, error } = await supabase
        .from('posts')
        .insert([
          {
            image_url: `data:image/jpeg;base64,${enhancedImage}`,
            caption: editableText,
            hashtags: hashtagMatches
          }
        ])
        .select();

      if (error) {
        console.error('Помилка збереження:', error);
        toast.error(`Помилка: ${error.message}`);
      } else {
        toast.success('💾 Чернетку збережено в базу!');
        console.log('Збережено:', data);
      }
    } catch (error: any) {
      console.error('Помилка:', error);
      toast.error('Не вдалося зберегти чернетку');
    }
  };

  const handleToggleEnhance = async () => {
    if (!originalImage) return;

    const newEnhanceState = !isAutoEnhance;
    setIsAutoEnhance(newEnhanceState);

    try {
      if (newEnhanceState) {
        // Увімкнули - покращуємо
        const enhanced = await enhanceImage(originalImage);
        setEnhancedImage(enhanced);
        setSavedMessage("✨ Auto-Enhance увімкнено!");
      } else {
        // Вимкнули - показуємо оригінал
        setEnhancedImage(originalImage);
        setSavedMessage("📷 Показано оригінал");
      }
      setTimeout(() => setSavedMessage(null), 2000);
    } catch (error) {
      console.error('Помилка перемикання:', error);
      setEnhancedImage(originalImage);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-900 via-black to-gray-900">
      <main className="flex w-full max-w-4xl flex-col items-center justify-center px-6 py-16">
        <div className="mb-12 text-center">
          <h1 className="mb-4 text-6xl font-bold tracking-tight text-white sm:text-7xl">
            MOLVIS
          </h1>
          <p className="text-xl text-gray-400 sm:text-2xl">
            Твій AI-SMM мольфар
          </p>
          <div className="mt-6">
            <Link
              href="/drafts"
              className="inline-flex items-center gap-2 bg-gray-800/50 hover:bg-gray-700/50 border border-gray-700 hover:border-purple-500/50 text-gray-300 hover:text-white font-semibold py-3 px-6 rounded-xl transition-all"
            >
              📂 Мої чернетки
            </Link>
          </div>
        </div>

        <div className="w-full max-w-2xl space-y-6">
          <div
            onClick={handleClick}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            className="group relative cursor-pointer rounded-2xl border-2 border-dashed border-gray-700 bg-gradient-to-br from-gray-800/50 to-gray-900/50 p-16 transition-all hover:border-gray-600 hover:from-gray-800/70 hover:to-gray-900/70"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
            <div className="flex flex-col items-center justify-center gap-6">
              {loading ? (
                <>
                  <div className="rounded-full bg-gradient-to-br from-purple-600 to-blue-600 p-6">
                    <Loader2 className="h-12 w-12 animate-spin text-white" />
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-semibold text-white">
                      Мольфар чаклує...
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="rounded-full bg-gradient-to-br from-purple-600 to-blue-600 p-6">
                    <Upload className="h-12 w-12 text-white" />
                  </div>
                  <div className="text-center">
                    <p className="mb-2 text-lg font-semibold text-white">
                      Перетягніть фото сюди
                    </p>
                    <p className="text-sm text-gray-400">
                      або натисніть для вибору файлу
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>

          {error && (
            <div className="rounded-2xl border border-red-500/50 bg-red-900/20 p-6">
              <p className="text-center text-red-400">{error}</p>
            </div>
          )}

          {result && enhancedImage && (
            <div className="w-full max-w-md mx-auto space-y-4">
              {/* Auto-Enhance Toggle */}
              {originalImage && (
                <div className="flex items-center justify-between bg-gray-800/50 border border-gray-700 rounded-xl p-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-300">✨ Auto-Enhance</span>
                    <span className="text-xs text-gray-500">
                      {isAutoEnhance ? 'Увімкнено' : 'Вимкнено'}
                    </span>
                  </div>
                  <button
                    onClick={handleToggleEnhance}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      isAutoEnhance ? 'bg-purple-600' : 'bg-gray-600'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        isAutoEnhance ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              )}

              {/* Instagram Mockup - Phone Container */}
              <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
                {/* Instagram Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
                  <div className="flex items-center gap-3">
                    {/* Avatar */}
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                      <span className="text-white text-sm font-bold">M</span>
                    </div>
                    {/* Profile Name */}
                    <span className="font-semibold text-sm text-gray-900">molvis_vr</span>
                  </div>
                  <MoreHorizontal className="w-5 h-5 text-gray-900" />
                </div>

                {/* Photo */}
                <div className="relative w-full aspect-square bg-black">
                  <img
                    src={`data:image/jpeg;base64,${enhancedImage}`}
                    alt="Instagram post"
                    className="w-full h-full object-cover"
                  />
                </div>

                {/* Action Icons */}
                <div className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-4">
                    <Heart className="w-6 h-6 text-gray-900 cursor-pointer hover:text-red-500 transition-colors" />
                    <MessageCircle className="w-6 h-6 text-gray-900 cursor-pointer hover:text-gray-600 transition-colors" />
                    <Send className="w-6 h-6 text-gray-900 cursor-pointer hover:text-gray-600 transition-colors" />
                  </div>
                  <Bookmark className="w-6 h-6 text-gray-900 cursor-pointer hover:text-gray-600 transition-colors" />
                </div>

                {/* Caption with Editable Text - Instagram Style */}
                <div className="px-4 pb-4">
                  <div className="flex gap-2">
                    <span className="font-semibold text-sm text-gray-900 self-start">molvis_vr</span>
                    <div className="flex-1">
                      <textarea
                        value={editableText}
                        onChange={(e) => setEditableText(e.target.value)}
                        className={`w-full text-sm text-gray-900 bg-transparent border-none outline-none resize-none leading-relaxed whitespace-pre-wrap ${
                          isTextExpanded ? 'min-h-[200px]' : 'max-h-[60px] overflow-hidden'
                        }`}
                        placeholder="Напишіть опис..."
                        style={{
                          lineHeight: '1.4',
                        }}
                      />
                      <button
                        onClick={() => setIsTextExpanded(!isTextExpanded)}
                        className="text-xs text-gray-500 hover:text-gray-700 mt-1 font-medium"
                      >
                        {isTextExpanded ? 'згорнути' : 'більше...'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={handleCopyText}
                  className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold py-3 px-6 rounded-xl transition-all shadow-lg hover:shadow-xl"
                >
                  📋 Скопіювати текст
                </button>
                <button
                  onClick={handleSaveDraft}
                  className="flex-1 bg-gradient-to-r from-gray-700 to-gray-800 hover:from-gray-800 hover:to-gray-900 text-white font-semibold py-3 px-6 rounded-xl transition-all shadow-lg hover:shadow-xl"
                >
                  💾 Зберегти чернетку
                </button>
              </div>

              {/* Success/Error Message */}
              {savedMessage && (
                <div className="bg-green-500/20 border border-green-500/50 rounded-xl p-4 text-center">
                  <p className="text-green-400 font-medium">{savedMessage}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
