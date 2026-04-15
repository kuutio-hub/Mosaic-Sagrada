export const COLORS = [
  { id: 'R', hex: '#ed1c24', label: 'Piros' },
  { id: 'G', hex: '#00a651', label: 'Zöld' },
  { id: 'B', hex: '#0072bc', label: 'Kék' },
  { id: 'Y', hex: '#fff200', label: 'Sárga' },
  { id: 'P', hex: '#662d91', label: 'Lila' },
  { id: 'W', hex: '#ffffff', label: 'Fehér' },
  { id: '.', hex: 'transparent', label: 'Üres' }
];

export const VALUES = ['1', '2', '3', '4', '5', '6', 'X', '.'];

export const createEmptyGrid = () => Array(20).fill(null).map(() => ({ color: '.', value: '.' }));

export const DEFAULT_FRONT = {
  title: "Új minta",
  difficulty: 3,
  cells: createEmptyGrid(),
  code: ""
};

export const DEFAULT_BACK = {
  title: "Új minta (Hátoldal)",
  difficulty: 3,
  cells: createEmptyGrid(),
  code: ""
};
