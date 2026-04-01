import { prisma } from './prisma';

export type Booking = {
  id: number;
  vehicleId: number;
  pickupAt: string;
  returnAt: string;
  fullName: string;
  email: string;
  phone: string;
  status: 'pending' | 'confirmed' | 'cancelled';
  createdAt: string;
};

function mapBooking(booking: {
  id: number;
  vehicleId: number;
  pickupAt: Date;
  returnAt: Date;
  fullName: string;
  email: string;
  phone: string;
  status: string;
  createdAt: Date;
}): Booking {
  return {
    id: booking.id,
    vehicleId: booking.vehicleId,
    pickupAt: booking.pickupAt.toISOString(),
    returnAt: booking.returnAt.toISOString(),
    fullName: booking.fullName,
    email: booking.email,
    phone: booking.phone,
    status: booking.status as Booking['status'],
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
  booking: Omit<Booking, 'id' | 'createdAt'>
): Promise<Booking> {
  const created = await prisma.booking.create({
    data: {
      vehicleId: booking.vehicleId,
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
  status: Booking['status']
): Promise<Booking | null> {
  try {
    const updated = await prisma.booking.update({
      where: { id },
      data: { status },
    });

    return mapBooking(updated);
  } catch (error) {
    console.error(`Error updating booking ${id}:`, error);
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