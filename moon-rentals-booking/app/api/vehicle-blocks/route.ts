import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

type GroupedBlockResponse = {
  key: string;
  groupId: number | null;
  legacy: boolean;
  name: string;
  reason: string;
  start: string;
  end: string;
  createdAt: string;
  updatedAt: string;
  blockIds: number[];
  vehicles: Array<{
    blockId: number;
    vehicleId: number;
    label: string;
  }>;
};

function toVehicleLabel(vehicle: {
  year: number;
  make: string;
  model: string;
}) {
  return `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
}

function normalizeText(value: unknown) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function normalizeDirectVehicleIds(body: Record<string, unknown>): number[] {
  const directIds: number[] = Array.isArray(body.vehicleIds)
    ? body.vehicleIds
        .map((value: unknown) => Number(value))
        .filter((value: number) => Number.isInteger(value) && value > 0)
    : body.vehicleId
      ? [Number(body.vehicleId)].filter(
          (value: number) => Number.isInteger(value) && value > 0
        )
      : [];

  return Array.from(new Set(directIds));
}

async function resolveVehicleSelection(body: Record<string, unknown>) {
  const directIds = normalizeDirectVehicleIds(body);

  const vehicleGroupId =
    body.vehicleGroupId !== undefined && body.vehicleGroupId !== null
      ? Number(body.vehicleGroupId)
      : null;

  if (!vehicleGroupId) {
    return {
      vehicleIds: directIds,
      sourceVehicleGroupName: '',
    };
  }

  const vehicleGroup = await prisma.vehicleGroup.findUnique({
    where: { id: vehicleGroupId },
    include: {
      vehicles: {
        select: {
          vehicleId: true,
        },
      },
    },
  });

  if (!vehicleGroup) {
    throw new Error('Selected vehicle group was not found.');
  }

  const groupVehicleIds = vehicleGroup.vehicles.map((entry) => entry.vehicleId);
  const mergedVehicleIds = Array.from(new Set([...directIds, ...groupVehicleIds]));

  return {
    vehicleIds: mergedVehicleIds,
    sourceVehicleGroupName: vehicleGroup.name,
  };
}

function buildGroupedBlocks(
  groupedBlocks: Array<{
    id: number;
    name: string | null;
    reason: string | null;
    startAt: Date;
    endAt: Date;
    createdAt: Date;
    updatedAt: Date;
    blocks: Array<{
      id: number;
      vehicleId: number;
      vehicle: {
        year: number;
        make: string;
        model: string;
      };
    }>;
  }>,
  legacyBlocks: Array<{
    id: number;
    vehicleId: number;
    startAt: Date;
    endAt: Date;
    reason: string | null;
    createdAt: Date;
    updatedAt: Date;
    vehicle: {
      year: number;
      make: string;
      model: string;
    };
  }>
): GroupedBlockResponse[] {
  const legacyMap = new Map<string, GroupedBlockResponse>();

  for (const block of legacyBlocks) {
    const reason = block.reason ?? '';
    const signature = [
      block.startAt.toISOString(),
      block.endAt.toISOString(),
      reason.trim().toLowerCase(),
    ].join('|');

    const existing = legacyMap.get(signature);

    if (existing) {
      existing.blockIds.push(block.id);
      existing.vehicles.push({
        blockId: block.id,
        vehicleId: block.vehicleId,
        label: toVehicleLabel(block.vehicle),
      });
      continue;
    }

    legacyMap.set(signature, {
      key: `legacy-${signature}`,
      groupId: null,
      legacy: true,
      name: reason.trim() || 'Legacy block',
      reason,
      start: block.startAt.toISOString(),
      end: block.endAt.toISOString(),
      createdAt: block.createdAt.toISOString(),
      updatedAt: block.updatedAt.toISOString(),
      blockIds: [block.id],
      vehicles: [
        {
          blockId: block.id,
          vehicleId: block.vehicleId,
          label: toVehicleLabel(block.vehicle),
        },
      ],
    });
  }

  const grouped: GroupedBlockResponse[] = groupedBlocks.map((group) => ({
    key: `group-${group.id}`,
    groupId: group.id,
    legacy: false,
    name: group.name?.trim() || group.reason?.trim() || `Block Group #${group.id}`,
    reason: group.reason ?? '',
    start: group.startAt.toISOString(),
    end: group.endAt.toISOString(),
    createdAt: group.createdAt.toISOString(),
    updatedAt: group.updatedAt.toISOString(),
    blockIds: group.blocks.map((block) => block.id),
    vehicles: group.blocks
      .map((block) => ({
        blockId: block.id,
        vehicleId: block.vehicleId,
        label: toVehicleLabel(block.vehicle),
      }))
      .sort((a, b) => a.label.localeCompare(b.label)),
  }));

  return [...grouped, ...Array.from(legacyMap.values())].sort(
    (a, b) => new Date(b.start).getTime() - new Date(a.start).getTime()
  );
}

