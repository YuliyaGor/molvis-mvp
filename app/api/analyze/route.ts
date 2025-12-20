import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "API ключ не знайдено" }, { status: 500 });
    }

    const data = await req.json();
    const image = data.image;
    const base64Data = image.includes(",") ? image.split(",")[1] : image;

    const genAI = new GoogleGenerativeAI(apiKey);

    // Спочатку спробуємо отримати список доступних моделей
    let availableModels: string[] = [];
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
      );
      if (response.ok) {
        const data = await response.json();
        availableModels = data.models
          ?.filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
          ?.map((m: any) => m.name.replace('models/', '')) || [];
        console.log('📋 Доступні моделі:', availableModels);
      }
    } catch (e) {
      console.log('⚠️ Не вдалося отримати список моделей, використовую заздалегідь визначені');
    }

    // ОНОВЛЕНИЙ СПИСОК: Актуальні моделі Gemini API 2025
    const predefinedModels = [
      "gemini-1.5-flash",           // Стабільна швидка модель 1.5 (основна)
      "gemini-1.5-pro",             // Потужніша модель 1.5 (fallback)
    ];

    // Використовуємо доступні моделі, якщо вдалося їх отримати, інакше - заздалегідь визначені
    const modelsToTry = availableModels.length > 0 ? availableModels.slice(0, 5) : predefinedModels;

    let lastError = null;
    let generatedText = null;

    // Генерація SMM-поста (покращення зображення робиться на клієнті)
    for (const modelName of modelsToTry) {
      try {
        console.log(`🔄 Пробуємо модель для тексту: ${modelName}...`);
        const model = genAI.getGenerativeModel({ model: modelName });

        const result = await model.generateContent([
          `Проаналізуй це зображення і створи ТІЛЬКИ готовий пост для Instagram українською мовою.

ФОРМАТ ВІДПОВІДІ (без жодних додаткових пояснень, аналізу чи коментарів):
1. Перший рядок - яскравий заголовок (без ** та зірочок)
2. Порожній рядок
3. Текст посту (2-3 речення, емоційно, з емодзі)
4. Порожній рядок
5. 3-5 хештегів через пробіл

НЕ пиши "Ось пост", "Варіант", "Аналіз" чи інші пояснення. Тільки сам текст посту!`,
          {
            inlineData: {
              data: base64Data,
              mimeType: "image/jpeg",
            },
          },
        ]);

        generatedText = result.response.text();
        console.log(`✅ Успіх з моделлю: ${modelName}`);
        break;

      } catch (error: any) {
        console.error(`❌ Модель ${modelName} не спрацювала: ${error.message}`);
        lastError = error;
        if (error.message.includes("429")) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }

    if (!generatedText) {
      const errorMessage = lastError?.message || 'Невідома помилка';

      // Перевіряємо, чи це помилка квоти
      if (errorMessage.includes('429') || errorMessage.includes('quota')) {
        return NextResponse.json(
          {
            error: '⚠️ Перевищено ліміт безкоштовних запитів Gemini API. Спробуйте через 1 хвилину або перейдіть на платний тариф.',
            retryAfter: 60
          },
          { status: 429 }
        );
      }

      return NextResponse.json(
        { error: `Всі моделі зайняті або недоступні. Деталі: ${errorMessage}` },
        { status: 503 }
      );
    }

    return NextResponse.json({
      result: generatedText,
      enhancedImage: base64Data // Повертаємо оригінал (покращення робиться на клієнті)
    });

  } catch (error: any) {
    console.error("📛 ФІНАЛЬНА ПОМИЛКА:", error);
    return NextResponse.json(
      { error: error.message || "Помилка сервера" },
      { status: 500 }
    );
  }
}