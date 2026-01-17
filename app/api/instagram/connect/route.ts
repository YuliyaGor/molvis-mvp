import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Ліниве отримання конфігурації щоб уникнути помилки під час білду
const getConfig = () => ({
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  facebookAppId: process.env.NEXT_PUBLIC_FACEBOOK_APP_ID!,
  facebookAppSecret: process.env.FACEBOOK_APP_SECRET!,
});

// Цей endpoint тепер лише обмінює код на long-lived token
// Збереження акаунтів виконується через /api/instagram/save-accounts

export async function POST(request: NextRequest) {
  try {
    const { code } = await request.json();

    if (!code) {
      return NextResponse.json(
        { error: "Authorization code is required" },
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

    const config = getConfig();
    const supabaseClient = createClient(
      config.supabaseUrl,
      config.supabaseAnonKey
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);

    if (userError || !user) {
      console.error("Auth error:", userError);
      return NextResponse.json(
        { error: "Unauthorized - invalid token" },
        { status: 401 }
      );
    }

    // Визначаємо redirect URI (має бути таким самим як при авторизації)
    const origin = request.headers.get("origin") || request.headers.get("referer")?.split("/settings")[0] || "http://localhost:3000";
    const redirectUri = `${origin}/settings`;

    // 1. Обмін authorization code на access token
    const tokenResponse = await fetch(
      `https://graph.facebook.com/v18.0/oauth/access_token?` +
        `client_id=${config.facebookAppId}&` +
        `client_secret=${config.facebookAppSecret}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `code=${code}`
    );

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      console.error("Token exchange error:", tokenData.error);
      return NextResponse.json(
        { error: "Failed to exchange code: " + tokenData.error.message },
        { status: 400 }
      );
    }

    const shortLivedToken = tokenData.access_token;

    // 2. Обмін short-lived token на long-lived token
    const longLivedTokenResponse = await fetch(
      `https://graph.facebook.com/v18.0/oauth/access_token?` +
        `grant_type=fb_exchange_token&` +
        `client_id=${config.facebookAppId}&` +
        `client_secret=${config.facebookAppSecret}&` +
        `fb_exchange_token=${shortLivedToken}`
    );

    const longLivedTokenData = await longLivedTokenResponse.json();

    if (longLivedTokenData.error) {
      console.error("Long-lived token error:", longLivedTokenData.error);
      return NextResponse.json(
        { error: "Failed to get long-lived token: " + longLivedTokenData.error.message },
        { status: 400 }
      );
    }

    const longLivedToken = longLivedTokenData.access_token;

    // Повертаємо токен для подальшого використання клієнтом
    return NextResponse.json({
      accessToken: longLivedToken,
      message: "Token exchanged successfully",
    });
  } catch (error: any) {
    console.error("Instagram connect error:", error);
    return NextResponse.json(
      { error: "Internal server error: " + error.message },
      { status: 500 }
    );
  }
}
