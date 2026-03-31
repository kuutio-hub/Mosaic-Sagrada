import { CardData, CellData, Color, Value } from '../types';
import { createEmptyGrid } from '../constants';

interface GeneratorOptions {
  colorCount: number;
  coloredCells: number;
  valueCount: number;
  valuedCells: number;
  symmetric?: boolean;
  horizontalSymmetry?: boolean;
  verticalSymmetry?: boolean;
}

const COLORS: Color[] = ['R', 'G', 'B', 'Y', 'P'];
const VALUES: Value[] = ['1', '2', '3', '4', '5', '6'];

export function generateSagradaCard(options: GeneratorOptions): CardData {
  const cells: CellData[] = createEmptyGrid();
  const { colorCount, coloredCells, valueCount, valuedCells, symmetric = false, horizontalSymmetry = false, verticalSymmetry = false } = options;

  const selectedColors = [...COLORS].sort(() => Math.random() - 0.5).slice(0, colorCount);
  const selectedValues = [...VALUES].sort(() => Math.random() - 0.5).slice(0, valueCount);

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

  const getSymmetricIndices = (index: number) => {
    const row = Math.floor(index / 5);
    const col = index % 5;
    const syms = new Set<number>();
    
    if (symmetric || horizontalSymmetry) {
      syms.add(row * 5 + (4 - col)); // Horizontal symmetry
    }
    if (verticalSymmetry) {
      syms.add((3 - row) * 5 + col); // Vertical symmetry
    }
    if ((symmetric || horizontalSymmetry) && verticalSymmetry) {
      syms.add((3 - row) * 5 + (4 - col)); // Both
    }
    
    return Array.from(syms).filter(i => i !== index);
  };

  const indices = Array.from({ length: 20 }, (_, i) => i).sort(() => Math.random() - 0.5);

  // Fill colors
  let colorsPlaced = 0;
  for (const idx of indices) {
    if (colorsPlaced >= coloredCells) break;
    if (cells[idx].color === 'W' && cells[idx].value === '.') {
      const color = selectedColors[Math.floor(Math.random() * selectedColors.length)];
      if (isValid(idx, 'color', color)) {
        cells[idx].color = color;
        colorsPlaced++;
        
        if (symmetric || horizontalSymmetry || verticalSymmetry) {
          const symIndices = getSymmetricIndices(idx);
          for (const symIdx of symIndices) {
            if (colorsPlaced < coloredCells && cells[symIdx].color === 'W' && cells[symIdx].value === '.' && isValid(symIdx, 'color', color)) {
              cells[symIdx].color = color;
              colorsPlaced++;
            }
          }
        }
      }
    }
  }

  // Fill values
  let valuesPlaced = 0;
  const shuffledIndices = [...indices].sort(() => Math.random() - 0.5);
  for (const idx of shuffledIndices) {
    if (valuesPlaced >= valuedCells) break;
    // A cell can only have a color OR a value, not both
    if (cells[idx].value === '.' && cells[idx].color === 'W') {
      const val = selectedValues[Math.floor(Math.random() * selectedValues.length)];
      if (isValid(idx, 'value', val)) {
        cells[idx].value = val;
        valuesPlaced++;

        if (symmetric || horizontalSymmetry || verticalSymmetry) {
          const symIndices = getSymmetricIndices(idx);
          for (const symIdx of symIndices) {
            if (valuesPlaced < valuedCells && cells[symIdx].value === '.' && cells[symIdx].color === 'W' && isValid(symIdx, 'value', val)) {
              cells[symIdx].value = val;
              valuesPlaced++;
            }
          }
        }
      }
    }
  }

  // 5. Calculate difficulty (rough estimate based on number of constraints)
  const totalConstraints = coloredCells + valuedCells;
  let difficulty = 3;
  if (totalConstraints <= 8) difficulty = 3;
  else if (totalConstraints <= 10) difficulty = 4;
  else if (totalConstraints <= 12) difficulty = 5;
  else difficulty = 6;

  // Generate a date-based name
  const date = new Date();
  const dateStr = date.toISOString().replace(/[-:T]/g, '').slice(0, 14);

  return {
    title: `Gen-${dateStr}`,
    difficulty,
    cells,
    code: '', // Remove seed from code as it's not reproducible
    isGenerated: true // Custom flag for UI
  };
}
