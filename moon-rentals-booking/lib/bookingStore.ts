import fs from 'fs/promises';
import path from 'path';

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

const dataDirPath = path.join(process.cwd(), 'data');
const bookingsFilePath = path.join(dataDirPath, 'bookings.json');

async function ensureBookingsFile() {
  try {
    await fs.mkdir(dataDirPath, { recursive: true });
    await fs.access(bookingsFilePath);
  } catch {
    await fs.writeFile(bookingsFilePath, '[]', 'utf-8');
  }
}

export async function getBookings(): Promise<Booking[]> {
  try {
    await ensureBookingsFile();
    const fileContents = await fs.readFile(bookingsFilePath, 'utf-8');
    return JSON.parse(fileContents) as Booking[];
  } catch (error) {
    console.error('Error reading bookings.json:', error);
    return [];
  }
}

async function saveBookings(bookings: Booking[]): Promise<void> {
  await ensureBookingsFile();
  await fs.writeFile(
    bookingsFilePath,
    JSON.stringify(bookings, null, 2),
    'utf-8'
  );
}

export async function addBooking(
  booking: Omit<Booking, 'id' | 'createdAt'>
): Promise<Booking> {
  const bookings = await getBookings();
  const nextId =
    bookings.length > 0 ? Math.max(...bookings.map((b) => b.id)) + 1 : 1;

  const newBooking: Booking = {
    id: nextId,
    createdAt: new Date().toISOString(),
    ...booking,
  };

  bookings.push(newBooking);
  await saveBookings(bookings);

  return newBooking;
}

export async function updateBookingStatus(
  id: number,
  status: Booking['status']
): Promise<Booking | null> {
  const bookings = await getBookings();
  const index = bookings.findIndex((booking) => booking.id === id);

  if (index === -1) {
    return null;
  }

  bookings[index] = {
    ...bookings[index],
    status,
  };

  await saveBookings(bookings);
  return bookings[index];
}

export async function deleteBooking(id: number): Promise<boolean> {
  const bookings = await getBookings();
  const updatedBookings = bookings.filter((booking) => booking.id !== id);

  if (updatedBookings.length === bookings.length) {
    return false;
  }

  await saveBookings(updatedBookings);
  return true;
}