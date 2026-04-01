import { NextRequest, NextResponse } from 'next/server';
import { addBlock, deleteBlock, getBlocks } from '@/lib/blockStore';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const blocks = await getBlocks();
    return NextResponse.json({ blocks });
  } catch (error) {
    console.error('GET /api/vehicle-blocks error:', error);
    return NextResponse.json(
      { error: 'Failed to load blocks.' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const vehicleId = Number(body.vehicleId);
    const start = body.start;
    const end = body.end;
    const reason = body.reason ?? '';

    if (!vehicleId || !start || !end) {
      return NextResponse.json(
        { error: 'vehicleId, start, and end are required.' },
        { status: 400 }
      );
    }

    const vehicleExists = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
      select: { id: true },
    });

    if (!vehicleExists) {
      return NextResponse.json({ error: 'Vehicle not found.' }, { status: 404 });
    }

    const startDate = new Date(start);
    const endDate = new Date(end);

    if (
      Number.isNaN(startDate.getTime()) ||
      Number.isNaN(endDate.getTime())
    ) {
      return NextResponse.json(
        { error: 'Invalid date format.' },
        { status: 400 }
      );
    }

    if (endDate <= startDate) {
      return NextResponse.json(
        { error: 'End date must be after start date.' },
        { status: 400 }
      );
    }

    const block = await addBlock({
      vehicleId,
      start,
      end,
      reason,
    });

    return NextResponse.json({ block }, { status: 201 });
  } catch (error) {
    console.error('POST /api/vehicle-blocks error:', error);
    return NextResponse.json(
      { error: 'Failed to create block.' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Block id is required.' },
        { status: 400 }
      );
    }

    const deleted = await deleteBlock(Number(id));

    if (!deleted) {
      return NextResponse.json(
        { error: 'Block not found.' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/vehicle-blocks error:', error);
    return NextResponse.json(
      { error: 'Failed to delete block.' },
      { status: 500 }
    );
  }
}