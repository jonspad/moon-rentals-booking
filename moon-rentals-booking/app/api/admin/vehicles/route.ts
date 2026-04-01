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

function normalizeInt(value: unknown, fieldName: string) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
    throw new Error(`${fieldName} must be a valid whole number.`);
  }

  return parsed;
}

export async function GET() {
  try {
    const vehicles = await prisma.vehicle.findMany({
      orderBy: [{ isActive: 'desc' }, { year: 'desc' }, { make: 'asc' }, { model: 'asc' }],
    });

    return NextResponse.json({ vehicles });
  } catch (error) {
    console.error('Failed to load admin vehicles:', error);
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
    const slug = normalizeString(body.slug).toLowerCase();
    const vin = normalizeNullableString(body.vin);
    const make = normalizeString(body.make);
    const model = normalizeString(body.model);
    const category = normalizeString(body.category);
    const color = normalizeString(body.color);
    const transmission = normalizeString(body.transmission);
    const image = normalizeString(body.image);
    const description = normalizeString(body.description);
    const isActive = normalizeBoolean(body.isActive);

    const year = normalizeInt(body.year, 'Year');
    const seats = normalizeInt(body.seats, 'Seats');
    const pricePerDay = normalizeInt(body.pricePerDay, 'Price per day');

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
        { status: 400 }
      );
    }

    const lastVehicle = await prisma.vehicle.findFirst({
      orderBy: { id: 'desc' },
      select: { id: true },
    });

    const nextId = (lastVehicle?.id ?? 0) + 1;

    const created = await prisma.vehicle.create({
      data: {
        id: nextId,
        groupId,
        slug,
        vin,
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
        isActive,
      },
    });

    return NextResponse.json({ vehicle: created }, { status: 201 });
  } catch (error) {
    console.error('Failed to create vehicle:', error);

    const message =
      error instanceof Error ? error.message : 'Failed to create vehicle.';

    return NextResponse.json({ error: message }, { status: 500 });
  }
}