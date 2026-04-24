import { createEmptyGrid } from '../constants';

const COLORS = ['R', 'G', 'B', 'Y', 'P'];
const VALUES = ['1', '2', '3', '4', '5', '6'];

interface Cell {
  color: string;
  value: string;
}

export function calculateDifficulty(cells: Cell[]) {
  const constraints = cells.filter(c => c.color !== '.' || c.value !== '.');
  const count = constraints.length;
  
  if (count === 0) return 1;

  // Manual difficulty dots mapping (closer to 1-6 range)
  let baseDiff = 1;
  if (count <= 4) baseDiff = 1;
  else if (count <= 7) baseDiff = 2;
  else if (count <= 10) baseDiff = 3;
  else if (count <= 12) baseDiff = 4;
  else if (count <= 14) baseDiff = 5;
  else baseDiff = 6;
  
  // Penalty for clusters (connected constraints make it harder)
  let clusterFactor = 0;
  for (let i = 0; i < 20; i++) {
    if (cells[i].color === '.' && cells[i].value === '.') continue;
    
    const col = i % 5;
    const neighbors = [
      i - 5, i + 5,
      col > 0 ? i - 1 : -1,
      col < 4 ? i + 1 : -1
    ];
    
    for (const n of neighbors) {
      if (n >= 0 && n < 20 && (cells[n].color !== '.' || cells[n].value !== '.')) {
        clusterFactor += 0.15;
      }
    }
  }

  // The cluster factor adds a little bit to the base difficulty
  const finalDiff = Math.min(6, Math.max(1, Math.round(baseDiff + (clusterFactor / 10))));
  return finalDiff;
}

export function generateSagradaCard(options: any) {
  const cells = createEmptyGrid();
  const { 
    colorCount = 5, 
    coloredCells = 6, 
    valueCount = 6, 
    valuedCells = 6, 
    symmetric = false, 
    horizontalSymmetry = false, 
    verticalSymmetry = false,
    strictRules = true 
  } = options;

  let actualColored = Math.min(20, coloredCells);
  let actualValued = Math.min(20 - actualColored, valuedCells);

  const selectedColors = [...COLORS].sort(() => Math.random() - 0.5).slice(0, colorCount);
  const selectedValues = [...VALUES].sort(() => Math.random() - 0.5).slice(0, valueCount);

  const isValid = (index: number, type: 'color' | 'value', val: string) => {
    if (!strictRules) return true;
    
    const col = index % 5;
    const neighbors = [
      index - 5, index + 5,
      col > 0 ? index - 1 : -1,
      col < 4 ? index + 1 : -1,
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
      syms.add(row * 5 + (4 - col));
    }
    if (verticalSymmetry) {
      syms.add((3 - row) * 5 + col);
    }
    if ((symmetric || horizontalSymmetry) && verticalSymmetry) {
      syms.add((3 - row) * 5 + (4 - col));
    }
    
    return Array.from(syms).filter(i => i !== index);
  };

  const indices = Array.from({ length: 20 }, (_, i) => i).sort(() => Math.random() - 0.5);

  // Fill colors
  let colorsPlaced = 0;
  for (const idx of indices) {
    if (colorsPlaced >= actualColored) break;
    if (cells[idx].color === '.' && cells[idx].value === '.') {
      const color = selectedColors[Math.floor(Math.random() * selectedColors.length)];
      const symIndices = getSymmetricIndices(idx);
      const targetIndices = [idx, ...symIndices];
      
      let allValid = true;
      for (const t of targetIndices) {
        if (cells[t].color !== '.' || cells[t].value !== '.' || !isValid(t, 'color', color)) {
          allValid = false;
          break;
        }
      }
      
      // Adjacency check within targets
      if (allValid && strictRules) {
        for (let a = 0; a < targetIndices.length; a++) {
          for (let b = a + 1; b < targetIndices.length; b++) {
            const idxA = targetIndices[a];
            const idxB = targetIndices[b];
            const colA = idxA % 5;
            const colB = idxB % 5;
            const rowA = Math.floor(idxA / 5);
            const rowB = Math.floor(idxB / 5);
            const isAdj = (Math.abs(rowA - rowB) === 1 && colA === colB) || (Math.abs(colA - colB) === 1 && rowA === rowB);
            if (isAdj) { allValid = false; break; }
          }
          if (!allValid) break;
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
  const shuffledIndicesForValues = [...indices].sort(() => Math.random() - 0.5);
  for (const idx of shuffledIndicesForValues) {
    if (valuesPlaced >= actualValued) break;
    if (cells[idx].value === '.' && cells[idx].color === '.') {
      const val = selectedValues[Math.floor(Math.random() * selectedValues.length)];
      const symIndices = getSymmetricIndices(idx);
      const targetIndices = [idx, ...symIndices];
      
      let allValid = true;
      for (const t of targetIndices) {
        if (cells[t].value !== '.' || cells[t].color !== '.' || !isValid(t, 'value', val)) {
          allValid = false;
          break;
        }
      }

      if (allValid && strictRules) {
        for (let a = 0; a < targetIndices.length; a++) {
          for (let b = a + 1; b < targetIndices.length; b++) {
            const idxA = targetIndices[a];
            const idxB = targetIndices[b];
            const colA = idxA % 5;
            const colB = idxB % 5;
            const rowA = Math.floor(idxA / 5);
            const rowB = Math.floor(idxB / 5);
            const isAdj = (Math.abs(rowA - rowB) === 1 && colA === colB) || (Math.abs(colA - colB) === 1 && rowA === rowB);
            if (isAdj) { allValid = false; break; }
          }
          if (!allValid) break;
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

  const shortId = Math.random().toString(36).substring(2, 8).toUpperCase();

  return {
    title: `Gen-${shortId}`,
    difficulty: calculateDifficulty(cells),
    cells,
    code: '',
    isGenerated: true
  };
}
