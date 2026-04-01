import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const vehicles = await prisma.vehicle.findMany({
      where: { isActive: true },
      orderBy: [
        { make: 'asc' },
        { model: 'asc' },
        { year: 'desc' },
        { color: 'asc' },
      ],
    });

    return NextResponse.json({ vehicles });
  } catch (error) {
    console.error('Failed to load vehicles:', error);
    return NextResponse.json(
      { error: 'Failed to load vehicles.' },
      { status: 500 }
    );
  }
}