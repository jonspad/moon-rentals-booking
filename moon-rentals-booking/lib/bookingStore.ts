import { prisma } from './prisma';

export type BookingStatus = 'pending' | 'confirmed' | 'cancelled';

export type Booking = {
  id: number;
  vehicleId: number;
  customerId: number;
  pickupAt: string;
  returnAt: string;
  fullName: string;
  email: string;
  phone: string;
  status: BookingStatus;
  rejectionReason: string | null;
  lastAdminMessageSubject: string | null;
  lastAdminMessageBody: string | null;
  lastAdminMessagedAt: string | null;
  createdAt: string;
};

function mapBooking(booking: {
  id: number;
  vehicleId: number;
  customerId: number;
  pickupAt: Date;
  returnAt: Date;
  fullName: string;
  email: string;
  phone: string;
  status: string;
  rejectionReason: string | null;
  lastAdminMessageSubject: string | null;
  lastAdminMessageBody: string | null;
  lastAdminMessagedAt: Date | null;
  createdAt: Date;
}): Booking {
  return {
    id: booking.id,
    vehicleId: booking.vehicleId,
    customerId: booking.customerId,
    pickupAt: booking.pickupAt.toISOString(),
    returnAt: booking.returnAt.toISOString(),
    fullName: booking.fullName,
    email: booking.email,
    phone: booking.phone,
    status: booking.status as BookingStatus,
    rejectionReason: booking.rejectionReason,
    lastAdminMessageSubject: booking.lastAdminMessageSubject,
    lastAdminMessageBody: booking.lastAdminMessageBody,
    lastAdminMessagedAt: booking.lastAdminMessagedAt
      ? booking.lastAdminMessagedAt.toISOString()
      : null,
    createdAt: booking.createdAt.toISOString(),
  };
}

export async function getBookings(): Promise<Booking[]> {
  try {
    const bookings = await prisma.booking.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return bookings.map(mapBooking);
  } catch (error) {
    console.error('Error reading bookings from database:', error);
    return [];
  }
}

export async function addBooking(
  booking: Omit<
    Booking,
    | 'id'
    | 'createdAt'
    | 'rejectionReason'
    | 'lastAdminMessageSubject'
    | 'lastAdminMessageBody'
    | 'lastAdminMessagedAt'
  >
): Promise<Booking> {
  const created = await prisma.booking.create({
    data: {
      vehicleId: booking.vehicleId,
      customerId: booking.customerId,
      pickupAt: new Date(booking.pickupAt),
      returnAt: new Date(booking.returnAt),
      fullName: booking.fullName,
      email: booking.email,
      phone: booking.phone,
      status: booking.status,
    },
  });

  return mapBooking(created);
}

export async function updateBookingStatus(
  id: number,
  status: BookingStatus,
  options?: { rejectionReason?: string | null }
): Promise<Booking | null> {
  try {
    const rejectionReason =
      status === 'cancelled'
        ? (options?.rejectionReason || '').trim() || null
        : null;

    const updated = await prisma.booking.update({
      where: { id },
      data: {
        status,
        rejectionReason,
      },
    });

    return mapBooking(updated);
  } catch (error) {
    console.error(`Error updating booking ${id}:`, error);
    return null;
  }
}

export async function recordAdminMessage(
  id: number,
  subject: string,
  body: string
): Promise<Booking | null> {
  try {
    const updated = await prisma.booking.update({
      where: { id },
      data: {
        lastAdminMessageSubject: subject.trim(),
        lastAdminMessageBody: body.trim(),
        lastAdminMessagedAt: new Date(),
      },
    });

    return mapBooking(updated);
  } catch (error) {
    console.error(`Error recording admin message for booking ${id}:`, error);
    return null;
  }
}

export async function deleteBooking(id: number): Promise<boolean> {
  try {
    await prisma.booking.delete({
      where: { id },
    });
    return true;
  } catch (error) {
    console.error(`Error deleting booking ${id}:`, error);
    return false;
  }
}