import { prisma } from './prisma';

export type BookingStatus = 'pending' | 'confirmed' | 'cancelled';
export type BookingMessageKind = 'manual' | 'automated' | 'resend';
export type BookingMessageTemplate =
  | 'booking_received'
  | 'booking_approved'
  | 'booking_rejected'
  | 'booking_cancelled'
  | 'guest_message';

export type BookingMessageLog = {
  id: number;
  bookingId: number;
  kind: BookingMessageKind;
  template: BookingMessageTemplate;
  recipientEmail: string;
  subject: string;
  body: string;
  sentAt: string;
  createdAt: string;
};

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
  pricePerDaySnapshot: number;
  totalDaysSnapshot: number;
  totalPriceSnapshot: number;
  rejectionReason: string | null;
  lastAdminMessageSubject: string | null;
  lastAdminMessageBody: string | null;
  lastAdminMessagedAt: string | null;
  createdAt: string;
};

type BookingRecord = {
  id: number;
  vehicleId: number;
  customerId: number;
  pickupAt: Date;
  returnAt: Date;
  fullName: string;
  email: string;
  phone: string;
  status: string;
  pricePerDaySnapshot: number;
  totalDaysSnapshot: number;
  totalPriceSnapshot: number;
  rejectionReason: string | null;
  lastAdminMessageSubject: string | null;
  lastAdminMessageBody: string | null;
  lastAdminMessagedAt: Date | null;
  createdAt: Date;
};

function mapBooking(booking: BookingRecord): Booking {
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
    pricePerDaySnapshot: booking.pricePerDaySnapshot,
    totalDaysSnapshot: booking.totalDaysSnapshot,
    totalPriceSnapshot: booking.totalPriceSnapshot,
    rejectionReason: booking.rejectionReason,
    lastAdminMessageSubject: booking.lastAdminMessageSubject,
    lastAdminMessageBody: booking.lastAdminMessageBody,
    lastAdminMessagedAt: booking.lastAdminMessagedAt
      ? booking.lastAdminMessagedAt.toISOString()
      : null,
    createdAt: booking.createdAt.toISOString(),
  };
}

function mapBookingMessageLog(log: {
  id: number;
  bookingId: number;
  kind: string;
  template: string;
  recipientEmail: string;
  subject: string;
  body: string;
  sentAt: Date;
  createdAt: Date;
}): BookingMessageLog {
  return {
    id: log.id,
    bookingId: log.bookingId,
    kind: log.kind as BookingMessageKind,
    template: log.template as BookingMessageTemplate,
    recipientEmail: log.recipientEmail,
    subject: log.subject,
    body: log.body,
    sentAt: log.sentAt.toISOString(),
    createdAt: log.createdAt.toISOString(),
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
      pricePerDaySnapshot: booking.pricePerDaySnapshot,
      totalDaysSnapshot: booking.totalDaysSnapshot,
      totalPriceSnapshot: booking.totalPriceSnapshot,
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

export async function recordBookingMessageLog(input: {
  bookingId: number;
  kind: BookingMessageKind;
  template: BookingMessageTemplate;
  recipientEmail: string;
  subject: string;
  body: string;
  updateLastAdminMessage?: boolean;
}): Promise<BookingMessageLog | null> {
  try {
    const now = new Date();

    const created = await prisma.bookingMessageLog.create({
      data: {
        bookingId: input.bookingId,
        kind: input.kind,
        template: input.template,
        recipientEmail: input.recipientEmail.trim().toLowerCase(),
        subject: input.subject.trim(),
        body: input.body.trim(),
        sentAt: now,
      },
    });

    if (input.updateLastAdminMessage) {
      await prisma.booking.update({
        where: { id: input.bookingId },
        data: {
          lastAdminMessageSubject: input.subject.trim(),
          lastAdminMessageBody: input.body.trim(),
          lastAdminMessagedAt: now,
        },
      });
    }

    return mapBookingMessageLog(created);
  } catch (error) {
    console.error(
      `Error recording booking message log for booking ${input.bookingId}:`,
      error
    );
    return null;
  }
}

export async function getBookingMessageLogById(
  id: number
): Promise<
  | (BookingMessageLog & {
      booking: Booking;
    })
  | null
> {
  try {
    const log = await prisma.bookingMessageLog.findUnique({
      where: { id },
      include: {
        booking: true,
      },
    });

    if (!log) {
      return null;
    }

    return {
      ...mapBookingMessageLog(log),
      booking: mapBooking(log.booking),
    };
  } catch (error) {
    console.error(`Error fetching booking message log ${id}:`, error);
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
