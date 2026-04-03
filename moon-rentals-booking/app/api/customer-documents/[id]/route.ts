import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { unlink } from 'node:fs/promises';
import path from 'node:path';

export const runtime = 'nodejs';

// ==========================
// PATCH (Approve / Reject / Rename)
// ==========================
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = Number(params.id);
    if (Number.isNaN(id)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    const body = await req.json();
    const { status, originalName } = body;

    const updateData: any = {};

    // Approve / Reject
    if (status) {
      if (!['approved', 'rejected'].includes(status)) {
        return NextResponse.json(
          { error: 'Invalid status' },
          { status: 400 }
        );
      }

      updateData.status = status;
      updateData.reviewedAt = new Date();
    }

    // Rename
    if (originalName) {
      updateData.originalName = originalName;
    }

    const updated = await prisma.customerDocument.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ document: updated });
  } catch (error) {
    console.error('PATCH error:', error);
    return NextResponse.json(
      { error: 'Failed to update document' },
      { status: 500 }
    );
  }
}

// ==========================
// DELETE (Remove file + DB record)
// ==========================
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = Number(params.id);
    if (Number.isNaN(id)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    const document = await prisma.customerDocument.findUnique({
      where: { id },
    });

    if (!document) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }

    // Delete file from disk
    if (document.filePath) {
      const fullPath = path.join(process.cwd(), 'public', document.filePath);
      try {
        await unlink(fullPath);
      } catch (err) {
        console.warn('File delete failed (continuing):', err);
      }
    }

    // Delete DB record
    await prisma.customerDocument.delete({
      where: { id },
    });

    return NextResponse.json({ message: 'Deleted successfully' });
  } catch (error) {
    console.error('DELETE error:', error);
    return NextResponse.json(
      { error: 'Failed to delete document' },
      { status: 500 }
    );
  }
}