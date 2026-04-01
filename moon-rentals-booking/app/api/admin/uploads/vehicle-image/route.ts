import { NextRequest, NextResponse } from 'next/server';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';

export const runtime = 'nodejs';

function sanitizeBaseName(name: string) {
  return name
    .toLowerCase()
    .replace(/\.[^/.]+$/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: 'No image file was uploaded.' },
        { status: 400 }
      );
    }

    if (!file.type.startsWith('image/')) {
      return NextResponse.json(
        { error: 'Only image uploads are allowed.' },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'vehicles');
    await mkdir(uploadDir, { recursive: true });

    const originalName = file.name || 'vehicle-image';
    const safeBase = sanitizeBaseName(originalName) || 'vehicle-image';
    const extension =
      path.extname(originalName).toLowerCase() ||
      (file.type === 'image/png'
        ? '.png'
        : file.type === 'image/webp'
        ? '.webp'
        : '.jpg');

    const fileName = `${Date.now()}-${safeBase}${extension}`;
    const fullPath = path.join(uploadDir, fileName);

    await writeFile(fullPath, buffer);

    const publicPath = `/uploads/vehicles/${fileName}`;

    return NextResponse.json({
      imagePath: publicPath,
      fileName,
    });
  } catch (error) {
    console.error('POST /api/admin/uploads/vehicle-image error:', error);
    return NextResponse.json(
      { error: 'Failed to upload image.' },
      { status: 500 }
    );
  }
}