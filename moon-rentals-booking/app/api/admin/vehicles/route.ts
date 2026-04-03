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

function parseRequiredInt(value: unknown, fieldName: string) {
  const num = Number(value);

  if (!Number.isFinite(num) || !Number.isInteger(num)) {
    throw new Error(`${fieldName} must be a whole number.`);
  }

  return num;
}

function buildSlug(year: string | number, make: string, model: string) {
  return `${year}-${make}-${model}`
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export async function GET() {
  try {
    const vehicles = await prisma.vehicle.findMany({
      orderBy: [
        { isActive: 'desc' },
        { year: 'desc' },
        { make: 'asc' },
        { model: 'asc' },
      ],
    });

    return NextResponse.json({ vehicles });
  } catch (error) {
    console.error('GET /api/admin/vehicles error:', error);
    return NextResponse.json(
      { error: 'Failed to load vehicles.' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const groupId = normalizeString(body.groupId);
    const year = parseRequiredInt(body.year, 'Year');
    const make = normalizeString(body.make);
    const model = normalizeString(body.model);
    const category = normalizeString(body.category);
    const color = normalizeString(body.color);
    const seats = parseRequiredInt(body.seats, 'Seats');
    const transmission = normalizeString(body.transmission);
    const pricePerDay = parseRequiredInt(body.pricePerDay, 'Price per day');
    const image = normalizeString(body.image);
    const description = normalizeString(body.description);
    const internalNotes = optionalString(body.internalNotes);
    const vin = optionalString(body.vin);
    const licensePlate = optionalString(body.licensePlate);
    const isActive = Boolean(body.isActive);

    let slug = normalizeString(body.slug);
    if (!slug) {
      slug = buildSlug(year, make, model);
    }

    if (
      !groupId ||
      !slug ||
      !make ||
      !model ||
      !category ||
      !color ||
      !transmission ||
      !image ||
      !description
    ) {
      return NextResponse.json(
        { error: 'Please complete all required vehicle fields.' },
        { status: 400 }
      );
    }

    const existingSlug = await prisma.vehicle.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (existingSlug) {
      return NextResponse.json(
        { error: 'A vehicle with that slug already exists.' },
        { status: 409 }
      );
    }

    const vehicle = await prisma.vehicle.create({
      data: {
        groupId,
        slug,
        vin,
        licensePlate,
        year,
        make,
        model,
        category,
        color,
        seats,
        transmission,
        pricePerDay,
        image,
        description,
        internalNotes,
        isActive,
      },
    });

    return NextResponse.json({ vehicle }, { status: 201 });
  } catch (error) {
    console.error('POST /api/admin/vehicles error:', error);

    const message =
      error instanceof Error ? error.message : 'Failed to create vehicle.';

    return NextResponse.json({ error: message }, { status: 500 });
  }
}