import { CardData, CellData } from './types';

export const DEFAULT_CELL: CellData = { color: 'W', value: '.' };

export const createEmptyGrid = (): CellData[] => 
  Array(20).fill(null).map(() => ({ ...DEFAULT_CELL }));

export const FONTS = [
  { id: 'Uncial Antiqua', label: 'Uncial Antiqua' },
  { id: 'Cinzel', label: 'Cinzel' },
  { id: 'MedievalSharp', label: 'MedievalSharp' },
  { id: 'Almendra', label: 'Almendra' },
  { id: 'Pirata One', label: 'Pirata One' },
  { id: 'Great Vibes', label: 'Great Vibes' },
  { id: 'Playfair Display', label: 'Playfair Display' },
  { id: 'Cormorant Garamond', label: 'Cormorant Garamond' },
  { id: 'Montserrat', label: 'Montserrat' },
  { id: 'Inter', label: 'Inter' }
];

export const DEFAULT_FRONT: CardData = {
  title: "MINTA NÉV",
  difficulty: 3,
  cells: createEmptyGrid(),
  titleFont: 'Uncial Antiqua',
  titleSize: 14,
  cornerRadius: 0
};

export const DEFAULT_BACK: CardData = {
  title: "MINTA NÉV (HÁT)",
  difficulty: 4,
  cells: createEmptyGrid(),
  titleFont: 'Uncial Antiqua',
  titleSize: 14,
  cornerRadius: 0
};

export const COLORS = [
  { id: 'R', hex: '#ed1c24', label: 'Piros' },
  { id: 'G', hex: '#00a651', label: 'Zöld' },
  { id: 'B', hex: '#0072bc', label: 'Kék' },
  { id: 'Y', hex: '#fff200', label: 'Sárga' },
  { id: 'P', hex: '#662d91', label: 'Lila' },
  { id: 'W', hex: '#ffffff', label: 'Fehér' },
  { id: '.', hex: '#ffffff', label: 'Nincs' }
] as const;

export const VALUES = ['1', '2', '3', '4', '5', '6', 'X', '.'] as const;

export const PHYSICAL_DIMENSIONS = {
  cardWidth: 90, // mm
  cardHeight: 80, // mm
  cellSize: 15, // mm
  gapSize: 2.5, // mm
  pageWidth: 210, // mm
  pageHeight: 297, // mm
};
