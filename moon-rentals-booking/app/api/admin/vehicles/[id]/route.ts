import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

function normalizeString(value: unknown) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function optionalString(value: unknown) {
  const normalized = normalizeString(value);
  return normalized.length ? normalized : null;
}

function parseOptionalInt(value: unknown) {
  if (value === undefined || value === null || value === '') return undefined;

  const num = Number(value);

  if (!Number.isFinite(num) || !Number.isInteger(num)) {
    throw new Error('Numeric fields must be whole numbers.');
  }

  return num;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const vehicleId = Number(id);

    if (!Number.isFinite(vehicleId)) {
      return NextResponse.json({ error: 'Invalid vehicle id.' }, { status: 400 });
    }

    const body = await req.json();

    const data: Record<string, unknown> = {};

    if ('groupId' in body) data.groupId = normalizeString(body.groupId);
    if ('slug' in body) data.slug = normalizeString(body.slug);
    if ('vin' in body) data.vin = optionalString(body.vin);
    if ('licensePlate' in body) data.licensePlate = optionalString(body.licensePlate);
    if ('year' in body) data.year = parseOptionalInt(body.year);
    if ('make' in body) data.make = normalizeString(body.make);
    if ('model' in body) data.model = normalizeString(body.model);
    if ('category' in body) data.category = normalizeString(body.category);
    if ('color' in body) data.color = normalizeString(body.color);
    if ('seats' in body) data.seats = parseOptionalInt(body.seats);
    if ('transmission' in body) data.transmission = normalizeString(body.transmission);
    if ('pricePerDay' in body) data.pricePerDay = parseOptionalInt(body.pricePerDay);
    if ('image' in body) data.image = normalizeString(body.image);
    if ('description' in body) data.description = normalizeString(body.description);
    if ('isActive' in body) data.isActive = Boolean(body.isActive);

    if (typeof data.slug === 'string' && data.slug.length > 0) {
      const existingSlug = await prisma.vehicle.findUnique({
        where: { slug: data.slug },
        select: { id: true },
      });

      if (existingSlug && existingSlug.id !== vehicleId) {
        return NextResponse.json(
          { error: 'Another vehicle already uses that slug.' },
          { status: 409 }
        );
      }
    }

    const vehicle = await prisma.vehicle.update({
      where: { id: vehicleId },
      data,
    });

    return NextResponse.json({ vehicle });
  } catch (error) {
    console.error('PATCH /api/admin/vehicles/[id] error:', error);

    const message =
      error instanceof Error ? error.message : 'Failed to update vehicle.';

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const vehicleId = Number(id);

    if (!Number.isFinite(vehicleId)) {
      return NextResponse.json({ error: 'Invalid vehicle id.' }, { status: 400 });
    }

    await prisma.vehicle.delete({
      where: { id: vehicleId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/admin/vehicles/[id] error:', error);
    return NextResponse.json(
      { error: 'Failed to delete vehicle.' },
      { status: 500 }
    );
  }
}