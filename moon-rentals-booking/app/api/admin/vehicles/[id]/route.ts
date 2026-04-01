import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

function normalizeString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeNullableString(value: unknown) {
  const normalized = normalizeString(value);
  return normalized === '' ? null : normalized;
}

function normalizeBoolean(value: unknown) {
  return value === true || value === 'true';
}

function normalizeOptionalInt(value: unknown, fieldName: string) {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
    throw new Error(`${fieldName} must be a valid whole number.`);
  }

  return parsed;
}

function parseVehicleId(value: string) {
  const id = Number(value);

  if (!Number.isFinite(id) || !Number.isInteger(id)) {
    throw new Error('Invalid vehicle id.');
  }

  return id;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const vehicleId = parseVehicleId(id);

    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
    });

    if (!vehicle) {
      return NextResponse.json(
        { error: 'Vehicle not found.' },
        { status: 404 }
      );
    }

    return NextResponse.json({ vehicle });
  } catch (error) {
    console.error('Failed to load vehicle:', error);

    const message =
      error instanceof Error ? error.message : 'Failed to load vehicle.';

    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const vehicleId = parseVehicleId(id);
    const body = await req.json();

    const existingVehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
    });

    if (!existingVehicle) {
      return NextResponse.json(
        { error: 'Vehicle not found.' },
        { status: 404 }
      );
    }

    const data: {
      groupId?: string;
      slug?: string;
      vin?: string | null;
      year?: number;
      make?: string;
      model?: string;
      category?: string;
      color?: string;
      seats?: number;
      transmission?: string;
      pricePerDay?: number;
      image?: string;
      description?: string;
      isActive?: boolean;
    } = {};

    if ('groupId' in body) data.groupId = normalizeString(body.groupId);
    if ('slug' in body) data.slug = normalizeString(body.slug).toLowerCase();
    if ('vin' in body) data.vin = normalizeNullableString(body.vin);
    if ('make' in body) data.make = normalizeString(body.make);
    if ('model' in body) data.model = normalizeString(body.model);
    if ('category' in body) data.category = normalizeString(body.category);
    if ('color' in body) data.color = normalizeString(body.color);
    if ('transmission' in body) {
      data.transmission = normalizeString(body.transmission);
    }
    if ('image' in body) data.image = normalizeString(body.image);
    if ('description' in body) {
      data.description = normalizeString(body.description);
    }
    if ('isActive' in body) data.isActive = normalizeBoolean(body.isActive);

    const year = normalizeOptionalInt(body.year, 'Year');
    const seats = normalizeOptionalInt(body.seats, 'Seats');
    const pricePerDay = normalizeOptionalInt(body.pricePerDay, 'Price per day');

    if (year !== undefined) data.year = year;
    if (seats !== undefined) data.seats = seats;
    if (pricePerDay !== undefined) data.pricePerDay = pricePerDay;

    if (data.slug && data.slug !== existingVehicle.slug) {
      const duplicateSlug = await prisma.vehicle.findUnique({
        where: { slug: data.slug },
        select: { id: true },
      });

      if (duplicateSlug) {
        return NextResponse.json(
          { error: 'Another vehicle already uses that slug.' },
          { status: 400 }
        );
      }
    }

    const updated = await prisma.vehicle.update({
      where: { id: vehicleId },
      data,
    });

    return NextResponse.json({ vehicle: updated });
  } catch (error) {
    console.error('Failed to update vehicle:', error);

    const message =
      error instanceof Error ? error.message : 'Failed to update vehicle.';

    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const vehicleId = parseVehicleId(id);

    const bookingCount = await prisma.booking.count({
      where: { vehicleId },
    });

    const blockCount = await prisma.vehicleBlock.count({
      where: { vehicleId },
    });

    if (bookingCount > 0 || blockCount > 0) {
      return NextResponse.json(
        {
          error:
            'This vehicle has related bookings or blocks. Set it inactive instead of deleting it.',
        },
        { status: 400 }
      );
    }

    await prisma.vehicle.delete({
      where: { id: vehicleId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete vehicle:', error);

    const message =
      error instanceof Error ? error.message : 'Failed to delete vehicle.';

    return NextResponse.json({ error: message }, { status: 400 });
  }
}