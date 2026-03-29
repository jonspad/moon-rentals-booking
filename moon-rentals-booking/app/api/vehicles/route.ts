import { NextResponse } from 'next/server';
import { vehicles } from '@/lib/vehicles';

export async function GET() {
  return NextResponse.json({
    vehicles: vehicles.filter((vehicle) => vehicle.isActive),
  });
}