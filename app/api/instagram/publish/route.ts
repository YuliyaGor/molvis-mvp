import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Ліниве створення клієнтів щоб уникнути помилки під час білду
const getSupabaseAdmin = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(supabaseUrl, supabaseServiceKey);
};

const getSupabaseClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(supabaseUrl, supabaseAnonKey);
};

// Константи для polling
const MAX_POLLING_ATTEMPTS = 10;
const POLLING_INTERVAL_MS = 2500; // 2.5 секунди

export async function POST(request: NextRequest) {
  try {
    const { imageUrl, caption, accountId } = await request.json();

    if (!imageUrl) {
      return NextResponse.json(
        { error: "Image URL is required" },
        { status: 400 }
      );
    }

    if (!accountId) {
      return NextResponse.json(
        { error: "Account ID is required" },
        { status: 400 }
      );
    }

    // Отримуємо user_id з Authorization header
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");

    if (!token) {
      return NextResponse.json(
        { error: "Unauthorized - no token" },
        { status: 401 }
      );
    }

    const supabaseClient = getSupabaseClient();

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json(
        { error: "Unauthorized - invalid token" },
        { status: 401 }
      );
    }

    // Отримуємо Instagram акаунт
    const { data: account, error: accountError } = await getSupabaseAdmin()
      .from("instagram_accounts")
      .select("*")
      .eq("id", accountId)
      .eq("user_id", user.id)
      .single();

    if (accountError || !account) {
      return NextResponse.json(
        { error: "Instagram account not found" },
        { status: 404 }
      );
    }

    let finalImageUrl = imageUrl;

    // Якщо це base64, завантажуємо в Supabase Storage
    if (imageUrl.startsWith("data:image")) {
      console.log("📤 Uploading image to Supabase Storage...");
      const uploadResult = await uploadBase64ToStorage(imageUrl, user.id);
      if (!uploadResult.success) {
        return NextResponse.json(
          { error: uploadResult.error },
          { status: 500 }
        );
      }
      finalImageUrl = uploadResult.url;
      console.log("✅ Image uploaded:", finalImageUrl);
    }

    // Крок 1: Створюємо медіа-контейнер
    console.log("📦 Creating media container...");
    const createMediaResponse = await fetch(
      `https://graph.facebook.com/v18.0/${account.instagram_business_id}/media`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          image_url: finalImageUrl,
          caption: caption || "",
          access_token: account.access_token,
        }),
      }
    );

    const createMediaData = await createMediaResponse.json();

    if (createMediaData.error) {
      console.error("❌ Create media error:", createMediaData.error);
      return NextResponse.json(
        { error: "Failed to create media: " + createMediaData.error.message },
        { status: 400 }
      );
    }

    const creationId = createMediaData.id;
    console.log("✅ Container created with ID:", creationId);

    // Крок 2: Polling - чекаємо поки контейнер буде готовий
    console.log("⏳ Waiting for container to be ready...");
    const statusResult = await waitForContainerReady(
      creationId,
      account.access_token
    );

    if (!statusResult.success) {
      console.error("❌ Container status error:", statusResult.error);
      return NextResponse.json(
        { error: statusResult.error },
        { status: 400 }
      );
    }

    console.log("✅ Container is ready! Publishing...");

    // Крок 3: Публікуємо медіа
    const publishResponse = await fetch(
      `https://graph.facebook.com/v18.0/${account.instagram_business_id}/media_publish`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          creation_id: creationId,
          access_token: account.access_token,
        }),
      }
    );

    const publishData = await publishResponse.json();

    if (publishData.error) {
      console.error("❌ Publish error:", publishData.error);
      return NextResponse.json(
        { error: "Failed to publish: " + publishData.error.message },
        { status: 400 }
      );
    }

    console.log("🎉 Post published successfully! Media ID:", publishData.id);

    return NextResponse.json({
      success: true,
      message: "Post published successfully",
      mediaId: publishData.id,
    });
  } catch (error: any) {
    console.error("❌ Instagram publish error:", error);
    return NextResponse.json(
      { error: "Internal server error: " + error.message },
      { status: 500 }
    );
  }
}

// Функція для очікування готовності контейнера
async function waitForContainerReady(
  containerId: string,
  accessToken: string
): Promise<{ success: boolean; error?: string }> {
  for (let attempt = 1; attempt <= MAX_POLLING_ATTEMPTS; attempt++) {
    try {
      const statusResponse = await fetch(
        `https://graph.facebook.com/v18.0/${containerId}?fields=status_code&access_token=${accessToken}`
      );

      const statusData = await statusResponse.json();

      if (statusData.error) {
        return { success: false, error: statusData.error.message };
      }

      const status = statusData.status_code;
      console.log(`🔄 Status check ${attempt}/${MAX_POLLING_ATTEMPTS}: ${status}`);

      if (status === "FINISHED") {
        return { success: true };
      }

      if (status === "ERROR") {
        return { success: false, error: "Container processing failed with ERROR status" };
      }

      if (status === "IN_PROGRESS") {
        console.log(`⏳ Status: IN_PROGRESS... waiting ${POLLING_INTERVAL_MS / 1000}s`);
        await sleep(POLLING_INTERVAL_MS);
        continue;
      }

      // Невідомий статус - продовжуємо чекати
      console.log(`⏳ Status: ${status}... waiting ${POLLING_INTERVAL_MS / 1000}s`);
      await sleep(POLLING_INTERVAL_MS);
    } catch (error: any) {
      console.error(`❌ Status check error (attempt ${attempt}):`, error.message);
      // Продовжуємо спроби навіть при помилці
      await sleep(POLLING_INTERVAL_MS);
    }
  }

  return {
    success: false,
    error: `Container not ready after ${MAX_POLLING_ATTEMPTS} attempts (${MAX_POLLING_ATTEMPTS * POLLING_INTERVAL_MS / 1000}s)`
  };
}

// Функція для затримки
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Функція для завантаження base64 в Supabase Storage
async function uploadBase64ToStorage(
  base64Data: string,
  userId: string
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    // Витягуємо тип та дані
    const matches = base64Data.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!matches) {
      return { success: false, error: "Invalid base64 format" };
    }

    const imageType = matches[1];
    const base64 = matches[2];
    const buffer = Buffer.from(base64, "base64");

    // Генеруємо унікальне ім'я файлу
    const fileName = `${userId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${imageType}`;

    // Завантажуємо в Storage
    const { data, error } = await getSupabaseAdmin().storage
      .from("posts")
      .upload(fileName, buffer, {
        contentType: `image/${imageType}`,
        upsert: false,
      });

    if (error) {
      console.error("Storage upload error:", error);
      return { success: false, error: "Failed to upload image: " + error.message };
    }

    // Отримуємо публічний URL
    const { data: urlData } = getSupabaseAdmin().storage
      .from("posts")
      .getPublicUrl(fileName);

    return { success: true, url: urlData.publicUrl };
  } catch (error: any) {
    console.error("Upload error:", error);
    return { success: false, error: error.message };
  }
}
