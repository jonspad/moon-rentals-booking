export type Blockout = {
  id: number;
  vehicleId: number | null;
  start: string;
  end: string;
  reason: string;
};

let blockouts: Blockout[] = [
  {
    id: 1,
    vehicleId: 7,
    start: '2026-03-29T10:00',
    end: '2026-03-31T10:00',
    reason: 'Manual blockout',
  },
  {
    id: 2,
    vehicleId: 23,
    start: '2026-04-01T09:00',
    end: '2026-04-03T18:00',
    reason: 'Maintenance',
  },
];

export function getBlockouts() {
  return blockouts;
}

export function addBlockout(input: Omit<Blockout, 'id'>) {
  const nextId =
    blockouts.length > 0 ? Math.max(...blockouts.map((b) => b.id)) + 1 : 1;

  const blockout: Blockout = {
    id: nextId,
    ...input,
  };

  blockouts = [blockout, ...blockouts];
  return blockout;
}

export function removeBlockout(id: number) {
  const before = blockouts.length;
  blockouts = blockouts.filter((b) => b.id !== id);
  return blockouts.length < before;
}