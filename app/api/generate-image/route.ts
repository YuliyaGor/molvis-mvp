import { NextResponse } from "next/server";

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

    // Запит до Imagen 3 API
    const imageGenResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-001:predict`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          instances: [
            {
              prompt: prompt,
            }
          ],
          parameters: {
            sampleCount: 1,
            aspectRatio: "1:1", // Квадратне для Instagram
            safetySetting: "block_some",
            personGeneration: "allow_adult",
          }
        })
      }
    );

    if (!imageGenResponse.ok) {
      const errorText = await imageGenResponse.text();
      console.error('❌ Помилка Imagen API:', imageGenResponse.status, errorText);

      // Обробка різних помилок
      if (imageGenResponse.status === 403 || imageGenResponse.status === 404) {
        return NextResponse.json(
          {
            error: "Функція генерації поки недоступна для вашого тарифу API",
            details: "Imagen 3 requires a paid API plan"
          },
          { status: 403 }
        );
      }

      if (imageGenResponse.status === 429) {
        return NextResponse.json(
          { error: "Перевищено ліміт запитів. Спробуйте через хвилину." },
          { status: 429 }
        );
      }

      return NextResponse.json(
        { error: `Помилка генерації: ${imageGenResponse.statusText}` },
        { status: imageGenResponse.status }
      );
    }

    const imageData = await imageGenResponse.json();

    if (!imageData.predictions || !imageData.predictions[0] || !imageData.predictions[0].bytesBase64Encoded) {
      console.error('❌ Некоректна відповідь від Imagen:', imageData);
      return NextResponse.json(
        { error: "Не вдалося отримати зображення з API" },
        { status: 500 }
      );
    }

    const generatedImage = imageData.predictions[0].bytesBase64Encoded;
    console.log('✅ Зображення успішно згенеровано');

    return NextResponse.json({
      image: generatedImage,
      prompt: prompt
    });

  } catch (error: any) {
    console.error("📛 ПОМИЛКА ГЕНЕРАЦІЇ:", error);
    return NextResponse.json(
      { error: error.message || "Помилка сервера" },
      { status: 500 }
    );
  }
}
