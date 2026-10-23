import type { Frame, Furniture } from './types';

export async function loadFrames(): Promise<Frame[]> {
  const res = await fetch('/catalog/frames.json');
  if (!res.ok) throw new Error(`Failed to load frames: ${res.status}`);
  return res.json();
}

export async function loadFurniture(): Promise<Furniture[]> {
  const res = await fetch('/catalog/furniture.json');
  if (!res.ok) throw new Error(`Failed to load furniture: ${res.status}`);
  return res.json();
}
