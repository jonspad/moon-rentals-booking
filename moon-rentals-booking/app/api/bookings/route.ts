import { NextRequest, NextResponse } from 'next/server';
import {
  addBooking,
  deleteBooking,
  getBookings,
  updateBookingStatus,
} from '@/lib/bookingStore';
import { getBlocks } from '@/lib/blockStore';
import { prisma } from '@/lib/prisma';
import { sendBookingReceivedEmail } from '@/lib/email';

function isOverlapping(
  requestedStart: Date,
  requestedEnd: Date,
  existingStart: Date,
  existingEnd: Date
) {
  return requestedStart < existingEnd && requestedEnd > existingStart;
}

function getVehicleDisplayName(vehicle: {
  year: number;
  make: string;
  model: string;
  color?: string | null;
}) {
  return `${vehicle.year} ${vehicle.make} ${vehicle.model}${
    vehicle.color ? ` (${vehicle.color})` : ''
  }`;
}

export async function GET() {
  try {
    const bookings = await getBookings();
    return NextResponse.json({ bookings });
  } catch (error) {
    console.error('GET /api/bookings error:', error);
    return NextResponse.json(
      { error: 'Failed to load bookings.' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const vehicleId = Number(body.vehicleId);
    const pickupAt = body.pickupAt;
    const returnAt = body.returnAt;
    const fullName = (body.fullName || '').trim();
    const email = (body.email || '').trim();
    const phone = (body.phone || '').trim();

    if (!vehicleId || !pickupAt || !returnAt || !fullName || !email || !phone) {
      return NextResponse.json(
        {
          error:
            'vehicleId, pickupAt, returnAt, fullName, email, and phone are required.',
        },
        { status: 400 }
      );
    }

    const vehicle = await prisma.vehicle.findFirst({
      where: {
        id: vehicleId,
        isActive: true,
      },
      select: {
        id: true,
        year: true,
        make: true,
        model: true,
        color: true,
      },
    });

    if (!vehicle) {
      return NextResponse.json({ error: 'Vehicle not found.' }, { status: 404 });
    }

    const pickupDate = new Date(pickupAt);
    const returnDate = new Date(returnAt);

    if (
      Number.isNaN(pickupDate.getTime()) ||
      Number.isNaN(returnDate.getTime())
    ) {
      return NextResponse.json(
        { error: 'Invalid date format.' },
        { status: 400 }
      );
    }

    if (returnDate <= pickupDate) {
      return NextResponse.json(
        { error: 'Return date must be after pickup date.' },
        { status: 400 }
      );
    }

    const blocks = await getBlocks();
    const conflictingBlock = blocks.find((block) => {
      if (block.vehicleId !== vehicleId) return false;

      const blockStart = new Date(block.start);
      const blockEnd = new Date(block.end);

      if (
        Number.isNaN(blockStart.getTime()) ||
        Number.isNaN(blockEnd.getTime())
      ) {
        return false;
      }

      return isOverlapping(pickupDate, returnDate, blockStart, blockEnd);
    });

    if (conflictingBlock) {
      return NextResponse.json(
        { error: 'This vehicle is blocked for the selected dates.' },
        { status: 409 }
      );
    }

    const existingBookings = await getBookings();
    const conflictingBooking = existingBookings.find((booking) => {
      if (booking.vehicleId !== vehicleId) return false;
      if (booking.status !== 'confirmed') return false;

      const bookingStart = new Date(booking.pickupAt);
      const bookingEnd = new Date(booking.returnAt);

      if (
        Number.isNaN(bookingStart.getTime()) ||
        Number.isNaN(bookingEnd.getTime())
      ) {
        return false;
      }

      return isOverlapping(pickupDate, returnDate, bookingStart, bookingEnd);
    });

    if (conflictingBooking) {
      return NextResponse.json(
        { error: 'This vehicle is already booked for the selected dates.' },
        { status: 409 }
      );
    }

    const booking = await addBooking({
      vehicleId,
      pickupAt,
      returnAt,
      fullName,
      email,
      phone,
      status: 'pending',
    });

    const vehicleName = getVehicleDisplayName(vehicle);

    await sendBookingReceivedEmail({
      to: email,
      name: fullName,
      vehicle: vehicleName,
      pickupAt,
      returnAt,
      bookingId: booking.id,
    });

    return NextResponse.json({ booking }, { status: 201 });
  } catch (error) {
    console.error('POST /api/bookings error:', error);
    return NextResponse.json(
      { error: 'Failed to create booking.' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();

    const id = Number(body.id);
    const status = body.status;

    if (!id || !status) {
      return NextResponse.json(
        { error: 'Booking id and status are required.' },
        { status: 400 }
      );
    }

    if (!['pending', 'confirmed', 'cancelled'].includes(status)) {
      return NextResponse.json(
        { error: 'Invalid booking status.' },
        { status: 400 }
      );
    }

    const updatedBooking = await updateBookingStatus(id, status);

    if (!updatedBooking) {
      return NextResponse.json(
        { error: 'Booking not found.' },
        { status: 404 }
      );
    }

    return NextResponse.json({ booking: updatedBooking });
  } catch (error) {
    console.error('PATCH /api/bookings error:', error);
    return NextResponse.json(
      { error: 'Failed to update booking status.' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Booking id is required.' },
        { status: 400 }
      );
    }

    const deleted = await deleteBooking(Number(id));

    if (!deleted) {
      return NextResponse.json(
        { error: 'Booking not found.' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/bookings error:', error);
    return NextResponse.json(
      { error: 'Failed to delete booking.' },
      { status: 500 }
    );
  }
}