export async function GET() {
  try {
    const [groupedBlocks, legacyBlocks] = await Promise.all([
      prisma.vehicleBlockGroup.findMany({
        orderBy: { startAt: 'desc' },
        include: {
          blocks: {
            include: {
              vehicle: {
                select: {
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
      }),
      prisma.vehicleBlock.findMany({
        where: {
          blockGroupId: null,
        },
        orderBy: {
          startAt: 'desc',
        },
        include: {
          vehicle: {
            select: {
              year: true,
              make: true,
              model: true,
            },
          },
        },
      }),
    ]);

    const blockGroups = buildGroupedBlocks(groupedBlocks, legacyBlocks);

    const blocks = blockGroups.flatMap((group) =>
      group.vehicles.map((vehicle) => ({
        id: vehicle.blockId,
        vehicleId: vehicle.vehicleId,
        start: group.start,
        end: group.end,
        reason: group.reason,
        blockGroupId: group.groupId,
        blockGroupName: group.name,
      }))
    );

    return NextResponse.json({
      blockGroups,
      blocks,
    });
  } catch (error) {
    console.error('GET /api/vehicle-blocks error:', error);
    return NextResponse.json(
      { error: 'Failed to load blocks.' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Record<string, unknown>;

    const blockGroupId =
      body.blockGroupId !== undefined && body.blockGroupId !== null
        ? Number(body.blockGroupId)
        : null;

    const start = body.start;
    const end = body.end;
    const reason = normalizeText(body.reason);
    const requestedName = normalizeText(body.groupName ?? body.name);

    const { vehicleIds, sourceVehicleGroupName } = await resolveVehicleSelection(body);
    const uniqueVehicleIds = Array.from(new Set(vehicleIds));

    if (uniqueVehicleIds.length === 0) {
      return NextResponse.json(
        { error: 'At least one vehicle is required.' },
        { status: 400 }
      );
    }

    const vehicles = await prisma.vehicle.findMany({
      where: {
        id: {
          in: uniqueVehicleIds,
        },
      },
      select: {
        id: true,
      },
    });

    if (vehicles.length !== uniqueVehicleIds.length) {
      return NextResponse.json(
        { error: 'One or more selected vehicles were not found.' },
        { status: 404 }
      );
    }

    if (blockGroupId) {
      const existingGroup = await prisma.vehicleBlockGroup.findUnique({
        where: { id: blockGroupId },
        include: {
          blocks: {
            select: {
              vehicleId: true,
            },
          },
        },
      });

      if (!existingGroup) {
        return NextResponse.json(
          { error: 'Block group not found.' },
          { status: 404 }
        );
      }

      const existingVehicleIds = new Set(
        existingGroup.blocks.map((block) => block.vehicleId)
      );

      const newVehicleIds = uniqueVehicleIds.filter(
        (vehicleId: number) => !existingVehicleIds.has(vehicleId)
      );

      if (newVehicleIds.length === 0) {
        return NextResponse.json(
          { error: 'All selected vehicles are already in this block.' },
          { status: 400 }
        );
      }

      await prisma.vehicleBlock.createMany({
        data: newVehicleIds.map((vehicleId: number) => ({
          vehicleId,
          blockGroupId: existingGroup.id,
          startAt: existingGroup.startAt,
          endAt: existingGroup.endAt,
          reason: existingGroup.reason,
        })),
      });

      const updatedGroup = await prisma.vehicleBlockGroup.findUnique({
        where: { id: existingGroup.id },
        include: {
          blocks: {
            include: {
              vehicle: {
                select: {
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

      return NextResponse.json(
        {
          message: 'Vehicles added to block successfully.',
          blockGroup: updatedGroup,
        },
        { status: 201 }
      );
    }

    if (typeof start !== 'string' || typeof end !== 'string') {
      return NextResponse.json(
        { error: 'start and end are required when creating a new block group.' },
        { status: 400 }
      );
    }

    const startDate = new Date(start);
    const endDate = new Date(end);

    if (
      Number.isNaN(startDate.getTime()) ||
      Number.isNaN(endDate.getTime())
    ) {
      return NextResponse.json(
        { error: 'Invalid date format.' },
        { status: 400 }
      );
    }

    if (endDate <= startDate) {
      return NextResponse.json(
        { error: 'End date must be after start date.' },
        { status: 400 }
      );
    }

    const finalName = requestedName || sourceVehicleGroupName || '';

    const createdGroup = await prisma.$transaction(async (tx) => {
      const group = await tx.vehicleBlockGroup.create({
        data: {
          name: finalName || null,
          reason: reason || null,
          startAt: startDate,
          endAt: endDate,
        },
      });

      await tx.vehicleBlock.createMany({
        data: uniqueVehicleIds.map((vehicleId: number) => ({
          vehicleId,
          blockGroupId: group.id,
          startAt: startDate,
          endAt: endDate,
          reason: reason || null,
        })),
      });

      return tx.vehicleBlockGroup.findUnique({
        where: { id: group.id },
        include: {
          blocks: {
            include: {
              vehicle: {
                select: {
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
    });

    return NextResponse.json(
      {
        message: 'Block group created successfully.',
        blockGroup: createdGroup,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('POST /api/vehicle-blocks error:', error);

    if (error instanceof Error && error.message === 'Selected vehicle group was not found.') {
      return NextResponse.json(
        { error: error.message },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create or update block.' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const groupId = req.nextUrl.searchParams.get('groupId');
    const id = req.nextUrl.searchParams.get('id');

    if (groupId) {
      const numericGroupId = Number(groupId);

      const existingGroup = await prisma.vehicleBlockGroup.findUnique({
        where: { id: numericGroupId },
        select: { id: true },
      });

      if (!existingGroup) {
        return NextResponse.json(
          { error: 'Block group not found.' },
          { status: 404 }
        );
      }

      await prisma.vehicleBlockGroup.delete({
        where: { id: numericGroupId },
      });

      return NextResponse.json({ success: true });
    }

    if (id) {
      const numericId = Number(id);

      const existingBlock = await prisma.vehicleBlock.findUnique({
        where: { id: numericId },
        select: {
          id: true,
          blockGroupId: true,
        },
      });

      if (!existingBlock) {
        return NextResponse.json(
          { error: 'Block not found.' },
          { status: 404 }
        );
      }

      await prisma.vehicleBlock.delete({
        where: { id: numericId },
      });

      if (existingBlock.blockGroupId) {
        const remainingCount = await prisma.vehicleBlock.count({
          where: {
            blockGroupId: existingBlock.blockGroupId,
          },
        });

        if (remainingCount === 0) {
          await prisma.vehicleBlockGroup.delete({
            where: {
              id: existingBlock.blockGroupId,
            },
          });
        }
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { error: 'Either groupId or id is required.' },
      { status: 400 }
    );
  } catch (error) {
    console.error('DELETE /api/vehicle-blocks error:', error);
    return NextResponse.json(
      { error: 'Failed to delete block.' },
      { status: 500 }
    );
  }
}