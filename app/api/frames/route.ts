import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// GET - Отримати список всіх рамок
export async function GET() {
  try {
    const { data, error } = await supabase
      .from('frames')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching frames:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ frames: data || [] });
  } catch (error: any) {
    console.error('Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST - Завантажити нову рамку
export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const name = formData.get('name') as string;

    if (!file || !name) {
      return NextResponse.json(
        { error: 'File and name are required' },
        { status: 400 }
      );
    }

    // Перевірка типу файлу
    if (!file.type.startsWith('image/')) {
      return NextResponse.json(
        { error: 'Only image files are allowed' },
        { status: 400 }
      );
    }

    // Генеруємо унікальне ім'я файлу
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = `frames/${fileName}`;

    // Конвертуємо File в ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    // Завантажуємо файл в Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('frames')
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: false
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return NextResponse.json(
        { error: uploadError.message },
        { status: 500 }
      );
    }

    // Отримуємо публічний URL
    const { data: urlData } = supabase.storage
      .from('frames')
      .getPublicUrl(filePath);

    // Зберігаємо метадані в базі
    const { data: frameData, error: dbError } = await supabase
      .from('frames')
      .insert([
        {
          name: name,
          url: urlData.publicUrl
        }
      ] as any)
      .select()
      .single();

    if (dbError) {
      console.error('Database error:', dbError);
      // Видаляємо файл якщо не вдалося зберегти в БД
      await supabase.storage.from('frames').remove([filePath]);
      return NextResponse.json(
        { error: dbError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ frame: frameData }, { status: 201 });
  } catch (error: any) {
    console.error('Error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

// DELETE - Видалити рамку
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Frame ID is required' },
        { status: 400 }
      );
    }

    // Отримуємо інформацію про рамку
    const { data: frame, error: fetchError } = await supabase
      .from('frames')
      .select('url')
      .eq('id', id as any)
      .single();

    if (fetchError || !frame) {
      return NextResponse.json(
        { error: 'Frame not found' },
        { status: 404 }
      );
    }

    // Витягуємо шлях з URL для видалення з Storage
    const url = (frame as any).url as string;
    if (url) {
      const pathMatch = url.match(/frames\/(.+)$/);
      if (pathMatch) {
        const storagePath = `frames/${pathMatch[1]}`;
        const { error: storageError } = await supabase.storage
          .from('frames')
          .remove([storagePath]);

        if (storageError) {
          console.error('Storage deletion error:', storageError);
        }
      }
    }

    // Видаляємо запис з БД
    const { error: dbError } = await supabase
      .from('frames')
      .delete()
      .eq('id', id as any);

    if (dbError) {
      console.error('Database deletion error:', dbError);
      return NextResponse.json(
        { error: dbError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
