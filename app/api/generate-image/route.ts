import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(req: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "API ключ не знайдено" }, { status: 500 });
    }

    const data = await req.json();
    const prompt = data.prompt;

    if (!prompt || prompt.trim().length === 0) {
      return NextResponse.json({ error: "Промпт не може бути порожнім" }, { status: 400 });
    }

    console.log('🎨 Генеруємо зображення з промптом:', prompt);

    // Крок 2: Ініціалізація Gemini для перекладу та покращення
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
        console.log('📋 Доступні моделі:', availableModels.join(', '));
      }
    } catch (e) {
      console.log('⚠️ Не вдалося отримати список моделей, використовую заздалегідь визначені');
    }

    // Заздалегідь визначені моделі як fallback
    const predefinedModels = [
      "gemini-1.5-flash",
      "gemini-1.5-pro",
    ];

    // Використовуємо доступні моделі, якщо вдалося їх отримати
    const modelsToTry = availableModels.length > 0 ? availableModels.slice(0, 5) : predefinedModels;

    let enhancedPrompt = `Ultra detailed, photorealistic, 8K resolution, sharp focus, professional photography, vibrant colors, studio lighting: ${prompt}`; // Запасний варіант
    let translationSuccess = false;

    // Крок 3: Переклад та покращення через Gemini (з перебором моделей)
    console.log('🔄 Починаємо переклад промпта через Gemini...');

    for (const modelName of modelsToTry) {
      try {
        console.log(`   ⏳ Пробуємо модель: ${modelName}...`);
        const model = genAI.getGenerativeModel({ model: modelName });

        const translationTask = `Translate this text to English and enhance it for a high-quality image generator. Add technical details: "ultra detailed, sharp focus, 8K resolution, professional photography, photorealistic, detailed textures, vibrant colors, studio lighting". Keep it concise but descriptive. Text: ${prompt}`;

        const result = await model.generateContent(translationTask);
        const response = result.response;
        const enhancedText = response.text().trim();

        // Крок 4: Перевірка відповіді Gemini
        if (enhancedText && enhancedText.length > 0) {
          enhancedPrompt = enhancedText;
          translationSuccess = true;
          console.log(`   ✅ Модель ${modelName} успішно переклала:`);
          console.log(`   📝 Переклад: "${enhancedPrompt}"`);
          break; // Вийти з циклу після першого успіху
        } else {
          console.log(`   ⚠️ Модель ${modelName} повернула порожню відповідь`);
        }
      } catch (modelError: any) {
        console.error(`   ❌ Модель ${modelName} помилка:`, modelError.message || modelError);
        // Продовжуємо до наступної моделі
      }
    }

    // Якщо всі моделі впали
    if (!translationSuccess) {
      console.log('⚠️ ВСІ моделі Gemini не спрацювали!');
      console.log(`📝 Використовуємо запасний варіант: "${enhancedPrompt}"`);
    }

    // Крок 5: Формування URL для Pollinations
    const encodedPrompt = encodeURIComponent(enhancedPrompt);
    const randomSeed = Math.floor(Math.random() * 10000);
    const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1080&height=1080&model=flux&nologo=true&seed=${randomSeed}&enhance=true&quality=100`;

    console.log(`🌐 Запит до Pollinations.ai (seed: ${randomSeed})...`);

    // Крок 6: Завантаження зображення
    const imageResponse = await fetch(pollinationsUrl);

    if (!imageResponse.ok) {
      console.error('❌ Помилка Pollinations API:', imageResponse.status, imageResponse.statusText);
      return NextResponse.json(
        { error: `Помилка генерації: ${imageResponse.statusText}` },
        { status: imageResponse.status }
      );
    }

    // Конвертація arrayBuffer -> base64
    const imageBuffer = await imageResponse.arrayBuffer();
    const base64Image = Buffer.from(imageBuffer).toString('base64');

    console.log('✅ Зображення успішно згенеровано!');

    // Крок 7: Повернення результату з перекладеним промптом
    return NextResponse.json({
      image: base64Image,
      translatedPrompt: enhancedPrompt
    });

  } catch (error: any) {
    console.error("📛 ПОМИЛКА ГЕНЕРАЦІЇ:", error);
    return NextResponse.json(
      { error: error.message || "Помилка сервера" },
      { status: 500 }
    );
  }
}
