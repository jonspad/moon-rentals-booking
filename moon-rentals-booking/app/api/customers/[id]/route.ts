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

    const fullName =
      typeof body.fullName === 'string' ? body.fullName.trim() : undefined;
    const email =
      typeof body.email === 'string' ? body.email.trim().toLowerCase() : undefined;
    const phone = typeof body.phone === 'string' ? body.phone.trim() : undefined;
    const notes = typeof body.notes === 'string' ? body.notes.trim() : undefined;

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

    const updateData: {
      fullName?: string;
      email?: string;
      phone?: string;
      notes?: string | null;
    } = {};

    if (fullName !== undefined) {
      if (!fullName) {
        return NextResponse.json(
          { error: 'Full name is required.' },
          { status: 400 }
        );
      }
      updateData.fullName = fullName;
    }

    if (email !== undefined) {
      if (!email) {
        return NextResponse.json(
          { error: 'Email is required.' },
          { status: 400 }
        );
      }
      updateData.email = email;
    }

    if (phone !== undefined) {
      if (!phone) {
        return NextResponse.json(
          { error: 'Phone is required.' },
          { status: 400 }
        );
      }
      updateData.phone = phone;
    }

    if (notes !== undefined) {
      updateData.notes = notes.length > 0 ? notes : null;
    }

    const result = await prisma.$transaction(async (tx) => {
      const updatedCustomer = await tx.customer.update({
        where: { id: customerId },
        data: updateData,
        select: {
          id: true,
          fullName: true,
          email: true,
          phone: true,
          notes: true,
          updatedAt: true,
        },
      });

      const bookingSnapshotUpdate: {
        fullName?: string;
        email?: string;
        phone?: string;
      } = {};

      if (updateData.fullName !== undefined) {
        bookingSnapshotUpdate.fullName = updateData.fullName;
      }
      if (updateData.email !== undefined) {
        bookingSnapshotUpdate.email = updateData.email;
      }
      if (updateData.phone !== undefined) {
        bookingSnapshotUpdate.phone = updateData.phone;
      }

      if (Object.keys(bookingSnapshotUpdate).length > 0) {
        await tx.booking.updateMany({
          where: {
            customerId,
            status: 'pending',
          },
          data: bookingSnapshotUpdate,
        });
      }

      return updatedCustomer;
    });

    return NextResponse.json({ customer: result });
  } catch (error: unknown) {
    console.error('PATCH /api/customers/[id] error:', error);

    const prismaLikeError = error as { code?: string };

    if (prismaLikeError?.code === 'P2002') {
      return NextResponse.json(
        { error: 'That email address is already in use by another customer.' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to update customer.' },
      { status: 500 }
    );
  }
}
