import fs from 'fs/promises';
import path from 'path';

export type VehicleBlock = {
  id: number;
  vehicleId: number;
  start: string;
  end: string;
  reason: string;
};

const dataDirPath = path.join(process.cwd(), 'data');
const blocksFilePath = path.join(dataDirPath, 'blocks.json');

async function ensureBlocksFile() {
  try {
    await fs.mkdir(dataDirPath, { recursive: true });
    await fs.access(blocksFilePath);
  } catch {
    await fs.writeFile(blocksFilePath, '[]', 'utf-8');
  }
}

export async function getBlocks(): Promise<VehicleBlock[]> {
  try {
    await ensureBlocksFile();
    const fileContents = await fs.readFile(blocksFilePath, 'utf-8');
    return JSON.parse(fileContents) as VehicleBlock[];
  } catch (error) {
    console.error('Error reading blocks.json:', error);
    return [];
  }
}

async function saveBlocks(blocks: VehicleBlock[]): Promise<void> {
  await ensureBlocksFile();
  await fs.writeFile(blocksFilePath, JSON.stringify(blocks, null, 2), 'utf-8');
}

export async function addBlock(
  block: Omit<VehicleBlock, 'id'>
): Promise<VehicleBlock> {
  const blocks = await getBlocks();

  const nextId =
    blocks.length > 0 ? Math.max(...blocks.map((b) => b.id)) + 1 : 1;

  const newBlock: VehicleBlock = {
    id: nextId,
    ...block,
  };

  blocks.push(newBlock);
  await saveBlocks(blocks);

  return newBlock;
}

export async function deleteBlock(id: number): Promise<boolean> {
  const blocks = await getBlocks();
  const updatedBlocks = blocks.filter((block) => block.id !== id);

  if (updatedBlocks.length === blocks.length) {
    return false;
  }

  await saveBlocks(updatedBlocks);
  return true;
}