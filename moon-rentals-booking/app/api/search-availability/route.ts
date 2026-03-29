import { NextRequest, NextResponse } from 'next/server';
import { vehicles } from '@/lib/vehicles';
import { getBlocks } from '@/lib/blockStore';

function isOverlapping(
  requestedStart: Date,
  requestedEnd: Date,
  existingStart: Date,
  existingEnd: Date
) {
  return requestedStart < existingEnd && requestedEnd > existingStart;
}

export async function POST(req: NextRequest) {
  try {
    const { pickupAt, returnAt } = await req.json();

    if (!pickupAt || !returnAt) {
      return NextResponse.json(
        { error: 'Pickup and return dates are required.' },
        { status: 400 }
      );
    }

    const pickup = new Date(pickupAt);
    const dropoff = new Date(returnAt);

    if (Number.isNaN(pickup.getTime()) || Number.isNaN(dropoff.getTime())) {
      return NextResponse.json(
        { error: 'Invalid date format.' },
        { status: 400 }
      );
    }

    if (dropoff <= pickup) {
      return NextResponse.json(
        { error: 'Return date must be after pickup date.' },
        { status: 400 }
      );
    }

    const blocks = await getBlocks();

    const availableVehicles = vehicles.filter((vehicle) => {
      if (!vehicle.isActive) return false;

      const vehicleBlocks = blocks.filter((block) => block.vehicleId === vehicle.id);

      const isBlocked = vehicleBlocks.some((block) => {
        const blockStart = new Date(block.start);
        const blockEnd = new Date(block.end);

        if (Number.isNaN(blockStart.getTime()) || Number.isNaN(blockEnd.getTime())) {
          return false;
        }

        return isOverlapping(pickup, dropoff, blockStart, blockEnd);
      });

      return !isBlocked;
    });

    return NextResponse.json({
      vehicles: availableVehicles,
      count: availableVehicles.length,
    });
  } catch (error) {
    console.error('search-availability error:', error);
    return NextResponse.json({ error: 'Server error.' }, { status: 500 });
  }
}