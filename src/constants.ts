import { CellData } from './types';

export const CELL_IMAGES: Record<string, string> = {
  '1': '/* REPLACE_WITH_BASE64_FOR_1 */',
  '2': '/* REPLACE_WITH_BASE64_FOR_2 */',
  '3': '/* REPLACE_WITH_BASE64_FOR_3 */',
  '4': '/* REPLACE_WITH_BASE64_FOR_4 */',
  '5': '/* REPLACE_WITH_BASE64_FOR_5 */',
  '6': '/* REPLACE_WITH_BASE64_FOR_6 */',
};

export function createEmptyGrid(): CellData[] {
  return Array(20).fill(null).map(() => ({ color: '.', value: '.' }));
}
