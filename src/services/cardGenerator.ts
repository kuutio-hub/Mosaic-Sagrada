import { createEmptyGrid } from '../constants';

const COLORS = ['R', 'G', 'B', 'Y', 'P'];
const VALUES = ['1', '2', '3', '4', '5', '6'];

export function generateSagradaCard(options: any) {
  const cells = createEmptyGrid();
  const { colorCount, coloredCells: rawColoredCells, valueCount, valuedCells: rawValuedCells, symmetric = false, horizontalSymmetry = false, verticalSymmetry = false } = options;

  // Ensure total constraints do not exceed 20
  let coloredCells = rawColoredCells;
  let valuedCells = rawValuedCells;
  if (coloredCells + valuedCells > 20) {
    const ratio = coloredCells / (coloredCells + valuedCells);
    coloredCells = Math.floor(20 * ratio);
    valuedCells = 20 - coloredCells;
  }

  const selectedColors = [...COLORS].sort(() => Math.random() - 0.5).slice(0, colorCount);
  const selectedValues = [...VALUES].sort(() => Math.random() - 0.5).slice(0, valueCount);

  const isValid = (index: number, type: 'color' | 'value', val: string) => {
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
    if (cells[idx].color === '.' && cells[idx].value === '.') {
      const color = selectedColors[Math.floor(Math.random() * selectedColors.length)];
      
      const symIndices = getSymmetricIndices(idx);
      
      // Check if idx and all symIndices are valid
      const targetIndices = [idx, ...symIndices];
      let allValid = true;
      
      // First check if all are currently empty
      for (const t of targetIndices) {
        if (cells[t].color !== '.' || cells[t].value !== '.') {
          allValid = false;
          break;
        }
      }
      
      if (allValid) {
        // Then check if any target index is adjacent to another target index (orthogonally)
        for (let a = 0; a < targetIndices.length; a++) {
          for (let b = a + 1; b < targetIndices.length; b++) {
            const idxA = targetIndices[a];
            const idxB = targetIndices[b];
            const colA = idxA % 5;
            const colB = idxB % 5;
            const rowA = Math.floor(idxA / 5);
            const rowB = Math.floor(idxB / 5);
            
            const isAdj = (Math.abs(rowA - rowB) === 1 && colA === colB) || (Math.abs(colA - colB) === 1 && rowA === rowB);
            if (isAdj) {
              allValid = false;
              break;
            }
          }
          if (!allValid) break;
        }
      }
      
      if (allValid) {
        // Finally check if they are valid against existing cells
        for (const t of targetIndices) {
          if (!isValid(t, 'color', color)) {
            allValid = false;
            break;
          }
        }
      }
      
      if (allValid) {
        for (const t of targetIndices) {
          cells[t].color = color;
          colorsPlaced++;
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
    if (cells[idx].value === '.' && cells[idx].color === '.') {
      const val = selectedValues[Math.floor(Math.random() * selectedValues.length)];
      
      const symIndices = getSymmetricIndices(idx);
      
      // Check if idx and all symIndices are valid
      const targetIndices = [idx, ...symIndices];
      let allValid = true;
      
      // First check if all are currently empty
      for (const t of targetIndices) {
        if (cells[t].value !== '.' || cells[t].color !== '.') {
          allValid = false;
          break;
        }
      }
      
      if (allValid) {
        // Then check if any target index is adjacent to another target index (orthogonally)
        for (let a = 0; a < targetIndices.length; a++) {
          for (let b = a + 1; b < targetIndices.length; b++) {
            const idxA = targetIndices[a];
            const idxB = targetIndices[b];
            const colA = idxA % 5;
            const colB = idxB % 5;
            const rowA = Math.floor(idxA / 5);
            const rowB = Math.floor(idxB / 5);
            
            const isAdj = (Math.abs(rowA - rowB) === 1 && colA === colB) || (Math.abs(colA - colB) === 1 && rowA === rowB);
            if (isAdj) {
              allValid = false;
              break;
            }
          }
          if (!allValid) break;
        }
      }
      
      if (allValid) {
        // Finally check if they are valid against existing cells
        for (const t of targetIndices) {
          if (!isValid(t, 'value', val)) {
            allValid = false;
            break;
          }
        }
      }
      
      if (allValid) {
        for (const t of targetIndices) {
          cells[t].value = val;
          valuesPlaced++;
        }
      }
    }
  }

  const totalConstraints = coloredCells + valuedCells;
  let difficulty = 3;
  if (totalConstraints <= 8) difficulty = 3;
  else if (totalConstraints <= 10) difficulty = 4;
  else if (totalConstraints <= 12) difficulty = 5;
  else difficulty = 6;

  const shortId = Math.random().toString(36).substring(2, 8).toUpperCase();

  return {
    title: `Gen-${shortId}`,
    difficulty,
    cells,
    code: '',
    isGenerated: true
  };
}
