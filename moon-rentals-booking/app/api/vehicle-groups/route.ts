import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

function normalizeText(value: unknown) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function toVehicleLabel(vehicle: {
  year: number;
  make: string;
  model: string;
}) {
  return `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
}

function normalizeVehicleIds(
  vehicleIds: unknown,
  vehicleId: unknown
): number[] {
  const list: number[] = Array.isArray(vehicleIds)
    ? vehicleIds
        .map((value: unknown) => Number(value))
        .filter((value: number) => Number.isInteger(value) && value > 0)
    : vehicleId
      ? [Number(vehicleId)].filter(
          (value: number) => Number.isInteger(value) && value > 0
        )
      : [];

  return Array.from(new Set(list));
}

export async function GET() {
  try {
    const vehicleGroups = await prisma.vehicleGroup.findMany({
      orderBy: { name: 'asc' },
      include: {
        vehicles: {
          include: {
            vehicle: {
              select: {
                id: true,
                year: true,
                make: true,
                model: true,
              },
            },
          },
          orderBy: {
            vehicleId: 'asc',
          },
        },
      },
    });

    return NextResponse.json({
      vehicleGroups: vehicleGroups.map((group) => ({
        id: group.id,
        name: group.name,
        description: group.description ?? '',
        isActive: group.isActive,
        createdAt: group.createdAt.toISOString(),
        updatedAt: group.updatedAt.toISOString(),
        vehicles: group.vehicles
          .map((entry) => ({
            vehicleId: entry.vehicleId,
            label: toVehicleLabel(entry.vehicle),
          }))
          .sort((a, b) => a.label.localeCompare(b.label)),
      })),
    });
  } catch (error) {
    console.error('GET /api/vehicle-groups error:', error);
    return NextResponse.json(
      { error: 'Failed to load vehicle groups.' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const vehicleGroupId =
      body.vehicleGroupId !== undefined && body.vehicleGroupId !== null
        ? Number(body.vehicleGroupId)
        : null;

    const name = normalizeText(body.name);
    const description = normalizeText(body.description);
    const vehicleIds = normalizeVehicleIds(body.vehicleIds, body.vehicleId);

    if (vehicleIds.length === 0) {
      return NextResponse.json(
        { error: 'At least one vehicle is required.' },
        { status: 400 }
      );
    }

    const vehicles = await prisma.vehicle.findMany({
      where: {
        id: {
          in: vehicleIds,
        },
      },
      select: {
        id: true,
      },
    });

    if (vehicles.length !== vehicleIds.length) {
      return NextResponse.json(
        { error: 'One or more selected vehicles were not found.' },
        { status: 404 }
      );
    }

    if (vehicleGroupId) {
      const existingGroup = await prisma.vehicleGroup.findUnique({
        where: { id: vehicleGroupId },
        include: {
          vehicles: {
            select: {
              vehicleId: true,
            },
          },
        },
      });

      if (!existingGroup) {
        return NextResponse.json(
          { error: 'Vehicle group not found.' },
          { status: 404 }
        );
      }

      const existingVehicleIds = new Set(
        existingGroup.vehicles.map((entry) => entry.vehicleId)
      );

      const newVehicleIds = vehicleIds.filter(
        (id: number) => !existingVehicleIds.has(id)
      );

      if (newVehicleIds.length === 0) {
        return NextResponse.json(
          { error: 'All selected vehicles are already in this group.' },
          { status: 400 }
        );
      }

      await prisma.vehicleGroupVehicle.createMany({
        data: newVehicleIds.map((id: number) => ({
          vehicleGroupId: existingGroup.id,
          vehicleId: id,
        })),
      });

      return NextResponse.json(
        { message: 'Vehicles added to vehicle group successfully.' },
        { status: 201 }
      );
    }

    if (!name) {
      return NextResponse.json(
        { error: 'Group name is required.' },
        { status: 400 }
      );
    }

    const createdGroup = await prisma.$transaction(async (tx) => {
      const group = await tx.vehicleGroup.create({
        data: {
          name,
          description: description || null,
        },
      });

      await tx.vehicleGroupVehicle.createMany({
        data: vehicleIds.map((id: number) => ({
          vehicleGroupId: group.id,
          vehicleId: id,
        })),
      });

      return tx.vehicleGroup.findUnique({
        where: { id: group.id },
        include: {
          vehicles: {
            include: {
              vehicle: {
                select: {
                  id: true,
                  year: true,
                  make: true,
                  model: true,
                },
              },
            },
          },
        },
      });
    });

    return NextResponse.json(
      {
        message: 'Vehicle group created successfully.',
        vehicleGroup: createdGroup,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('POST /api/vehicle-groups error:', error);
    return NextResponse.json(
      { error: 'Failed to save vehicle group.' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const groupId = req.nextUrl.searchParams.get('groupId');
    const vehicleId = req.nextUrl.searchParams.get('vehicleId');

    if (!groupId) {
      return NextResponse.json(
        { error: 'groupId is required.' },
        { status: 400 }
      );
    }

    const numericGroupId = Number(groupId);

    if (vehicleId) {
      const numericVehicleId = Number(vehicleId);

      const existingMembership = await prisma.vehicleGroupVehicle.findUnique({
        where: {
          vehicleGroupId_vehicleId: {
            vehicleGroupId: numericGroupId,
            vehicleId: numericVehicleId,
          },
        },
      });

      if (!existingMembership) {
        return NextResponse.json(
          { error: 'Vehicle is not in this group.' },
          { status: 404 }
        );
      }

      await prisma.vehicleGroupVehicle.delete({
        where: {
          vehicleGroupId_vehicleId: {
            vehicleGroupId: numericGroupId,
            vehicleId: numericVehicleId,
          },
        },
      });

      return NextResponse.json({ success: true });
    }

    const existingGroup = await prisma.vehicleGroup.findUnique({
      where: { id: numericGroupId },
      select: { id: true },
    });

    if (!existingGroup) {
      return NextResponse.json(
        { error: 'Vehicle group not found.' },
        { status: 404 }
      );
    }

    await prisma.vehicleGroup.delete({
      where: { id: numericGroupId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/vehicle-groups error:', error);
    return NextResponse.json(
      { error: 'Failed to delete vehicle group.' },
      { status: 500 }
    );
  }
}