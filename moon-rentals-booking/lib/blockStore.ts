import { prisma } from './prisma';

export type VehicleBlock = {
  id: number;
  vehicleId: number;
  start: string;
  end: string;
  reason: string;
};

function mapBlock(block: {
  id: number;
  vehicleId: number;
  startAt: Date;
  endAt: Date;
  reason: string | null;
}): VehicleBlock {
  return {
    id: block.id,
    vehicleId: block.vehicleId,
    start: block.startAt.toISOString(),
    end: block.endAt.toISOString(),
    reason: block.reason ?? '',
  };
}

export async function getBlocks(): Promise<VehicleBlock[]> {
  try {
    const blocks = await prisma.vehicleBlock.findMany({
      orderBy: { startAt: 'asc' },
    });

    return blocks.map(mapBlock);
  } catch (error) {
    console.error('Error reading blocks from database:', error);
    return [];
  }
}

export async function addBlock(
  block: Omit<VehicleBlock, 'id'>
): Promise<VehicleBlock> {
  const created = await prisma.vehicleBlock.create({
    data: {
      vehicleId: block.vehicleId,
      startAt: new Date(block.start),
      endAt: new Date(block.end),
      reason: block.reason || '',
    },
  });

  return mapBlock(created);
}

export async function deleteBlock(id: number): Promise<boolean> {
  try {
    await prisma.vehicleBlock.delete({
      where: { id },
    });

    return true;
  } catch (error) {
    console.error(`Error deleting block ${id}:`, error);
    return false;
  }
}