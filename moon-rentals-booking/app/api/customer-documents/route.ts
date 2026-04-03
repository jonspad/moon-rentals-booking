import { NextRequest, NextResponse } from 'next/server';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

const ALLOWED_DOCUMENT_TYPES = new Set(['license', 'insurance']);
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
]);
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

function sanitizeFilename(filename: string) {
  return filename.replace(/[^a-zA-Z0-9._-]/g, '_');
}

function getExtensionFromFile(file: File) {
  const original = file.name?.trim() || '';
  const extFromName = path.extname(original);

  if (extFromName) {
    return extFromName.toLowerCase();
  }

  switch (file.type) {
    case 'image/jpeg':
      return '.jpg';
    case 'image/png':
      return '.png';
    case 'image/webp':
      return '.webp';
    case 'application/pdf':
      return '.pdf';
    default:
      return '';
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const customerIdParam = searchParams.get('customerId');
    const bookingIdParam = searchParams.get('bookingId');

    const customerId = customerIdParam ? Number(customerIdParam) : undefined;
    const bookingId = bookingIdParam ? Number(bookingIdParam) : undefined;

    if (customerIdParam && Number.isNaN(customerId)) {
      return NextResponse.json(
        { error: 'Invalid customerId.' },
        { status: 400 }
      );
    }

    if (bookingIdParam && Number.isNaN(bookingId)) {
      return NextResponse.json(
        { error: 'Invalid bookingId.' },
        { status: 400 }
      );
    }

    const documents = await prisma.customerDocument.findMany({
      where: {
        ...(customerId ? { customerId } : {}),
        ...(bookingId ? { bookingId } : {}),
      },
      include: {
        customer: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        booking: {
          select: {
            id: true,
            status: true,
            verificationStatus: true,
            paymentStatus: true,
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }],
    });

    return NextResponse.json({ documents });
  } catch (error) {
    console.error('Failed to load customer documents:', error);
    return NextResponse.json(
      { error: 'Failed to load customer documents.' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    const customerIdValue = formData.get('customerId');
    const bookingIdValue = formData.get('bookingId');
    const documentTypeValue = formData.get('documentType');
    const notesValue = formData.get('notes');
    const fileValue = formData.get('file');

    const customerId = Number(customerIdValue);
    const bookingId =
      bookingIdValue && String(bookingIdValue).trim() !== ''
        ? Number(bookingIdValue)
        : null;
    const documentType = String(documentTypeValue || '')
      .trim()
      .toLowerCase();
    const notes = String(notesValue || '').trim();

    if (!customerIdValue || Number.isNaN(customerId)) {
      return NextResponse.json(
        { error: 'Valid customerId is required.' },
        { status: 400 }
      );
    }

    if (bookingIdValue && bookingId !== null && Number.isNaN(bookingId)) {
      return NextResponse.json(
        { error: 'bookingId must be a valid number.' },
        { status: 400 }
      );
    }

    if (!ALLOWED_DOCUMENT_TYPES.has(documentType)) {
      return NextResponse.json(
        { error: 'documentType must be either "license" or "insurance".' },
        { status: 400 }
      );
    }

    if (!(fileValue instanceof File)) {
      return NextResponse.json(
        { error: 'A file upload is required.' },
        { status: 400 }
      );
    }

    if (fileValue.size === 0) {
      return NextResponse.json(
        { error: 'Uploaded file is empty.' },
        { status: 400 }
      );
    }

    if (fileValue.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: 'File exceeds 10 MB limit.' },
        { status: 400 }
      );
    }

    if (!ALLOWED_MIME_TYPES.has(fileValue.type)) {
      return NextResponse.json(
        {
          error:
            'Unsupported file type. Upload a PDF, JPG, PNG, or WEBP file.',
        },
        { status: 400 }
      );
    }

    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: { id: true },
    });

    if (!customer) {
      return NextResponse.json(
        { error: 'Customer not found.' },
        { status: 404 }
      );
    }

    if (bookingId !== null) {
      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        select: { id: true, customerId: true },
      });

      if (!booking) {
        return NextResponse.json(
          { error: 'Booking not found.' },
          { status: 404 }
        );
      }

      if (booking.customerId !== customerId) {
        return NextResponse.json(
          { error: 'Booking does not belong to this customer.' },
          { status: 400 }
        );
      }
    }

    const uploadsDir = path.join(
      process.cwd(),
      'public',
      'uploads',
      'customer-documents'
    );

    await mkdir(uploadsDir, { recursive: true });

    const ext = getExtensionFromFile(fileValue);
    const safeOriginalName = sanitizeFilename(fileValue.name || 'document');
    const storedFilename = `${documentType}-${customerId}-${randomUUID()}${ext}`;
    const absoluteFilePath = path.join(uploadsDir, storedFilename);
    const publicFilePath = `/uploads/customer-documents/${storedFilename}`;

    const bytes = await fileValue.arrayBuffer();
    const buffer = Buffer.from(bytes);

    await writeFile(absoluteFilePath, buffer);

    const document = await prisma.customerDocument.create({
      data: {
        customerId,
        bookingId,
        documentType,
        filePath: publicFilePath,
        originalName: safeOriginalName,
        mimeType: fileValue.type || null,
        notes: notes || null,
        status: 'pending',
      },
      include: {
        customer: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        booking: {
          select: {
            id: true,
            status: true,
            verificationStatus: true,
            paymentStatus: true,
          },
        },
      },
    });

    await prisma.customer.update({
      where: { id: customerId },
      data: {
        verificationStatus: 'pending',
      },
    });

    if (bookingId !== null) {
      await prisma.booking.update({
        where: { id: bookingId },
        data: {
          verificationStatus: 'pending',
        },
      });
    }

    return NextResponse.json(
      {
        message: 'Document uploaded successfully.',
        document,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Failed to upload customer document:', error);
    return NextResponse.json(
      { error: 'Failed to upload customer document.' },
      { status: 500 }
    );
  }
}