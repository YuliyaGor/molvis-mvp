import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Використовуємо service role для обходу RLS
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

const FACEBOOK_APP_ID = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID!;
const FACEBOOK_APP_SECRET = process.env.FACEBOOK_APP_SECRET!;

interface FacebookPage {
  id: string;
  name: string;
  access_token: string;
  instagram_business_account?: {
    id: string;
    username: string;
    profile_picture_url?: string;
  };
}

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

    const supabaseClient = createClient(
      supabaseUrl,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);

    if (userError || !user) {
      console.error("Auth error:", userError);
      return NextResponse.json(
        { error: "Unauthorized - invalid token" },
        { status: 401 }
      );
    }

    const userId = user.id;

    // Визначаємо redirect URI (має бути таким самим як при авторизації)
    const origin = request.headers.get("origin") || request.headers.get("referer")?.split("/settings")[0] || "http://localhost:3000";
    const redirectUri = `${origin}/settings`;

    // 1. Обмін authorization code на access token
    const tokenResponse = await fetch(
      `https://graph.facebook.com/v18.0/oauth/access_token?` +
        `client_id=${FACEBOOK_APP_ID}&` +
        `client_secret=${FACEBOOK_APP_SECRET}&` +
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
        `client_id=${FACEBOOK_APP_ID}&` +
        `client_secret=${FACEBOOK_APP_SECRET}&` +
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

    // 3. Отримуємо список сторінок користувача
    const pagesResponse = await fetch(
      `https://graph.facebook.com/v18.0/me/accounts?` +
        `fields=id,name,access_token,instagram_business_account{id,username,profile_picture_url}&` +
        `access_token=${longLivedToken}`
    );

    const pagesData = await pagesResponse.json();

    if (pagesData.error) {
      console.error("Pages error:", pagesData.error);
      return NextResponse.json(
        { error: "Failed to get pages: " + pagesData.error.message },
        { status: 400 }
      );
    }

    const pages: FacebookPage[] = pagesData.data || [];

    // 4. Знаходимо сторінки з підключеним Instagram Business акаунтом
    const pagesWithInstagram = pages.filter(
      (page) => page.instagram_business_account
    );

    if (pagesWithInstagram.length === 0) {
      return NextResponse.json(
        {
          error:
            "Не знайдено Instagram Business акаунтів. Переконайтеся, що ваш Instagram акаунт є Business або Creator і пов'язаний з Facebook сторінкою.",
        },
        { status: 400 }
      );
    }

    // 5. Зберігаємо перший знайдений акаунт
    const page = pagesWithInstagram[0];
    const igAccount = page.instagram_business_account!;

    // 6. Отримуємо long-lived page access token
    const pageTokenResponse = await fetch(
      `https://graph.facebook.com/v18.0/${page.id}?` +
        `fields=access_token&` +
        `access_token=${longLivedToken}`
    );

    const pageTokenData = await pageTokenResponse.json();
    const pageAccessToken = pageTokenData.access_token || page.access_token;

    // 7. Перевіряємо чи акаунт вже підключений
    const { data: existingAccount } = await supabaseAdmin
      .from("instagram_accounts")
      .select("id")
      .eq("user_id", userId)
      .eq("instagram_business_id", igAccount.id)
      .single();

    if (existingAccount) {
      // Оновлюємо існуючий акаунт
      const { data: updatedAccount, error: updateError } = await supabaseAdmin
        .from("instagram_accounts")
        .update({
          access_token: pageAccessToken,
          page_id: page.id,
          username: igAccount.username,
          avatar_url: igAccount.profile_picture_url || null,
        })
        .eq("id", existingAccount.id)
        .select()
        .single();

      if (updateError) {
        console.error("Update error:", updateError);
        return NextResponse.json(
          { error: "Failed to update account" },
          { status: 500 }
        );
      }

      return NextResponse.json({
        message: "Account updated successfully",
        account: updatedAccount,
      });
    }

    // 8. Зберігаємо новий акаунт
    const { data: newAccount, error: insertError } = await supabaseAdmin
      .from("instagram_accounts")
      .insert({
        user_id: userId,
        access_token: pageAccessToken,
        instagram_business_id: igAccount.id,
        page_id: page.id,
        username: igAccount.username,
        avatar_url: igAccount.profile_picture_url || null,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Insert error:", insertError);
      return NextResponse.json(
        { error: "Failed to save account: " + insertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: "Account connected successfully",
      account: newAccount,
    });
  } catch (error: any) {
    console.error("Instagram connect error:", error);
    return NextResponse.json(
      { error: "Internal server error: " + error.message },
      { status: 500 }
    );
  }
}
