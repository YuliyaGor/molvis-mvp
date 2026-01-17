import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

const FACEBOOK_APP_ID = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID!;
const FACEBOOK_APP_SECRET = process.env.FACEBOOK_APP_SECRET!;

interface SelectedAccount {
  pageId: string;
  instagramId: string;
}

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
    const { accessToken, selectedAccounts } = await request.json();

    if (!accessToken) {
      return NextResponse.json(
        { error: "Access token is required" },
        { status: 400 }
      );
    }

    if (!selectedAccounts || !Array.isArray(selectedAccounts) || selectedAccounts.length === 0) {
      return NextResponse.json(
        { error: "At least one account must be selected" },
        { status: 400 }
      );
    }

    // Перевіряємо авторизацію користувача
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
      return NextResponse.json(
        { error: "Unauthorized - invalid token" },
        { status: 401 }
      );
    }

    const userId = user.id;

    // 1. Обмін short-lived token на long-lived token
    const longLivedTokenResponse = await fetch(
      `https://graph.facebook.com/v18.0/oauth/access_token?` +
        `grant_type=fb_exchange_token&` +
        `client_id=${FACEBOOK_APP_ID}&` +
        `client_secret=${FACEBOOK_APP_SECRET}&` +
        `fb_exchange_token=${accessToken}`
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

    // 2. Отримуємо свіжі дані про сторінки
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

    // Створюємо Set з вибраних Instagram ID для швидкого пошуку
    const selectedInstagramIds = new Set(
      selectedAccounts.map((acc: SelectedAccount) => acc.instagramId)
    );

    // Фільтруємо тільки вибрані акаунти
    const selectedPages = pages.filter(
      (page) =>
        page.instagram_business_account &&
        selectedInstagramIds.has(page.instagram_business_account.id)
    );

    if (selectedPages.length === 0) {
      return NextResponse.json(
        { error: "None of the selected accounts were found" },
        { status: 400 }
      );
    }

    // 3. Зберігаємо кожен вибраний акаунт
    const savedAccounts = [];
    const errors = [];

    for (const page of selectedPages) {
      const igAccount = page.instagram_business_account!;

      // Отримуємо long-lived page access token
      const pageTokenResponse = await fetch(
        `https://graph.facebook.com/v18.0/${page.id}?` +
          `fields=access_token&` +
          `access_token=${longLivedToken}`
      );

      const pageTokenData = await pageTokenResponse.json();
      const pageAccessToken = pageTokenData.access_token || page.access_token;

      // Upsert - оновлюємо якщо існує, створюємо якщо ні
      const { data: savedAccount, error: upsertError } = await supabaseAdmin
        .from("instagram_accounts")
        .upsert(
          {
            user_id: userId,
            access_token: pageAccessToken,
            instagram_business_id: igAccount.id,
            page_id: page.id,
            username: igAccount.username,
            avatar_url: igAccount.profile_picture_url || null,
          },
          {
            onConflict: "user_id,instagram_business_id",
          }
        )
        .select()
        .single();

      if (upsertError) {
        console.error(`Error saving account ${igAccount.username}:`, upsertError);
        errors.push({
          username: igAccount.username,
          error: upsertError.message,
        });
      } else {
        savedAccounts.push(savedAccount);
      }
    }

    if (savedAccounts.length === 0) {
      return NextResponse.json(
        { error: "Failed to save any accounts", details: errors },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: `Successfully saved ${savedAccounts.length} account(s)`,
      accounts: savedAccounts,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: any) {
    console.error("Save accounts error:", error);
    return NextResponse.json(
      { error: "Internal server error: " + error.message },
      { status: 500 }
    );
  }
}
