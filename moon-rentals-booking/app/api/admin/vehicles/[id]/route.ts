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

function parseOptionalInt(value: unknown, fieldName: string) {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const num = Number(value);

  if (!Number.isFinite(num) || !Number.isInteger(num)) {
    throw new Error(`${fieldName} must be a whole number.`);
  }

  return num;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const vehicleId = Number(id);

    if (!Number.isFinite(vehicleId)) {
      return NextResponse.json({ error: 'Invalid vehicle id.' }, { status: 400 });
    }

    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
    });

    if (!vehicle) {
      return NextResponse.json({ error: 'Vehicle not found.' }, { status: 404 });
    }

    return NextResponse.json({ vehicle });
  } catch (error) {
    console.error('GET /api/admin/vehicles/[id] error:', error);
    return NextResponse.json(
      { error: 'Failed to load vehicle.' },
      { status: 500 }
    );
  }
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

    const year = parseOptionalInt(body.year, 'Year');
    const seats = parseOptionalInt(body.seats, 'Seats');
    const pricePerDay = parseOptionalInt(body.pricePerDay, 'Price per day');

    const data: {
      groupId?: string;
      slug?: string;
      vin?: string | null;
      licensePlate?: string | null;
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
      internalNotes?: string | null;
      isActive?: boolean;
    } = {};

    if (body.groupId !== undefined) data.groupId = normalizeString(body.groupId);
    if (body.slug !== undefined) data.slug = normalizeString(body.slug);
    if (body.vin !== undefined) data.vin = optionalString(body.vin);
    if (body.licensePlate !== undefined) {
      data.licensePlate = optionalString(body.licensePlate);
    }
    if (year !== undefined) data.year = year;
    if (body.make !== undefined) data.make = normalizeString(body.make);
    if (body.model !== undefined) data.model = normalizeString(body.model);
    if (body.category !== undefined) {
      data.category = normalizeString(body.category);
    }
    if (body.color !== undefined) data.color = normalizeString(body.color);
    if (seats !== undefined) data.seats = seats;
    if (body.transmission !== undefined) {
      data.transmission = normalizeString(body.transmission);
    }
    if (pricePerDay !== undefined) data.pricePerDay = pricePerDay;
    if (body.image !== undefined) data.image = normalizeString(body.image);
    if (body.description !== undefined) {
      data.description = normalizeString(body.description);
    }
    if (body.internalNotes !== undefined) {
      data.internalNotes = optionalString(body.internalNotes);
    }
    if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);

    const requiredStringFields = [
      ['groupId', data.groupId],
      ['slug', data.slug],
      ['make', data.make],
      ['model', data.model],
      ['category', data.category],
      ['color', data.color],
      ['transmission', data.transmission],
      ['image', data.image],
      ['description', data.description],
    ] as const;

    for (const [fieldName, value] of requiredStringFields) {
      if (value !== undefined && !value) {
        return NextResponse.json(
          { error: `${fieldName} cannot be empty.` },
          { status: 400 }
        );
      }
    }

    if (data.slug) {
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
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const vehicleId = Number(id);
    const hardDelete = req.nextUrl.searchParams.get('hardDelete') === 'true';

    if (!Number.isFinite(vehicleId)) {
      return NextResponse.json({ error: 'Invalid vehicle id.' }, { status: 400 });
    }

    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
      select: {
        id: true,
        isActive: true,
        bookings: {
          select: { id: true },
          take: 1,
        },
        blocks: {
          select: { id: true },
          take: 1,
        },
        savedGroups: {
          select: { id: true },
          take: 1,
        },
      },
    });

    if (!vehicle) {
      return NextResponse.json({ error: 'Vehicle not found.' }, { status: 404 });
    }

    const hasRelatedRecords =
      vehicle.bookings.length > 0 ||
      vehicle.blocks.length > 0 ||
      vehicle.savedGroups.length > 0;

    if (hardDelete && hasRelatedRecords) {
      return NextResponse.json(
        {
          error:
            'Vehicle cannot be permanently deleted because it has related bookings, blocks, or saved group memberships.',
        },
        { status: 409 }
      );
    }

    if (hardDelete) {
      await prisma.vehicle.delete({
        where: { id: vehicleId },
      });

      return NextResponse.json({
        success: true,
        action: 'deleted',
      });
    }

    if (!vehicle.isActive) {
      return NextResponse.json(
        {
          success: true,
          action: 'deactivated',
          message: 'Vehicle is already inactive.',
        },
        { status: 200 }
      );
    }

    const updatedVehicle = await prisma.vehicle.update({
      where: { id: vehicleId },
      data: {
        isActive: false,
      },
    });

    return NextResponse.json({
      success: true,
      action: hasRelatedRecords ? 'deactivated' : 'deactivated',
      message: hasRelatedRecords
        ? 'Vehicle was deactivated instead of deleted because historical records exist.'
        : 'Vehicle was deactivated. Use hardDelete=true only for clean records you want removed permanently.',
      vehicle: updatedVehicle,
    });
  } catch (error) {
    console.error('DELETE /api/admin/vehicles/[id] error:', error);
    return NextResponse.json(
      { error: 'Failed to delete vehicle.' },
      { status: 500 }
    );
  }
}
