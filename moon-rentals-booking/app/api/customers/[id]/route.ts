import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const customerId = Number(id);

    if (!Number.isInteger(customerId) || customerId <= 0) {
      return NextResponse.json(
        { error: 'Invalid customer id.' },
        { status: 400 }
      );
    }

    const body = await req.json();
    const notes = typeof body.notes === 'string' ? body.notes.trim() : '';

    const existingCustomer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: { id: true },
    });

    if (!existingCustomer) {
      return NextResponse.json(
        { error: 'Customer not found.' },
        { status: 404 }
      );
    }

    const updatedCustomer = await prisma.customer.update({
      where: { id: customerId },
      data: {
        notes: notes.length > 0 ? notes : null,
      },
      select: {
        id: true,
        notes: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ customer: updatedCustomer });
  } catch (error) {
    console.error('PATCH /api/customers/[id] error:', error);
    return NextResponse.json(
      { error: 'Failed to update customer notes.' },
      { status: 500 }
    );
  }
}