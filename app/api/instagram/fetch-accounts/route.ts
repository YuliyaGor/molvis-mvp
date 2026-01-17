import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;

interface InstagramBusinessAccount {
  id: string;
  username: string;
  profile_picture_url?: string;
  name?: string;
}

interface FacebookPage {
  id: string;
  name: string;
  access_token: string;
  instagram_business_account?: InstagramBusinessAccount;
}

export async function POST(request: NextRequest) {
  try {
    const { accessToken } = await request.json();

    if (!accessToken) {
      return NextResponse.json(
        { error: "Access token is required" },
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

    // Отримуємо список сторінок з Instagram Business акаунтами
    const pagesResponse = await fetch(
      `https://graph.facebook.com/v18.0/me/accounts?` +
        `fields=id,name,access_token,instagram_business_account{id,username,profile_picture_url,name}&` +
        `access_token=${accessToken}`
    );

    const pagesData = await pagesResponse.json();

    if (pagesData.error) {
      console.error("Facebook API error:", pagesData.error);
      return NextResponse.json(
        { error: "Failed to fetch pages: " + pagesData.error.message },
        { status: 400 }
      );
    }

    const pages: FacebookPage[] = pagesData.data || [];

    // Фільтруємо тільки сторінки з Instagram Business акаунтами
    const accountsWithInstagram = pages
      .filter((page) => page.instagram_business_account)
      .map((page) => ({
        pageId: page.id,
        pageName: page.name,
        instagramId: page.instagram_business_account!.id,
        username: page.instagram_business_account!.username,
        avatarUrl: page.instagram_business_account!.profile_picture_url || null,
        name: page.instagram_business_account!.name || page.name,
      }));

    return NextResponse.json({
      accounts: accountsWithInstagram,
      totalPages: pages.length,
      pagesWithInstagram: accountsWithInstagram.length,
    });
  } catch (error: any) {
    console.error("Fetch accounts error:", error);
    return NextResponse.json(
      { error: "Internal server error: " + error.message },
      { status: 500 }
    );
  }
}
