export type Color = 'R' | 'G' | 'B' | 'Y' | 'P' | 'W' | '.';
export type Value = '1' | '2' | '3' | '4' | '5' | '6' | 'X' | '.';

export interface CellData {
  color: Color;
  value: Value;
}

export interface CardData {
  title: string;
  difficulty: number;
  cells: CellData[];
  code?: string;
  titleFont?: string;
  titleSize?: number;
  cornerRadius?: number;
}

export interface PatternQueueItem {
  id: string;
  front: CardData;
  back: CardData | null;
  isDoubleSided: boolean;
}

export interface PromoCard {
  difficulty: number;
  pattern: string[];
  code: string;
}

export interface PromoCards {
  [key: string]: PromoCard;
}
