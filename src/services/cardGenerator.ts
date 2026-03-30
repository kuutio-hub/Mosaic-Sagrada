import { CardData, CellData, Color, Value } from '../types';
import { createEmptyGrid } from '../constants';

interface GeneratorOptions {
  colorCount: number; // How many different colors to use
  coloredCells: number; // How many cells should have a color
  valueCount: number; // How many different values to use (1-6)
  valuedCells: number; // How many cells should have a value
}

const COLORS: Color[] = ['R', 'G', 'B', 'Y', 'P'];
const VALUES: Value[] = ['1', '2', '3', '4', '5', '6'];

export function generateSagradaCard(options: GeneratorOptions): CardData {
  const cells: CellData[] = createEmptyGrid();
  const { colorCount, coloredCells, valueCount, valuedCells } = options;

  // 1. Select colors and values to use
  const selectedColors = [...COLORS].sort(() => Math.random() - 0.5).slice(0, colorCount);
  const selectedValues = [...VALUES].sort(() => Math.random() - 0.5).slice(0, valueCount);

  // 2. Helper to check adjacency
  const isValid = (index: number, type: 'color' | 'value', val: string): boolean => {
    const row = Math.floor(index / 5);
    const col = index % 5;

    const neighbors = [
      index - 5, // Top
      index + 5, // Bottom
      col > 0 ? index - 1 : -1, // Left
      col < 4 ? index + 1 : -1, // Right
    ];

    for (const n of neighbors) {
      if (n >= 0 && n < 20) {
        if (type === 'color' && cells[n].color === val) return false;
        if (type === 'value' && cells[n].value === val) return false;
      }
    }
    return true;
  };

  // 3. Fill colors
  let colorsPlaced = 0;
  let attempts = 0;
  const indices = Array.from({ length: 20 }, (_, i) => i).sort(() => Math.random() - 0.5);

  while (colorsPlaced < coloredCells && attempts < 100) {
    for (const idx of indices) {
      if ((cells[idx].color === 'W' || cells[idx].color === '.') && cells[idx].value === '.') {
        const color = selectedColors[Math.floor(Math.random() * selectedColors.length)];
        if (isValid(idx, 'color', color)) {
          cells[idx].color = color;
          colorsPlaced++;
          if (colorsPlaced >= coloredCells) break;
        }
      }
    }
    attempts++;
  }

  // 4. Fill values
  let valuesPlaced = 0;
  attempts = 0;
  indices.sort(() => Math.random() - 0.5);

  while (valuesPlaced < valuedCells && attempts < 100) {
    for (const idx of indices) {
      // Only place value if cell is empty (no color AND no value)
      // 'W' and '.' are considered empty for color constraints in this context
      if ((cells[idx].color === 'W' || cells[idx].color === '.') && cells[idx].value === '.') {
        const val = selectedValues[Math.floor(Math.random() * selectedValues.length)];
        if (isValid(idx, 'value', val)) {
          cells[idx].value = val;
          valuesPlaced++;
          if (valuesPlaced >= valuedCells) break;
        }
      }
    }
    attempts++;
  }

  // 5. Calculate difficulty (rough estimate based on number of constraints)
  const totalConstraints = coloredCells + valuedCells;
  let difficulty = 3;
  if (totalConstraints <= 8) difficulty = 3;
  else if (totalConstraints <= 10) difficulty = 4;
  else if (totalConstraints <= 12) difficulty = 5;
  else difficulty = 6;

  // Generate a seed-based name
  const seed = Math.random().toString(36).substring(2, 7).toUpperCase();
  const date = new Date();
  const dateStr = `${date.getMonth() + 1}${date.getDate()}`;

  return {
    title: `Gen-${seed}-${dateStr}`,
    difficulty,
    cells,
    code: seed,
    isGenerated: true // Custom flag for UI
  };
}
