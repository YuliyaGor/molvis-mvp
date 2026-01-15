"use client";

import { Upload, Loader2, Heart, MessageCircle, Send, Bookmark, MoreHorizontal, LogOut } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/useAuth";
import { toast } from "sonner";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

export default function Home() {
  const { user, loading: authLoading, signOut } = useAuth();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [editableText, setEditableText] = useState<string>("");
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [enhancedImage, setEnhancedImage] = useState<string | null>(null);
  const [isAutoEnhance, setIsAutoEnhance] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [isTextExpanded, setIsTextExpanded] = useState(false);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [brandFrame, setBrandFrame] = useState<string | null>(null);
  const [overlayText, setOverlayText] = useState("");
  const [fontSize, setFontSize] = useState(48);
  const [textColor, setTextColor] = useState("#ffffff");
  const [textPositionX, setTextPositionX] = useState(50); // Відсоток (0-100)
  const [textPositionY, setTextPositionY] = useState(50); // Відсоток (0-100)
  const [textGlow, setTextGlow] = useState(true); // Свічення тексту
  const [frameScale, setFrameScale] = useState(100); // Відсоток (50-150)
  const [framePositionX, setFramePositionX] = useState(50); // Відсоток (0-100)
  const [framePositionY, setFramePositionY] = useState(50); // Відсоток (0-100)
  const [frameFlipH, setFrameFlipH] = useState(false); // Віддзеркалення по горизонталі
  const [frameFlipV, setFrameFlipV] = useState(false); // Віддзеркалення по вертикалі
  const [editedImage, setEditedImage] = useState<string | null>(null);
  const [savedFrames, setSavedFrames] = useState<any[]>([]);
  const [loadingFrames, setLoadingFrames] = useState(false);
  const [showFrameLibrary, setShowFrameLibrary] = useState(false);
  const [frameName, setFrameName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const frameInputRef = useRef<HTMLInputElement>(null);
  const saveFrameInputRef = useRef<HTMLInputElement>(null);
  const searchParams = useSearchParams();

  // Перевірка чи є згенероване зображення з AI Студії
  useEffect(() => {
    const fromStudio = searchParams.get('from');
    if (fromStudio === 'studio') {
      const generatedImage = localStorage.getItem('generated_image');
      const generatedPrompt = localStorage.getItem('generated_prompt');

      if (generatedImage) {
        // Автоматично обробляємо згенероване зображення
        processGeneratedImage(generatedImage, generatedPrompt || '');

        // Очищаємо localStorage
        localStorage.removeItem('generated_image');
        localStorage.removeItem('generated_prompt');
      }
    }
  }, [searchParams]);

  // Завантаження збережених рамок
  useEffect(() => {
    if (isEditorOpen) {
      fetchSavedFrames();
    }
  }, [isEditorOpen]);

  const fetchSavedFrames = async () => {
    setLoadingFrames(true);
    try {
      const response = await fetch('/api/frames');
      const data = await response.json();

      if (response.ok) {
        setSavedFrames(data.frames || []);
      } else {
        console.error('Error fetching frames:', data.error);
      }
    } catch (error) {
      console.error('Error fetching frames:', error);
    } finally {
      setLoadingFrames(false);
    }
  };

  const handleSaveCurrentFrame = async () => {
    if (!brandFrame || !frameName.trim()) {
      toast.error('Додайте назву рамки');
      return;
    }

    try {
      // Конвертуємо base64 в File
      const response = await fetch(`data:image/png;base64,${brandFrame}`);
      const blob = await response.blob();
      const file = new File([blob], `${frameName}.png`, { type: 'image/png' });

      const formData = new FormData();
      formData.append('file', file);
      formData.append('name', frameName);

      const uploadResponse = await fetch('/api/frames', {
        method: 'POST',
        body: formData,
      });

      const data = await uploadResponse.json();

      if (uploadResponse.ok) {
        toast.success('Рамку збережено!');
        setFrameName('');
        fetchSavedFrames();
        setShowFrameLibrary(false);
      } else {
        toast.error(data.error || 'Помилка збереження рамки');
      }
    } catch (error) {
      console.error('Error saving frame:', error);
      toast.error('Не вдалося зберегти рамку');
    }
  };

  const handleSelectFrame = async (frame: any) => {
    try {
      // Завантажуємо зображення рамки
      const response = await fetch(frame.thumbnail_path);
      const blob = await response.blob();
      const reader = new FileReader();

      reader.onloadend = () => {
        const base64 = (reader.result as string).split(',')[1];
        setBrandFrame(base64);
        toast.success(`Рамку "${frame.name}" застосовано!`);
      };

      reader.readAsDataURL(blob);
    } catch (error) {
      console.error('Error loading frame:', error);
      toast.error('Не вдалося завантажити рамку');
    }
  };

  const handleDeleteFrame = async (frameId: string, frameName: string) => {
    if (!confirm(`Видалити рамку "${frameName}"?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/frames?id=${frameId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast.success('Рамку видалено!');
        fetchSavedFrames();
      } else {
        const data = await response.json();
        toast.error(data.error || 'Помилка видалення рамки');
      }
    } catch (error) {
      console.error('Error deleting frame:', error);
      toast.error('Не вдалося видалити рамку');
    }
  };

  const processGeneratedImage = async (imageBase64: string, prompt: string) => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      // Зберігаємо згенероване зображення
      setOriginalImage(imageBase64);
      setEnhancedImage(imageBase64);

      // Відправляємо на аналіз до Gemini
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          image: imageBase64,
          mimeType: "image/png",
          context: `Це зображення було згенеровано AI за промптом: "${prompt}"`
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Помилка при обробці зображення");
      }

      const data = await response.json();
      setResult(data.result);
      const formattedText = formatInstagramPost(data.result);
      setEditableText(formattedText);

      toast.success("✨ Пост створено з вашого AI зображення!");
    } catch (err) {
      console.error('Помилка обробки згенерованого фото:', err);
      const errorMessage = err instanceof Error ? err.message : "Помилка обробки";
      setError(errorMessage);
      toast.error("Не вдалося створити пост");
    } finally {
      setLoading(false);
    }
  };

  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        const img = new Image();

        img.onload = () => {
          // Створюємо canvas
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');

          if (!ctx) {
            reject(new Error('Не вдалося створити canvas context'));
            return;
          }

          console.log('📐 Оригінальне зображення:', img.width, 'x', img.height);

          // Цільовий розмір - квадрат 1080x1080 для Instagram
          const TARGET_SIZE = 1080;

          // Встановлюємо розмір canvas на квадрат
          canvas.width = TARGET_SIZE;
          canvas.height = TARGET_SIZE;

          // Визначаємо, як обрізати зображення до центрального квадрату
          let sourceX = 0;
          let sourceY = 0;
          let sourceSize = 0;

          if (img.width > img.height) {
            // Горизонтальне фото - беремо центральний квадрат по висоті
            sourceSize = img.height;
            sourceX = (img.width - img.height) / 2;
            sourceY = 0;
            console.log('📸 Горизонтальне фото: беремо центральний квадрат', sourceSize, 'x', sourceSize);
          } else if (img.height > img.width) {
            // Вертикальне фото - беремо центральний квадрат по ширині
            sourceSize = img.width;
            sourceX = 0;
            sourceY = (img.height - img.width) / 2;
            console.log('📸 Вертикальне фото: беремо центральний квадрат', sourceSize, 'x', sourceSize);
          } else {
            // Вже квадратне
            sourceSize = img.width;
            sourceX = 0;
            sourceY = 0;
            console.log('📸 Квадратне фото:', sourceSize, 'x', sourceSize);
          }

          // Малюємо обрізане зображення на canvas
          // drawImage(img, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight)
          ctx.drawImage(
            img,
            sourceX, sourceY, sourceSize, sourceSize,  // Вихідна область (центральний квадрат)
            0, 0, TARGET_SIZE, TARGET_SIZE              // Цільова область (весь canvas)
          );

          console.log('✅ Зображення обрізано та масштабовано до', TARGET_SIZE, 'x', TARGET_SIZE);

          // Конвертуємо в base64 JPEG з якістю 80%
          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
          resolve(compressedBase64);
        };

        img.onerror = () => reject(new Error('Помилка завантаження зображення'));
        img.src = e.target?.result as string;
      };

      reader.onerror = () => reject(new Error('Помилка читання файлу'));
      reader.readAsDataURL(file);
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

  // Helper function to load image as Promise
  const loadImage = (src: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Не вдалося завантажити зображення: ${src.substring(0, 50)}...`));
      img.src = src;
    });
  };

  const applyBrandFrame = async (): Promise<string | null> => {
    if (!enhancedImage) return null;

    try {
      console.log('🎨 Починаємо малювати зображення з накладеннями...');

      // Крок 1: Створити canvas
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        throw new Error('Не вдалося створити canvas context');
      }

      // Крок 2: Завантажити оригінальне зображення
      console.log('📥 Завантажуємо оригінальне зображення...');
      const baseImg = await loadImage(`data:image/jpeg;base64,${enhancedImage}`);
      console.log('✅ Оригінальне зображення завантажено:', baseImg.width, 'x', baseImg.height);

      // Встановлюємо розмір canvas
      canvas.width = baseImg.width;
      canvas.height = baseImg.height;

      // Малюємо оригінальне зображення
      ctx.drawImage(baseImg, 0, 0);
      console.log('✅ Оригінальне зображення намальовано');

      // Крок 3: Якщо є рамка - завантажити та намалювати
      if (brandFrame) {
        console.log('🖼️ Завантажуємо рамку...');
        const frameImg = await loadImage(`data:image/png;base64,${brandFrame}`);
        console.log('✅ Рамка завантажена:', frameImg.width, 'x', frameImg.height);

        // Розраховуємо розмір рамки з урахуванням масштабу
        const scale = frameScale / 100;
        const scaledWidth = canvas.width * scale;
        const scaledHeight = canvas.height * scale;

        // Позиціонуємо рамку на основі відсотків (0-100)
        // Рамка може виходити за межі canvas
        // Діапазон руху = 2x розміру рамки (рамка може повністю зникнути за межами)
        const moveRangeX = scaledWidth * 2;
        const moveRangeY = scaledHeight * 2;

        // 0% = зсув вліво/вгору (рамка повністю за межами зверху/зліва)
        // 50% = центр canvas
        // 100% = зсув вправо/вниз (рамка повністю за межами знизу/справа)
        const frameX = (canvas.width - scaledWidth) / 2 + (moveRangeX * (framePositionX - 50) / 100);
        const frameY = (canvas.height - scaledHeight) / 2 + (moveRangeY * (framePositionY - 50) / 100);

        // Зберігаємо поточний стан canvas
        ctx.save();

        // Застосовуємо трансформації для дзеркалення
        ctx.translate(frameX + scaledWidth / 2, frameY + scaledHeight / 2);

        // Дзеркалення: -1 = відзеркалити, 1 = без змін
        ctx.scale(frameFlipH ? -1 : 1, frameFlipV ? -1 : 1);

        // Малюємо рамку з центром в (0, 0) після трансформації
        ctx.drawImage(frameImg, -scaledWidth / 2, -scaledHeight / 2, scaledWidth, scaledHeight);

        // Відновлюємо стан canvas
        ctx.restore();

        console.log('✅ Рамку намальовано з масштабом:', frameScale + '%, позиція:', `${framePositionX}%, ${framePositionY}%`, 'дзеркалення:', frameFlipH ? 'H' : '', frameFlipV ? 'V' : '');
      }

      // Крок 4: Якщо є текст - намалювати текст
      if (overlayText) {
        console.log('📝 Малюємо текст:', overlayText);

        ctx.font = `bold ${fontSize}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Позиція тексту на основі відсотків (0-100)
        const textX = (canvas.width * textPositionX) / 100;
        const textY = (canvas.height * textPositionY) / 100;

        console.log('📍 Позиція тексту:', textX, textY, `(${textPositionX}%, ${textPositionY}%)`);

        // Ефект світіння (якщо увімкнено)
        if (textGlow) {
          ctx.shadowColor = textColor;
          ctx.shadowBlur = 20;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 0;
        } else {
          ctx.shadowBlur = 0;
        }

        // Обводка
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3;
        ctx.strokeText(overlayText, textX, textY);

        // Основний текст
        ctx.fillStyle = textColor;
        ctx.fillText(overlayText, textX, textY);
        console.log('✅ Текст намальовано, свічення:', textGlow ? 'увімкнено' : 'вимкнено');
      }

      // Крок 5: Отримати результат
      console.log('💾 Конвертуємо canvas в base64...');
      const editedBase64 = canvas.toDataURL('image/jpeg', 0.95).split(',')[1];
      console.log('✅ Зображення готове!');

      return editedBase64;
    } catch (error) {
      console.error('❌ Помилка при накладанні:', error);
      toast.error('Не вдалося застосувати редагування');
      return null;
    }
  };

  // Автоматичне оновлення при зміні параметрів
  useEffect(() => {
    console.log('🔄 useEffect викликано. Стан:', {
      enhancedImage: !!enhancedImage,
      brandFrame: !!brandFrame,
      overlayText: overlayText,
      fontSize: fontSize,
      textColor: textColor,
      textPositionX: textPositionX,
      textPositionY: textPositionY,
      textGlow: textGlow,
      frameScale: frameScale,
      framePositionX: framePositionX,
      framePositionY: framePositionY,
      frameFlipH: frameFlipH,
      frameFlipV: frameFlipV
    });

    if (enhancedImage && (brandFrame || overlayText)) {
      console.log('✨ Запускаємо applyBrandFrame...');
      applyBrandFrame().then(result => {
        if (result) {
          console.log('✅ Відредаговане зображення встановлено');
          setEditedImage(result);
        }
      }).catch(error => {
        console.error('❌ Помилка накладання рамки:', error);
        toast.error('Не вдалося застосувати редагування');
      });
    } else {
      console.log('⚠️ Умови не виконані, editedImage = null');
      setEditedImage(null);
    }
  }, [brandFrame, overlayText, fontSize, textColor, textPositionX, textPositionY, textGlow, frameScale, framePositionX, framePositionY, frameFlipH, frameFlipV, enhancedImage]);

  const handleFrameUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      console.log('⚠️ Файл не обрано');
      return;
    }

    console.log('📁 Обрано файл рамки:', file.name, file.type, file.size);

    if (!file.type.startsWith('image/')) {
      console.error('❌ Невірний тип файлу:', file.type);
      toast.error('Оберіть файл зображення (PNG)');
      return;
    }

    console.log('📖 Читаємо файл рамки...');
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      const base64Data = base64.split(',')[1];
      console.log('✅ Файл рамки прочитано, довжина base64:', base64Data.length);
      console.log('🎨 Встановлюємо brandFrame state...');
      setBrandFrame(base64Data);
      toast.success('Рамку завантажено!');
    };
    reader.onerror = () => {
      console.error('❌ Помилка FileReader');
      toast.error('Помилка завантаження рамки');
    };
    reader.readAsDataURL(file);
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
      toast.error("Оберіть файл зображення");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    setEnhancedImage(null);
    setOriginalImage(null);
    setEditedImage(null);
    setBrandFrame(null);
    setOverlayText("");

    try {
      // Спочатку стискаємо зображення
      const compressedBase64 = await compressImage(file);

      // Зберігаємо стиснуте зображення як оригінал
      setOriginalImage(compressedBase64);

      // Покращуємо зображення якщо Auto-Enhance увімкнено
      let imageToDisplay = compressedBase64;
      if (isAutoEnhance) {
        try {
          imageToDisplay = await enhanceImage(compressedBase64);
          setEnhancedImage(imageToDisplay);
        } catch (enhanceError) {
          console.error('Помилка покращення зображення:', enhanceError);
          imageToDisplay = compressedBase64;
          setEnhancedImage(compressedBase64);
        }
      } else {
        setEnhancedImage(compressedBase64);
      }

      toast.success("Фото завантажено! Тепер можете згенерувати опис.");
    } catch (err) {
      console.error('Помилка обробки фото:', err);
      const errorMessage = err instanceof Error ? err.message : "Не вдалося обробити фото. Спробуйте інше";
      setError(errorMessage);
      toast.error("Не вдалося обробити фото. Спробуйте інше");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateDescription = async () => {
    if (!enhancedImage) {
      toast.error("Спочатку завантажте фото");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      // Використовуємо відредаговане зображення якщо є, інакше покращене
      const imageToAnalyze = editedImage || enhancedImage;

      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ image: imageToAnalyze, mimeType: "image/jpeg" }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Помилка при обробці зображення");
      }

      const data = await response.json();
      setResult(data.result);
      const formattedText = formatInstagramPost(data.result);
      setEditableText(formattedText);
      toast.success("✨ Опис згенеровано!");
    } catch (err) {
      console.error('Помилка генерації опису:', err);
      const errorMessage = err instanceof Error ? err.message : "Не вдалося згенерувати опис";
      setError(errorMessage);
      toast.error("Не вдалося згенерувати опис");
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

  const handleDownloadImage = () => {
    if (!enhancedImage && !editedImage) {
      toast.error("Немає зображення для завантаження");
      return;
    }

    try {
      // Використовуємо відредаговане зображення якщо є, інакше покращене
      const imageToDownload = editedImage || enhancedImage;

      // Створюємо посилання для завантаження
      const link = document.createElement('a');
      link.href = `data:image/jpeg;base64,${imageToDownload}`;
      link.download = `molvis-post-${Date.now()}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success("📥 Фото завантажено!");
    } catch (error) {
      console.error('Помилка завантаження:', error);
      toast.error("Не вдалося завантажити фото");
    }
  };

  const handleSaveDraft = async () => {
    if (!enhancedImage || !editableText) {
      toast.error("Немає даних для збереження");
      return;
    }

    try {
      // Використовуємо відредаговане зображення якщо є, інакше покращене
      const imageToSave = editedImage || enhancedImage;

      // Витягуємо хештеги з тексту
      const hashtagMatches = editableText.match(/#[\wа-яА-ЯіїєґІЇЄҐ]+/g) || [];

      // Зберігаємо в Supabase
      const { data, error } = await supabase
        .from('posts')
        .insert([
          {
            image_url: `data:image/jpeg;base64,${imageToSave}`,
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

      <main className="w-full max-w-7xl mx-auto px-6 py-16">
        <div className="mb-12 text-center">
          <h1 className="mb-4 text-6xl font-bold tracking-tight text-white sm:text-7xl">
            MOLVIS
          </h1>
          <p className="text-xl text-gray-400 sm:text-2xl">
            Твій AI-SMM мольфар
          </p>
          <div className="mt-6 flex flex-wrap gap-3 justify-center">
            <Link
              href="/studio"
              className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold py-3 px-6 rounded-xl transition-all shadow-lg hover:shadow-xl"
            >
              🎨 AI Студія
            </Link>
            <Link
              href="/drafts"
              className="inline-flex items-center gap-2 bg-gray-800/50 hover:bg-gray-700/50 border border-gray-700 hover:border-purple-500/50 text-gray-300 hover:text-white font-semibold py-3 px-6 rounded-xl transition-all"
            >
              📂 Мої чернетки
            </Link>
          </div>
        </div>

        <div className="w-full max-w-2xl mx-auto lg:max-w-none space-y-6">
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

          {/* Brand Frame Editor - Show after image upload, before result */}
          {enhancedImage && !result && (
            <div className="grid lg:grid-cols-12 gap-6 items-start">
              {/* Left Column - Image Preview (Sticky on Desktop) */}
              <div className="lg:col-span-7">
                <div className="lg:sticky lg:top-6">
                  <div className="bg-gray-800/50 border border-gray-700 rounded-2xl overflow-hidden">
                    <div className="p-4 border-b border-gray-700">
                      <p className="text-sm text-gray-400">Попередній перегляд:</p>
                    </div>
                    <div className="relative w-full aspect-square max-h-[45vh] lg:max-h-none lg:aspect-square bg-black">
                      <img
                        src={`data:image/jpeg;base64,${editedImage || enhancedImage}`}
                        alt="Preview"
                        className="w-full h-full object-contain"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column - Tools & Controls */}
              <div className="lg:col-span-5 lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto lg:pr-2 lg:pb-6 space-y-6 scroll-smooth">
                {/* Brand Frame Editor Accordion */}
                <div className="bg-gray-800/50 border border-gray-700 rounded-2xl overflow-hidden">
                <button
                  onClick={() => setIsEditorOpen(!isEditorOpen)}
                  className="w-full flex items-center justify-between p-4 hover:bg-gray-700/30 transition-colors"
                >
                  <span className="text-lg font-semibold text-white flex items-center gap-2">
                    🖼️ Накласти брендову рамку
                  </span>
                  <span className={`text-gray-400 transition-transform ${isEditorOpen ? 'rotate-180' : ''}`}>
                    ▼
                  </span>
                </button>

                {isEditorOpen && (
                  <div className="border-t border-gray-700 p-6 space-y-6">
                    {/* Frame Upload */}
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Завантажити рамку (PNG з прозорістю)
                      </label>
                      <input
                        ref={frameInputRef}
                        type="file"
                        accept="image/png"
                        onChange={handleFrameUpload}
                        className="hidden"
                      />
                      <button
                        onClick={() => frameInputRef.current?.click()}
                        className="w-full bg-gray-700 hover:bg-gray-600 text-white font-medium py-3 px-4 rounded-xl transition-colors flex items-center justify-center gap-2"
                      >
                        📁 {brandFrame ? 'Змінити рамку' : 'Обрати рамку'}
                      </button>
                      {brandFrame && (
                        <div className="mt-2 space-y-2">
                          <button
                            onClick={() => setShowFrameLibrary(!showFrameLibrary)}
                            className="w-full bg-purple-600/80 hover:bg-purple-500/80 border border-purple-500/50 text-white font-medium py-2 px-4 rounded-lg transition-colors text-sm"
                          >
                            💾 {showFrameLibrary ? 'Приховати збереження' : 'Зберегти рамку'}
                          </button>
                          <button
                            onClick={() => {
                              setBrandFrame(null);
                              setFrameScale(100);
                              setFramePositionX(50);
                              setFramePositionY(50);
                              setFrameFlipH(false);
                              setFrameFlipV(false);
                              toast.success('Рамку видалено');
                            }}
                            className="w-full bg-red-900/30 hover:bg-red-900/50 text-red-400 font-medium py-2 px-4 rounded-lg transition-colors text-sm"
                          >
                            🗑️ Видалити рамку
                          </button>
                        </div>
                      )}

                      {/* Save Frame Form */}
                      {showFrameLibrary && brandFrame && (
                        <div className="mt-4 p-4 bg-gray-900/50 border border-gray-600 rounded-xl">
                          <label className="block text-sm font-medium text-gray-300 mb-2">
                            Назва рамки
                          </label>
                          <input
                            type="text"
                            value={frameName}
                            onChange={(e) => setFrameName(e.target.value)}
                            placeholder="Наприклад: Логотип бренду"
                            className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-purple-500 transition-colors mb-3"
                          />
                          <button
                            onClick={handleSaveCurrentFrame}
                            disabled={!frameName.trim()}
                            className="w-full bg-green-600/80 hover:bg-green-500/80 disabled:bg-gray-600/50 disabled:cursor-not-allowed border border-green-500/50 disabled:border-gray-600/50 text-white font-medium py-2 px-4 rounded-lg transition-colors text-sm"
                          >
                            ✅ Зберегти в бібліотеку
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Saved Frames Library */}
                    {savedFrames.length > 0 && (
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-3">
                          📚 Бібліотека рамок ({savedFrames.length})
                        </label>
                        {loadingFrames ? (
                          <div className="text-center py-4">
                            <p className="text-sm text-gray-400">Завантаження...</p>
                          </div>
                        ) : (
                          <div className="grid grid-cols-4 gap-2">
                            {savedFrames.map((frame) => (
                              <div
                                key={frame.id}
                                className="relative group bg-gray-900/50 border border-gray-600 rounded-lg overflow-hidden hover:border-purple-500/50 transition-all cursor-pointer"
                                onClick={() => handleSelectFrame(frame)}
                              >
                                <div className="w-full h-12 bg-black p-1 flex items-center justify-center">
                                  <img
                                    src={frame.thumbnail_path}
                                    alt={frame.name}
                                    className="max-w-full max-h-full object-contain"
                                  />
                                </div>
                                <div className="p-1.5 border-t border-gray-700">
                                  <p className="text-xs text-white font-medium truncate text-center">{frame.name}</p>
                                </div>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteFrame(frame.id, frame.name);
                                  }}
                                  className="absolute top-0.5 right-0.5 bg-red-900/80 hover:bg-red-800 text-white text-xs p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                                  title="Видалити"
                                >
                                  ✕
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Overlay Text */}
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Текст на зображенні
                      </label>
                      <input
                        type="text"
                        value={overlayText}
                        onChange={(e) => setOverlayText(e.target.value)}
                        placeholder="Наприклад: НОВИНКА 2025"
                        className="w-full bg-gray-900/50 border border-gray-600 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors"
                      />
                    </div>

                    {/* Font Size Slider */}
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Розмір шрифту: {fontSize}px
                      </label>
                      <input
                        type="range"
                        min="12"
                        max="120"
                        value={fontSize}
                        onChange={(e) => setFontSize(Number(e.target.value))}
                        className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-600"
                      />
                    </div>

                    {/* Text Color Picker */}
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Колір тексту
                      </label>
                      <div className="flex items-center gap-3">
                        <input
                          type="color"
                          value={textColor}
                          onChange={(e) => setTextColor(e.target.value)}
                          className="w-16 h-12 rounded-lg cursor-pointer bg-gray-900 border border-gray-600"
                        />
                        <input
                          type="text"
                          value={textColor}
                          onChange={(e) => setTextColor(e.target.value)}
                          className="flex-1 bg-gray-900/50 border border-gray-600 rounded-lg px-4 py-2 text-white font-mono text-sm focus:outline-none focus:border-purple-500 transition-colors"
                        />
                      </div>
                    </div>

                    {/* Text Position X Slider */}
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Позиція тексту (горизонталь): {textPositionX}%
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={textPositionX}
                        onChange={(e) => setTextPositionX(Number(e.target.value))}
                        className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-600"
                      />
                      <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>Ліво</span>
                        <span>Центр</span>
                        <span>Право</span>
                      </div>
                    </div>

                    {/* Text Position Y Slider */}
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Позиція тексту (вертикаль): {textPositionY}%
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={textPositionY}
                        onChange={(e) => setTextPositionY(Number(e.target.value))}
                        className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-600"
                      />
                      <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>Верх</span>
                        <span>Центр</span>
                        <span>Низ</span>
                      </div>
                    </div>

                    {/* Text Glow Toggle */}
                    <div>
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={textGlow}
                          onChange={(e) => setTextGlow(e.target.checked)}
                          className="w-5 h-5 rounded bg-gray-900 border-gray-600 text-purple-600 focus:ring-purple-500 focus:ring-offset-gray-900 cursor-pointer"
                        />
                        <span className="text-sm font-medium text-gray-300">
                          Свічення тексту
                        </span>
                      </label>
                    </div>

                    {/* Frame Scale Slider */}
                    {brandFrame && (
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Розмір рамки: {frameScale}%
                        </label>
                        <input
                          type="range"
                          min="50"
                          max="150"
                          value={frameScale}
                          onChange={(e) => setFrameScale(Number(e.target.value))}
                          className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-600"
                        />
                        <div className="flex justify-between text-xs text-gray-500 mt-1">
                          <span>50%</span>
                          <span>100%</span>
                          <span>150%</span>
                        </div>
                      </div>
                    )}

                    {/* Frame Position X Slider */}
                    {brandFrame && (
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Позиція рамки (горизонталь): {framePositionX}%
                        </label>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={framePositionX}
                          onChange={(e) => setFramePositionX(Number(e.target.value))}
                          className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-600"
                        />
                        <div className="flex justify-between text-xs text-gray-500 mt-1">
                          <span>Ліво</span>
                          <span>Центр</span>
                          <span>Право</span>
                        </div>
                      </div>
                    )}

                    {/* Frame Position Y Slider */}
                    {brandFrame && (
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Позиція рамки (вертикаль): {framePositionY}%
                        </label>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={framePositionY}
                          onChange={(e) => setFramePositionY(Number(e.target.value))}
                          className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-600"
                        />
                        <div className="flex justify-between text-xs text-gray-500 mt-1">
                          <span>Верх</span>
                          <span>Центр</span>
                          <span>Низ</span>
                        </div>
                      </div>
                    )}

                    {/* Frame Flip Controls */}
                    {brandFrame && (
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-3">
                          Віддзеркалення рамки
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                          <button
                            onClick={() => setFrameFlipH(!frameFlipH)}
                            className={`py-2 px-4 rounded-lg transition-all font-medium text-sm ${
                              frameFlipH
                                ? 'bg-purple-600/80 border border-purple-500/50 text-white'
                                : 'bg-gray-700/80 border border-gray-600/50 text-gray-300 hover:bg-gray-600/80'
                            }`}
                          >
                            ↔️ По горизонталі
                          </button>
                          <button
                            onClick={() => setFrameFlipV(!frameFlipV)}
                            className={`py-2 px-4 rounded-lg transition-all font-medium text-sm ${
                              frameFlipV
                                ? 'bg-purple-600/80 border border-purple-500/50 text-white'
                                : 'bg-gray-700/80 border border-gray-600/50 text-gray-300 hover:bg-gray-600/80'
                            }`}
                          >
                            ↕️ По вертикалі
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Preview Info */}
                    {editedImage && (
                      <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-3">
                        <p className="text-xs text-blue-400">
                          ✅ Зміни застосовано! Коли згенеруєте опис, він буде створений для відредагованого зображення.
                        </p>
                      </div>
                    )}
                  </div>
                )}
                </div>

                {/* Generate Description Button */}
                <button
                  onClick={handleGenerateDescription}
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:from-gray-600 disabled:to-gray-700 text-white font-semibold py-4 px-6 rounded-xl transition-all shadow-lg hover:shadow-xl disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Генеруємо опис...
                    </>
                  ) : (
                    <>
                      ✨ Згенерувати опис
                    </>
                  )}
                </button>
              </div>
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
                    src={`data:image/jpeg;base64,${editedImage || enhancedImage}`}
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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <button
                  onClick={handleDownloadImage}
                  className="bg-gray-700/80 hover:bg-gray-600/80 border border-gray-600/50 hover:border-gray-500/50 text-white font-medium py-3 px-6 rounded-xl transition-all"
                >
                  📥 Завантажити фото
                </button>
                <button
                  onClick={handleCopyText}
                  className="bg-gray-700/80 hover:bg-gray-600/80 border border-gray-600/50 hover:border-gray-500/50 text-white font-medium py-3 px-6 rounded-xl transition-all"
                >
                  📋 Скопіювати текст
                </button>
                <button
                  onClick={handleSaveDraft}
                  className="sm:col-span-2 lg:col-span-1 bg-gray-700/80 hover:bg-gray-600/80 border border-gray-600/50 hover:border-gray-500/50 text-white font-medium py-3 px-6 rounded-xl transition-all"
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
