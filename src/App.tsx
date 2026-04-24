import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { 
  Plus, 
  Trash2, 
  Download, 
  FlipHorizontal, 
  Settings, 
  Layers, 
  Printer,
  Upload,
  ChevronRight,
  ChevronLeft,
  Info,
  X as CloseIcon,
  Check,
  Layout,
  Save,
  ChevronDown,
  RotateCcw,
  BookOpen,
  HelpCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import { 
  DEFAULT_FRONT, 
  DEFAULT_BACK, 
  COLORS, 
  createEmptyGrid 
} from './constants';
import { cn, generateId } from './lib/utils';
import { generatePDF } from './services/pdfService';
import { generateSagradaCard, calculateDifficulty } from './services/cardGenerator';
import { translations } from './i18n';

interface Cell {
  color: string;
  value: string;
}

interface CardData {
  title: string;
  difficulty: number;
  cells: Cell[];
  code: string;
  titleFont?: string;
  titleSize?: number;
  isGenerated?: boolean;
}

interface QueueItem {
  id: string;
  card: CardData;
}

const getValueSvgDataUrl = (value: string, color: string = 'W') => {
  if (value === '.' || value === 'X') return '';
  
  const isWhite = (color === 'W' || color === '.');
  const dotColor = isWhite ? '#111827' : 'white';
  const dotSize = 8;
  const dots: Record<string, string> = {
    '1': `<circle cx="50" cy="50" r="${dotSize}" fill="${dotColor}" />`,
    '2': `<circle cx="30" cy="30" r="${dotSize}" fill="${dotColor}" /><circle cx="70" cy="70" r="${dotSize}" fill="${dotColor}" />`,
    '3': `<circle cx="30" cy="30" r="${dotSize}" fill="${dotColor}" /><circle cx="50" cy="50" r="${dotSize}" fill="${dotColor}" /><circle cx="70" cy="70" r="${dotSize}" fill="${dotColor}" />`,
    '4': `<circle cx="30" cy="30" r="${dotSize}" fill="${dotColor}" /><circle cx="70" cy="30" r="${dotSize}" fill="${dotColor}" /><circle cx="30" cy="70" r="${dotSize}" fill="${dotColor}" /><circle cx="70" cy="70" r="${dotSize}" fill="${dotColor}" />`,
    '5': `<circle cx="30" cy="30" r="${dotSize}" fill="${dotColor}" /><circle cx="70" cy="30" r="${dotSize}" fill="${dotColor}" /><circle cx="50" cy="50" r="${dotSize}" fill="${dotColor}" /><circle cx="30" cy="70" r="${dotSize}" fill="${dotColor}" /><circle cx="70" cy="70" r="${dotSize}" fill="${dotColor}" />`,
    '6': `<circle cx="30" cy="30" r="${dotSize}" fill="${dotColor}" /><circle cx="70" cy="30" r="${dotSize}" fill="${dotColor}" /><circle cx="30" cy="50" r="${dotSize}" fill="${dotColor}" /><circle cx="70" cy="50" r="${dotSize}" fill="${dotColor}" /><circle cx="30" cy="70" r="${dotSize}" fill="${dotColor}" /><circle cx="70" cy="70" r="${dotSize}" fill="${dotColor}" />`
  };

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect x="10" y="10" width="80" height="80" rx="12" fill="none" />${dots[value] || ''}</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
};

const Card: React.FC<{
  data: CardData;
  activeCellIndex: number | null;
  onCellClick?: (index: number) => void;
  onDifficultyChange?: (difficulty: number) => void;
  onTitleChange?: (title: string) => void;
  scale?: number;
  cornerRadius?: number;
  className?: string;
  id?: string;
  editable?: boolean;
  hideShadow?: boolean;
  printerFriendly?: boolean;
  showCropMarks?: boolean;
  showBlackFrame?: boolean;
}> = ({ 
  data, 
  activeCellIndex, 
  onCellClick, 
  onDifficultyChange,
  onTitleChange,
  scale = 1, 
  cornerRadius = 0, 
  className, 
  id,
  editable = false,
  hideShadow = false,
  printerFriendly = false,
  showCropMarks = false,
  showBlackFrame = false
}) => {
  const titleRef = useRef<HTMLSpanElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [adjustedFontSize, setAdjustedFontSize] = useState<number | null>(null);

  useLayoutEffect(() => {
    if (titleRef.current && containerRef.current) {
      const containerWidth = containerRef.current.clientWidth - 12;
      const baseFontSize = data.titleSize || 12;
      let currentFontSize = baseFontSize;
      
      titleRef.current.style.fontSize = `${currentFontSize}pt`;
      
      let attempts = 0;
      while (titleRef.current.scrollWidth > containerWidth && currentFontSize > 4 && attempts < 50) {
        currentFontSize -= 0.2;
        titleRef.current.style.fontSize = `${currentFontSize}pt`;
        attempts++;
      }
      setAdjustedFontSize(currentFontSize);
    }
  }, [data.title, data.titleSize, data.titleFont, data.code]);

  const isGenerated = data.isGenerated;
  const contentOpacity = printerFriendly ? 0.3 : 1;

  return (
    <div 
      id={id}
      className={cn(
        "card-container shrink-0", 
        !hideShadow && "shadow-2xl", 
        printerFriendly && "printer-friendly",
        showCropMarks && "crop-marks",
        className
      )}
      style={{ 
        width: '90mm',
        height: '80mm',
        transform: `scale(${scale})`,
        transformOrigin: 'center',
        borderRadius: showCropMarks ? '0' : `${cornerRadius}mm`,
        border: (showBlackFrame && !printerFriendly) ? '1mm solid black' : undefined
      }}
    >
      <div className="card-grid" style={{ padding: '2.5mm', gap: '2.5mm' }}>
        {data.cells.map((cell, idx) => (
          <div 
            key={idx}
            onClick={(e) => {
              e.stopPropagation();
              onCellClick?.(idx);
            }}
            className={cn(
              "card-cell cursor-pointer transition-all",
              cell.color !== '.' && "has-color",
              cell.value === 'X' && "val-x",
              activeCellIndex === idx && "ring-2 ring-white ring-offset-2 ring-offset-black z-10 scale-105"
            )}
            style={{ 
              border: printerFriendly ? '0.2mm solid #d1d5db' : undefined
            }}
          >
            {cell.color !== '.' && cell.color !== 'W' && (
              <div 
                className={cn(
                  "color-overlay", 
                  `c-${cell.color.toLowerCase()}`
                )} 
                style={{ 
                  inset: 0,
                  opacity: contentOpacity
                }} 
              />
            )}
            {cell.value !== '.' && (
              <div className="value-container" key={`${cell.value}-${cell.color}`} style={{ opacity: contentOpacity }}>
                {cell.value === 'X' ? (
                  <span className="x-mark">X</span>
                ) : (
                  <img 
                    src={`png/${cell.value}.png?v=0.1.4.5`}
                    referrerPolicy="no-referrer"
                    className="value-image"
                    onError={(e) => {
                      const target = e.currentTarget as HTMLImageElement;
                      if (target.src.includes('githubusercontent.com')) {
                        target.src = getValueSvgDataUrl(cell.value, cell.color);
                      } else if (target.src.includes('/svg/')) {
                        target.src = `https://raw.githubusercontent.com/kuutio-hub/Mosaic-Sagrada/main/public/png/${cell.value}.png`;
                      } else {
                        target.src = `svg/${cell.value}.svg?v=0.1.4.5`;
                      }
                    }}
                    alt={cell.value}
                  />
                )}
              </div>
            )}
          </div>
        ))}

        {/* Printer Friendly Fade Overlay */}
        {printerFriendly && (
          <div 
            className="absolute inset-0 pointer-events-none bg-white opacity-20 transition-opacity duration-200" 
            style={{ zIndex: 10 }} 
          />
        )}
      </div>

      <div className={cn("card-footer", printerFriendly && "bg-transparent")} ref={containerRef} style={{ padding: '0 4mm 0 2.5mm', height: '10mm', overflow: 'visible', display: 'flex', alignItems: 'center' }}>
        <div className="card-title-container" style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0, overflow: 'visible', justifyContent: 'center' }}>
          <input 
            className="card-title bg-transparent border-none outline-none flex-1 min-w-0 hover:bg-white/5 focus:bg-white/10 rounded px-1 -ml-1 transition-colors" 
            value={data.title}
            onChange={(e) => onTitleChange?.(e.target.value)}
            style={{ 
              fontFamily: data.titleFont || '"Uncial Antiqua", serif',
              fontSize: adjustedFontSize ? `${adjustedFontSize}pt` : `${data.titleSize || 10}pt`,
              lineHeight: 1,
              marginTop: '-0.3mm',
              textAlign: 'center'
            }}
          />
          {data.code && <span className="card-code ml-2 opacity-40 shrink-0" style={{ fontSize: '7pt' }}>{data.code}</span>}
        </div>
        <div className={cn("card-difficulty", editable && "editable")} style={{ height: '10mm', display: 'flex', alignItems: 'center' }}>
          {Array.from({ length: 6 }).map((_, i) => {
            const isActive = i >= (6 - data.difficulty);
            return (
              <div 
                key={i} 
                className={cn(
                  "difficulty-dot", 
                  isActive && "active",
                  isGenerated && "generated"
                )}
                onClick={(e) => {
                  if (editable && onDifficultyChange) {
                    e.stopPropagation();
                    onDifficultyChange(6 - i);
                  }
                }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
};

const Wiki: React.FC<{ onClose: () => void, t: any, language: string }> = ({ onClose, t, language }) => {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div 
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        className="w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-8 border-b border-zinc-800 flex items-center justify-between">
          <h2 className="text-2xl font-display text-white">{t('wikiTitle')}</h2>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-xl transition-colors">
            <CloseIcon size={24} className="text-zinc-500" />
          </button>
        </div>
        <div className="p-8 overflow-y-auto max-h-[60vh] space-y-8">
          <section className="space-y-3">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Layout size={20} className="text-zinc-400" />
              {t('editorUsage')}
            </h3>
            <p className="text-zinc-400 text-sm leading-relaxed">{t('editorUsageDesc')}</p>
          </section>
          <section className="space-y-3">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Settings size={20} className="text-zinc-400" />
              {t('generation')}
            </h3>
            <p className="text-zinc-400 text-sm leading-relaxed">{t('generationDesc')}</p>
          </section>
          <section className="space-y-3">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Printer size={20} className="text-zinc-400" />
              {t('printAndPdf')}
            </h3>
            <p className="text-zinc-400 text-sm leading-relaxed">{t('printAndPdfDesc')}</p>
          </section>
          <div className="grid grid-cols-2 gap-6">
            <div className="p-4 bg-zinc-950 rounded-2xl space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-widest text-zinc-500">{t('doubleSided')}</h4>
              <p className="text-[10px] text-zinc-600 leading-relaxed">{t('doubleSidedDesc')}</p>
            </div>
            <div className="p-4 bg-zinc-950 rounded-2xl space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-widest text-zinc-500">{t('printerFriendly')}</h4>
              <p className="text-[10px] text-zinc-600 leading-relaxed">{t('printerFriendlyDesc')}</p>
            </div>
          </div>
        </div>
        <div className="p-8 bg-zinc-950/50 border-t border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-zinc-900 flex items-center justify-center">
              <Info size={20} className="text-zinc-500" />
            </div>
            <div>
              <p className="text-xs font-bold text-white">{t('info')}</p>
              <p className="text-[10px] text-zinc-600">{t('infoDesc')}</p>
            </div>
          </div>
          <button onClick={onClose} className="premium-button-primary px-8">{language === 'hu' ? 'RENDBEN' : 'OK'}</button>
        </div>
      </motion.div>
    </motion.div>
  );
};

const App: React.FC = () => {
  const [front, setFront] = useState<CardData>(JSON.parse(JSON.stringify(DEFAULT_FRONT)));
  const [back, setBack] = useState<CardData>(JSON.parse(JSON.stringify(DEFAULT_BACK)));
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [activeSide, setActiveSide] = useState<'front' | 'back'>('front');
  const [isDoubleSided, setIsDoubleSided] = useState(false);
  const [activeCell, setActiveCell] = useState<{ side: 'front' | 'back', index: number } | null>(null);
  const [activePanel, setActivePanel] = useState('editor');
  const [isGenerating, setIsGenerating] = useState(false);
  const [promos, setPromos] = useState<any>({});
  const [customCards, setCustomCards] = useState<CardData[]>([]);
  const [libraryTab, setLibraryTab] = useState<'saved' | 'promos'>('saved');
  const [editingCustomCardIndex, setEditingCustomCardIndex] = useState<number | null>(null);
  const [cornerRadius, setCornerRadius] = useState(0.5);
  const [previewScale, setPreviewScale] = useState(1);
  const [isColorsExpanded, setIsColorsExpanded] = useState(true);
  const [isValuesExpanded, setIsValuesExpanded] = useState(true);
  const [notification, setNotification] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
  const [showWiki, setShowWiki] = useState(false);
  const [selectedTool, setSelectedTool] = useState<{ type: 'color' | 'value', value: string } | null>(null);
  const [printerFriendly, setPrinterFriendly] = useState(false);
  const [showCropMarks, setShowCropMarks] = useState(false);
  const [showBlackFrame, setShowBlackFrame] = useState(false);
  const [isValidatorEnabled, setIsValidatorEnabled] = useState(true);
  const [genOptions, setGenOptions] = useState({
    colorCount: 5,
    coloredCells: 6,
    valueCount: 6,
    valuedCells: 6,
    symmetric: false,
    horizontalSymmetry: false,
    verticalSymmetry: false,
    strictRules: true
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [language, setLanguage] = useState<'hu' | 'en' | 'de'>('hu');

  const t = (key: string, params?: Record<string, any>) => {
    let text = (translations[language] as any)[key] || (translations['hu'] as any)[key] || key;
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        text = text.replace(`{{${k}}}`, String(v));
      });
    }
    return text;
  };

  const currentCard = activeSide === 'front' ? front : back;
  const setCurrentCard = activeSide === 'front' ? setFront : setBack;

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  useEffect(() => {
    const savedScale = localStorage.getItem('sagrada_previewScale');
    if (savedScale) setPreviewScale(parseFloat(savedScale));
    const savedCorner = localStorage.getItem('sagrada_cornerRadius');
    if (savedCorner) setCornerRadius(parseFloat(savedCorner));
    const savedPrinter = localStorage.getItem('sagrada_printerFriendly');
    if (savedPrinter) setPrinterFriendly(savedPrinter === 'true');
    const savedLang = localStorage.getItem('sagrada_language');
    if (savedLang) setLanguage(savedLang as any);
    const savedValidator = localStorage.getItem('sagrada_validator');
    if (savedValidator) setIsValidatorEnabled(savedValidator === 'true');
    const savedStrict = localStorage.getItem('sagrada_strictRules');
    if (savedStrict) setGenOptions(prev => ({ ...prev, strictRules: savedStrict === 'true' }));

    fetch('/promos.json')
      .then(res => res.json())
      .then(data => setPromos(data))
      .catch(err => console.error("Failed to load promos:", err));

    const saved = localStorage.getItem('customCards');
    if (saved) {
      try { setCustomCards(JSON.parse(saved)); } catch (e) {}
    }

    // Set favicon
    const link = document.querySelector("link[rel~='icon']") as HTMLLinkElement || document.createElement('link');
    link.rel = 'icon';
    link.href = getValueSvgDataUrl('6', 'B');
    document.getElementsByTagName('head')[0].appendChild(link);
  }, []);

  useEffect(() => { localStorage.setItem('sagrada_previewScale', previewScale.toString()); }, [previewScale]);
  useEffect(() => { localStorage.setItem('sagrada_cornerRadius', cornerRadius.toString()); }, [cornerRadius]);
  useEffect(() => { localStorage.setItem('sagrada_printerFriendly', printerFriendly.toString()); }, [printerFriendly]);
    useEffect(() => { localStorage.setItem('sagrada_language', language); }, [language]);
  useEffect(() => { localStorage.setItem('sagrada_validator', isValidatorEnabled.toString()); }, [isValidatorEnabled]);
  useEffect(() => { localStorage.setItem('sagrada_strictRules', genOptions.strictRules.toString()); }, [genOptions.strictRules]);

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => setNotification({ message, type });

  const parsePattern = (pattern: string[]) => {
    const cells: Cell[] = [];
    pattern.forEach(row => {
      for (let i = 0; i < row.length; i++) {
        const char = row[i].toLowerCase();
        const cell: Cell = { color: '.', value: '.' };
        if (char >= '1' && char <= '6') cell.value = char;
        else if (char === 'r') cell.color = 'R';
        else if (char === 'g') cell.color = 'G';
        else if (char === 'b') cell.color = 'B';
        else if (char === 'y') cell.color = 'Y';
        else if (char === 'p') cell.color = 'P';
        else if (char === 'w') cell.color = 'W';
        else if (char === 'x') cell.value = 'X';
        cells.push(cell);
      }
    });
    return cells;
  };

  const serializePattern = (cells: Cell[]) => {
    const pattern: string[] = [];
    for (let r = 0; r < 4; r++) {
      let row = "";
      for (let c = 0; c < 5; c++) {
        const cell = cells[r * 5 + c];
        if (cell.value !== '.') row += cell.value;
        else if (cell.color !== '.') row += cell.color.toLowerCase();
        else row += ".";
      }
      pattern.push(row);
    }
    return pattern;
  };

  const loadPromo = (name: string) => {
    const promo = promos[name];
    if (!promo) return;
    setCurrentCard({
      title: name,
      difficulty: promo.difficulty,
      cells: parsePattern(promo.pattern),
      code: promo.code
    });
    setEditingCustomCardIndex(null);
    setActiveSide('front');
  };

  const saveCard = (overwrite = false) => {
    if (overwrite && editingCustomCardIndex !== null) {
      const newCustomCards = [...customCards];
      newCustomCards[editingCustomCardIndex] = { ...currentCard };
      setCustomCards(newCustomCards);
      localStorage.setItem('customCards', JSON.stringify(newCustomCards));
      showNotification(t('cardUpdated'));
    } else {
      const newCustomCards = [...customCards, { ...currentCard }];
      setCustomCards(newCustomCards);
      setEditingCustomCardIndex(newCustomCards.length - 1);
      localStorage.setItem('customCards', JSON.stringify(newCustomCards));
      showNotification(t('cardSaved'));
    }
  };

  const loadCustomCard = (idx: number) => {
    const card = customCards[idx];
    if (!card) return;
    setCurrentCard(JSON.parse(JSON.stringify(card)));
    setEditingCustomCardIndex(idx);
    setActiveSide('front');
  };

  const deleteCustomCard = (idx: number) => {
    const newCustomCards = customCards.filter((_, i) => i !== idx);
    setCustomCards(newCustomCards);
    localStorage.setItem('customCards', JSON.stringify(newCustomCards));
    if (editingCustomCardIndex === idx) setEditingCustomCardIndex(null);
  };

  const handleExport = (cards: CardData[], filename: string) => {
    const simplified = cards.map(c => ({
      title: c.title,
      difficulty: c.difficulty,
      pattern: serializePattern(c.cells),
      code: c.code,
      titleFont: c.titleFont,
      titleSize: c.titleSize
    }));
    const blob = new Blob([JSON.stringify(simplified, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target?.result as string);
        const items = Array.isArray(imported) ? imported : [imported];
        const validCards = items.map(item => {
          if (item.pattern && Array.isArray(item.pattern)) {
            return {
              title: item.title || "Névtelen",
              difficulty: item.difficulty || 1,
              cells: parsePattern(item.pattern),
              code: item.code,
              titleFont: item.titleFont,
              titleSize: item.titleSize
            };
          }
          if (item.cells && Array.isArray(item.cells)) return { ...item };
          return null;
        }).filter(c => c !== null && c.cells.length === 20);
        
        if (validCards.length > 0) {
          const merged = [...customCards, ...validCards];
          setCustomCards(merged);
          localStorage.setItem('customCards', JSON.stringify(merged));
          showNotification(t('importSuccessCount', { count: validCards.length }));
        } else {
          showNotification(t('invalidFile'), 'error');
        }
      } catch (err) { showNotification(t('importError'), 'error'); }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const validateCell = (cells: Cell[], index: number, type: 'color' | 'value', val: string) => {
    if (!isValidatorEnabled) return true;
    if (val === '.') return true;

    const col = index % 5;
    const neighbors = [
      index - 5, index + 5,
      col > 0 ? index - 1 : -1,
      col < 4 ? index + 1 : -1
    ];

    for (const n of neighbors) {
      if (n >= 0 && n < 20) {
        if (type === 'color' && cells[n].color === val) return false;
        if (type === 'value' && cells[n].value === val) return false;
      }
    }
    return true;
  };

  const handleCellClick = (side: 'front' | 'back', index: number) => {
    if (selectedTool) {
      const updateFn = side === 'front' ? setFront : setBack;
      updateFn(prev => {
        const newCells = [...prev.cells];
        const cell = { ...newCells[index] };
        
        if (selectedTool.type === 'color') {
          if (cell.color === selectedTool.value) {
            cell.color = '.';
          } else {
            if (!validateCell(newCells, index, 'color', selectedTool.value)) {
              showNotification(t('violationError'), 'error');
              return prev;
            }
            cell.color = selectedTool.value;
            cell.value = '.';
          }
        } else {
          if (cell.value === selectedTool.value) {
            cell.value = '.';
            cell.color = '.';
          } else {
            if (!validateCell(newCells, index, 'value', selectedTool.value)) {
              showNotification(t('violationError'), 'error');
              return prev;
            }
            cell.value = selectedTool.value;
            cell.color = '.';
          }
        }
        newCells[index] = cell;
        return { ...prev, cells: newCells, difficulty: calculateDifficulty(newCells) };
      });
    } else { setActiveCell({ side, index }); }
  };

  const handlePickerSelect = (color?: string, value?: string) => {
    if (color) { setSelectedTool({ type: 'color', value: color }); setActiveCell(null); }
    else if (value) { setSelectedTool({ type: 'value', value: value }); setActiveCell(null); }
    else if (activeCell) {
      const { side, index } = activeCell;
      const updateFn = side === 'front' ? setFront : setBack;
      updateFn(prev => {
        const newCells = [...prev.cells];
        const cell = { ...newCells[index] };
        if (color !== undefined) {
          if (cell.color === color) {
            cell.color = '.';
          } else {
            if (!validateCell(newCells, index, 'color', color)) {
              showNotification(t('violationError'), 'error');
              return prev;
            }
            cell.color = color;
            cell.value = '.';
          }
        }
        if (value !== undefined) {
          if (cell.value === value) {
            cell.value = '.';
            cell.color = '.';
          } else {
            if (!validateCell(newCells, index, 'value', value)) {
              showNotification(t('violationError'), 'error');
              return prev;
            }
            cell.value = value;
            cell.color = '.';
          }
        }
        newCells[index] = cell;
        return { ...prev, cells: newCells, difficulty: calculateDifficulty(newCells) };
      });
    }
  };

  const addToQueue = (card?: CardData) => {
    const newItem: QueueItem = {
      id: generateId(),
      card: JSON.parse(JSON.stringify(card || (activeSide === 'front' ? front : back)))
    };
    setQueue(prev => [...prev, newItem]);
    showNotification(t('addedToQueue'));
  };

  const moveQueueItem = (index: number, direction: 'up' | 'down') => {
    const newQueue = [...queue];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newQueue.length) return;
    [newQueue[index], newQueue[targetIndex]] = [newQueue[targetIndex], newQueue[index]];
    setQueue(newQueue);
  };

  const handleExportPDF = async () => {
    if (queue.length === 0) { alert(t('queueEmptyAlert')); return; }
    setIsGenerating(true);
    try { await generatePDF(queue, cornerRadius, printerFriendly, showCropMarks, showBlackFrame, isDoubleSided); }
    catch (err) { console.error(err); alert(t('pdfError')); }
    finally { setIsGenerating(false); }
  };

  const resetCurrentCard = () => {
    setCurrentCard(activeSide === 'front' ? JSON.parse(JSON.stringify(DEFAULT_FRONT)) : JSON.parse(JSON.stringify(DEFAULT_BACK)));
    showNotification(t('reset'));
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-black">
      {/* Header */}
      <header className="h-16 bg-zinc-950 border-b border-zinc-900 px-8 flex items-center justify-between shrink-0 z-50">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(255,255,255,0.1)]">
            <Layers size={24} className="text-black" />
          </div>
          <div className="flex flex-col">
            <h1 className="text-lg font-display text-white tracking-tight">MOSAIC</h1>
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.3em] -mt-1">Sagrada Designer</span>
          </div>
        </div>

        <nav className="flex items-center p-1 rounded-2xl border transition-all">
          {[
            { id: 'editor', icon: Layout, label: t('editor') },
            { id: 'generator', icon: Settings, iconSize: 18, label: t('generator') },
            { id: 'library', icon: BookOpen, label: t('library') },
            { id: 'print', icon: Printer, label: t('print') },
            { id: 'settings', icon: Settings, label: t('settings') }
          ].map(item => (
            <button 
              key={item.id}
              onClick={() => setActivePanel(item.id)}
              data-active={activePanel === item.id}
              className={cn(
                "flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-all",
                activePanel === item.id 
                  ? "bg-white text-black shadow-lg" 
                  : "text-zinc-500 hover:text-zinc-300"
              )}
            >
              <item.icon size={item.iconSize || 16} />
              <span>{item.label}</span>
              {item.id === 'print' && queue.length > 0 && (
                <span className="ml-1 w-4 h-4 bg-red-500 text-white text-[8px] rounded-full flex items-center justify-center animate-pulse">
                  {queue.length}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <div className="relative group">
            <button className="flex items-center gap-2 px-4 py-2 bg-zinc-900/50 border border-zinc-800 rounded-xl text-[10px] font-bold uppercase tracking-widest text-zinc-400">
              <span className="w-4 h-3 bg-zinc-800 rounded-sm overflow-hidden flex items-center justify-center text-[8px]">
                {language.toUpperCase()}
              </span>
              <span>{language === 'hu' ? 'Magyar' : language === 'en' ? 'English' : 'Deutsch'}</span>
              <ChevronDown size={12} />
            </button>
            <div className="absolute top-full right-0 mt-2 w-32 bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
              {(['hu', 'en', 'de'] as const).map(lang => (
                <button 
                  key={lang}
                  onClick={() => setLanguage(lang)}
                  className={cn(
                    "w-full px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest transition-colors",
                    language === lang 
                      ? "text-white bg-white/5" 
                      : "text-zinc-500 hover:bg-white/5"
                  )}
                >
                  {lang === 'hu' ? 'Magyar' : lang === 'en' ? 'English' : 'Deutsch'}
                </button>
              ))}
            </div>
          </div>
          <button 
            onClick={() => setShowWiki(!showWiki)}
            className={cn(
              "w-10 h-10 flex items-center justify-center rounded-xl border transition-all",
              showWiki ? "bg-white text-black border-white" : "bg-zinc-900/50 text-zinc-500 border-zinc-800 hover:border-zinc-700"
            )}
          >
            <HelpCircle size={18} />
          </button>
        </div>
      </header>
      {/* Main Content */}
      <main className="flex-1 flex overflow-hidden" onClick={() => setSelectedTool(null)}>
        {/* Left Sidebar: Contextual Tools */}
        <AnimatePresence mode="wait">
          <motion.aside 
            key={activePanel}
            initial={{ x: -400, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -400, opacity: 0 }}
            className="w-72 bg-[#0a0a0a] border-r border-zinc-800/50 flex flex-col shrink-0 z-40 transition-all"
          >
            <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-6">
              {activePanel === 'editor' && (
                <section className="space-y-6">
                  <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">{t('palette')}</h2>
                  
                  <div className="space-y-4">
                    {/* Colors */}
                    <div className="premium-panel rounded-2xl overflow-hidden">
                      <button 
                        onClick={() => setIsColorsExpanded(!isColorsExpanded)}
                        className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/5 transition-colors"
                      >
                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{t('colors')}</span>
                        <motion.div animate={{ rotate: isColorsExpanded ? 90 : 0 }}>
                          <ChevronRight size={14} className="text-zinc-600" />
                        </motion.div>
                      </button>
                      <AnimatePresence>
                        {isColorsExpanded && (
                          <motion.div 
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="px-4 pb-4"
                          >
                            <div className="grid grid-cols-3 gap-1.5">
                              {COLORS.filter(c => c.id !== '.').map(color => (
                                <button 
                                  key={color.id}
                                  onClick={(e) => { e.stopPropagation(); handlePickerSelect(color.id); }}
                                  className={cn(
                                    "aspect-square max-w-[60px] mx-auto w-full rounded-lg transition-all flex items-center justify-center overflow-hidden border-2",
                                    selectedTool?.value === color.id ? "border-white scale-105 shadow-xl shadow-white/10" : "border-transparent hover:scale-105"
                                  )}
                                  style={{ backgroundColor: color.hex }}
                                />
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Values */}
                    <div className="premium-panel rounded-2xl overflow-hidden">
                      <button 
                        onClick={() => setIsValuesExpanded(!isValuesExpanded)}
                        className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/5 transition-colors"
                      >
                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{t('values')}</span>
                        <motion.div animate={{ rotate: isValuesExpanded ? 90 : 0 }}>
                          <ChevronRight size={14} className="text-zinc-600" />
                        </motion.div>
                      </button>
                      <AnimatePresence>
                        {isValuesExpanded && (
                          <motion.div 
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="px-4 pb-4"
                          >
                          <div className="grid grid-cols-3 gap-1.5">
                              {['1', '2', '3', '4', '5', '6', 'X', 'empty', '.'].map((val) => {
                                if (val === '.') return (
                                  <button 
                                    key="trash" 
                                    onClick={(e) => { e.stopPropagation(); handlePickerSelect(undefined, '.'); }}
                                    className="aspect-square max-w-[60px] mx-auto w-full rounded-lg bg-zinc-900 flex items-center justify-center transition-all hover:bg-zinc-800 hover:scale-105"
                                  >
                                    <Trash2 size={20} className="text-red-500" />
                                  </button>
                                );
                                if (val === 'empty') return <div key="empty" />;
                                return (
                                  <button 
                                    key={val}
                                    onClick={(e) => { e.stopPropagation(); handlePickerSelect(undefined, val); }}
                                    className={cn(
                                      "aspect-square max-w-[60px] mx-auto w-full rounded-lg transition-all overflow-hidden bg-zinc-900 flex items-center justify-center",
                                      selectedTool?.value === val ? "bg-zinc-700 scale-105" : "hover:bg-zinc-800 hover:scale-105"
                                    )}
                                  >
                                    {val === 'X' ? (
                                      <span className="font-display text-xl text-zinc-500">X</span>
                                    ) : (
                                      <img 
                                        src={`png/${val}.png?v=0.1.4.5`} 
                                        className="w-full h-full object-cover" 
                                        onError={(e) => { 
                                          const target = e.currentTarget as HTMLImageElement;
                                          if (target.src.includes('githubusercontent.com')) {
                                            target.src = getValueSvgDataUrl(val);
                                          } else if (target.src.includes('/svg/')) {
                                            target.src = `https://raw.githubusercontent.com/kuutio-hub/Mosaic-Sagrada/main/public/png/${val}.png`;
                                          } else {
                                            target.src = `svg/${val}.svg?v=0.1.4.5`;
                                          }
                                        }} 
                                      />
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>

                  <div className="pt-6 space-y-3 border-t border-zinc-800/50">
                    <button 
                      onClick={() => saveCard(editingCustomCardIndex !== null)}
                      className="w-full premium-button-secondary justify-center py-3 rounded-xl"
                    >
                      <Download size={18} />
                      <span className="font-bold">{editingCustomCardIndex !== null ? t('cardUpdated') : t('savePattern')}</span>
                    </button>
                  </div>
                </section>
              )}
              {activePanel === 'generator' && (
                <section className="space-y-8">
                  <div className="space-y-2">
                    <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">{t('generation')}</h2>
                    <p className="text-zinc-500 text-[10px] leading-relaxed">{t('genDescription')}</p>
                  </div>

                  <div className="space-y-6">
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">{t('colorCount')}</label>
                        <span className="text-[10px] font-bold text-white">{genOptions.colorCount}</span>
                      </div>
                      <input type="range" min="1" max="5" value={genOptions.colorCount} onChange={(e) => setGenOptions(prev => ({ ...prev, colorCount: parseInt(e.target.value) }))} className="w-full accent-white" />
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">{t('coloredCells')}</label>
                        <span className="text-[10px] font-bold text-white">{genOptions.coloredCells}</span>
                      </div>
                      <input type="range" min="0" max="20" value={genOptions.coloredCells} onChange={(e) => setGenOptions(prev => ({ ...prev, coloredCells: parseInt(e.target.value), valuedCells: Math.min(prev.valuedCells, 20 - parseInt(e.target.value)) }))} className="w-full accent-white" />
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">{t('valueCount')}</label>
                        <span className="text-[10px] font-bold text-white">{genOptions.valueCount}</span>
                      </div>
                      <input type="range" min="1" max="6" value={genOptions.valueCount} onChange={(e) => setGenOptions(prev => ({ ...prev, valueCount: parseInt(e.target.value) }))} className="w-full accent-white" />
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">{t('valuedCells')}</label>
                        <span className="text-[10px] font-bold text-white">{genOptions.valuedCells}</span>
                      </div>
                      <input type="range" min="0" max="20" value={genOptions.valuedCells} onChange={(e) => setGenOptions(prev => ({ ...prev, valuedCells: parseInt(e.target.value), coloredCells: Math.min(prev.coloredCells, 20 - parseInt(e.target.value)) }))} className="w-full accent-white" />
                    </div>

                    <div className="pt-4 space-y-4 border-t border-zinc-900/50">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-medium text-zinc-400">{t('horizontalSymmetry')}</label>
                        <button 
                          onClick={() => setGenOptions(prev => ({ ...prev, horizontalSymmetry: !prev.horizontalSymmetry }))}
                          className={cn("w-10 h-5 rounded-full transition-all relative", genOptions.horizontalSymmetry ? "bg-white" : "bg-zinc-800")}
                        >
                          <div className={cn("absolute top-0.5 w-4 h-4 rounded-full transition-all shadow-sm", genOptions.horizontalSymmetry ? "right-0.5 bg-black" : "left-0.5 bg-zinc-600")} />
                        </button>
                      </div>
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-medium text-zinc-400">{t('verticalSymmetry')}</label>
                        <button 
                          onClick={() => setGenOptions(prev => ({ ...prev, verticalSymmetry: !prev.verticalSymmetry }))}
                          className={cn("w-10 h-5 rounded-full transition-all relative", genOptions.verticalSymmetry ? "bg-white" : "bg-zinc-800")}
                        >
                          <div className={cn("absolute top-0.5 w-4 h-4 rounded-full transition-all shadow-sm", genOptions.verticalSymmetry ? "right-0.5 bg-black" : "left-0.5 bg-zinc-600")} />
                        </button>
                      </div>
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-medium text-zinc-400">{t('strictRules')}</label>
                        <button 
                          onClick={() => setGenOptions(prev => ({ ...prev, strictRules: !prev.strictRules }))}
                          className={cn("w-10 h-5 rounded-full transition-all relative", genOptions.strictRules ? "bg-white" : "bg-zinc-800")}
                        >
                          <div className={cn("absolute top-0.5 w-4 h-4 rounded-full transition-all shadow-sm", genOptions.strictRules ? "right-0.5 bg-black" : "left-0.5 bg-zinc-600")} />
                        </button>
                      </div>
                    </div>
                  </div>


                  <div className="flex flex-col gap-3">
                    <button 
                      onClick={() => {
                        const newCard = generateSagradaCard(genOptions);
                        setCurrentCard(newCard);
                        showNotification(t('genSuccess'));
                      }}
                      className="w-full premium-button-primary justify-center py-4 rounded-xl shadow-xl shadow-white/5"
                    >
                      <Layout size={20} />
                      <span className="font-bold">{t('startGeneration')}</span>
                    </button>
                    <button 
                      onClick={() => saveCard(false)}
                      className="w-full premium-button-secondary justify-center py-3 rounded-xl"
                    >
                      <Download size={18} />
                      <span className="font-bold">{t('savePattern')}</span>
                    </button>
                  </div>
                </section>
              )}

              {activePanel === 'library' && (
                <section className="space-y-6 flex flex-col h-full">
                  <div className="space-y-4">
                    <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">{t('library')}</h2>
                    <div className="flex bg-zinc-900 p-1 rounded-xl border border-zinc-800">
                      {(['saved', 'promos'] as const).map(tab => (
                        <button 
                          key={tab}
                          onClick={() => setLibraryTab(tab)}
                          className={cn(
                            "flex-1 py-2 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all",
                            libraryTab === tab ? "bg-zinc-800 text-white shadow-sm" : "text-zinc-500 hover:text-zinc-300"
                          )}
                        >
                          {t(tab)}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                    {libraryTab === 'saved' ? (
                      customCards.length === 0 ? (
                        <div className="py-12 text-center text-zinc-600 space-y-4">
                          <BookOpen size={48} strokeWidth={1} className="mx-auto" />
                          <p className="text-xs">{t('noSavedPatterns')}</p>
                        </div>
                      ) : (
                        customCards.map((card, idx) => (
                          <div 
                            key={idx} 
                            onClick={() => loadCustomCard(idx)}
                            className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 group cursor-pointer transition-colors border border-transparent hover:border-zinc-800"
                          >
                            <div className="w-10 h-8 bg-zinc-950 rounded-md overflow-hidden flex items-center justify-center border border-zinc-900 shrink-0">
                              <Card data={card} activeCellIndex={null} scale={0.12} hideShadow />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="text-zinc-100 font-bold text-[10px] truncate">{card.title}</h3>
                              <div className="flex gap-0.5 mt-0.5">
                                {Array.from({ length: 6 }).map((_, i) => (
                                  <div key={i} className={cn("w-0.5 h-0.5 rounded-full", i < (6-card.difficulty) ? "bg-zinc-700" : "bg-zinc-300")} />
                                ))}
                              </div>
                            </div>
                            <button 
                              onClick={(e) => { e.stopPropagation(); deleteCustomCard(idx); }}
                              className="w-6 h-6 flex items-center justify-center text-zinc-700 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        ))
                      )
                    ) : (
                      Object.keys(promos).map(name => (
                        <div 
                          key={name} 
                          onClick={() => loadPromo(name)}
                          className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 group cursor-pointer transition-colors border border-transparent hover:border-zinc-800"
                        >
                          <div className="w-10 h-8 bg-zinc-950 rounded-md overflow-hidden flex items-center justify-center border border-zinc-900 shrink-0">
                            <Card data={{ ...promos[name], cells: parsePattern(promos[name].pattern), title: name }} activeCellIndex={null} scale={0.12} hideShadow />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="text-zinc-100 font-bold text-[10px] truncate">{name}</h3>
                            <p className="text-[7px] text-zinc-600 font-bold uppercase tracking-widest leading-none mt-1">{promos[name].code}</p>
                          </div>
                          <div className="flex gap-0.5">
                            {Array.from({ length: 6 }).map((_, i) => (
                              <div key={i} className={cn("w-0.5 h-0.5 rounded-full", i < (6-promos[name].difficulty) ? "bg-zinc-700" : "bg-zinc-300")} />
                            ))}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </section>
              )}

              {activePanel === 'print' && (
                <section className="space-y-8 flex flex-col h-full">
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">{t('printOptions')}</h2>
                      {isDoubleSided && (
                        <div className="flex bg-zinc-900 p-1 rounded-lg border border-zinc-800 shrink-0">
                          {(['front', 'back'] as const).map(side => (
                            <button 
                              key={side}
                              onClick={() => setActiveSide(side)}
                              className={cn(
                                "px-3 py-1 text-[10px] font-bold uppercase rounded-md transition-all",
                                activeSide === side ? "bg-zinc-800 text-white shadow-sm" : "text-zinc-500"
                              )}
                            >
                              {t(side)}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-medium text-zinc-400">{t('doubleSided')}</label>
                        <button onClick={() => setIsDoubleSided(!isDoubleSided)} className={cn("w-12 h-6 rounded-full transition-all relative", isDoubleSided ? "bg-white" : "bg-zinc-800")}>
                          <div className={cn("absolute top-1 w-4 h-4 rounded-full transition-all", isDoubleSided ? "right-1 bg-black" : "left-1 bg-zinc-600")} />
                        </button>
                      </div>
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-medium text-zinc-400">{t('printerFriendly')}</label>
                        <button onClick={() => setPrinterFriendly(!printerFriendly)} className={cn("w-12 h-6 rounded-full transition-all relative", printerFriendly ? "bg-white" : "bg-zinc-800")}>
                          <div className={cn("absolute top-1 w-4 h-4 rounded-full transition-all", printerFriendly ? "right-1 bg-black" : "left-1 bg-zinc-600")} />
                        </button>
                      </div>
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-medium text-zinc-400">{t('blackFrame')}</label>
                        <button onClick={() => setShowBlackFrame(!showBlackFrame)} className={cn("w-12 h-6 rounded-full transition-all relative", showBlackFrame ? "bg-white" : "bg-zinc-800")}>
                          <div className={cn("absolute top-1 w-4 h-4 rounded-full transition-all", showBlackFrame ? "right-1 bg-black" : "left-1 bg-zinc-600")} />
                        </button>
                      </div>
                      <div className="flex items-center justify-between">
                        <label className={cn("text-xs font-medium transition-colors", showBlackFrame ? "text-zinc-600" : "text-zinc-400")}>{t('cropMarks')}</label>
                        <button 
                          disabled={showBlackFrame}
                          onClick={() => setShowCropMarks(!showCropMarks)} 
                          className={cn("w-12 h-6 rounded-full transition-all relative", (showCropMarks || showBlackFrame) ? "bg-white" : "bg-zinc-800", showBlackFrame && "opacity-50")}
                        >
                          <div className={cn("absolute top-1 w-4 h-4 rounded-full transition-all", (showCropMarks || showBlackFrame) ? "right-1 bg-black" : "left-1 bg-zinc-600")} />
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 flex flex-col min-h-0 space-y-4">
                    <div className="flex items-center justify-between">
                      <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">{t('printQueue')}</h2>
                      {queue.length > 0 && (
                        <button onClick={() => setQueue([])} className="text-[8px] font-bold uppercase tracking-widest text-red-500 hover:text-red-400 transition-colors">
                          {t('clearQueue')}
                        </button>
                      )}
                    </div>
                    
                    <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                      {queue.length === 0 ? (
                        <div className="py-12 text-center text-zinc-700 space-y-4">
                          <Printer size={48} strokeWidth={1} className="mx-auto" />
                          <p className="text-xs">{t('queueEmpty')}</p>
                        </div>
                      ) : (
                        queue.map((item, idx) => (
                          <div key={item.id} className="premium-panel rounded-xl p-3 flex items-center gap-3 group">
                            <div className="w-12 h-10 bg-zinc-900 rounded-lg overflow-hidden flex items-center justify-center border border-zinc-800 shrink-0">
                              <Card data={item.card} activeCellIndex={null} scale={0.15} hideShadow />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="text-white font-bold text-[10px] truncate">{item.card.title}</h3>
                              <p className="text-zinc-600 text-[8px] uppercase tracking-widest font-bold">
                                {isDoubleSided 
                                  ? `${Math.floor(idx / 2) + 1}. ${idx % 2 === 0 ? t('front') : t('back')}`
                                  : `#${idx + 1}`}
                              </p>
                            </div>
                            <div className="flex items-center gap-1">
                              <button 
                                onClick={() => moveQueueItem(idx, 'up')}
                                disabled={idx === 0}
                                className="w-6 h-6 flex items-center justify-center text-zinc-700 hover:text-white transition-colors disabled:opacity-0"
                              >
                                <ChevronRight size={14} className="-rotate-90" />
                              </button>
                              <button 
                                onClick={() => moveQueueItem(idx, 'down')}
                                disabled={idx === queue.length - 1}
                                className="w-6 h-6 flex items-center justify-center text-zinc-700 hover:text-white transition-colors disabled:opacity-0"
                              >
                                <ChevronRight size={14} className="rotate-90" />
                              </button>
                              <button 
                                onClick={() => setQueue(prev => prev.filter((_, i) => i !== idx))}
                                className="w-8 h-8 flex items-center justify-center text-zinc-700 hover:text-red-500 transition-colors"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <button 
                    onClick={handleExportPDF} 
                    disabled={queue.length === 0 || isGenerating}
                    className="w-full premium-button-primary justify-center py-4 rounded-2xl shadow-xl shadow-white/5"
                  >
                    {isGenerating ? <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" /> : <Printer size={20} />}
                    <span className="font-bold">{t('exportPDF')}</span>
                  </button>
                </section>
              )}

              {activePanel === 'settings' && (
                <section className="space-y-8 h-full overflow-y-auto pr-2 custom-scrollbar">
                  <div className="space-y-6">
                    <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">{t('appearanceSettings')}</h2>
                    <div className="space-y-6">
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <label className="text-xs font-medium text-zinc-400">{t('zoom')}</label>
                          <span className="text-xs font-bold text-white">{Math.round(previewScale * 100)}%</span>
                        </div>
                        <input type="range" min="0.5" max="1.5" step="0.05" value={previewScale} onChange={(e) => setPreviewScale(parseFloat(e.target.value))} className="w-full accent-white" />
                      </div>

                      <div className="flex items-center justify-between pt-4 border-t border-zinc-800/20">
                        <label className="text-xs font-medium text-zinc-400">{t('liveValidator')}</label>
                        <button 
                          onClick={() => setIsValidatorEnabled(!isValidatorEnabled)}
                          className={cn("w-12 h-6 rounded-full transition-all relative", isValidatorEnabled ? "bg-white" : "bg-zinc-800")}
                        >
                          <div className={cn("absolute top-1 w-4 h-4 rounded-full transition-all shadow-sm", isValidatorEnabled ? "right-1 bg-black" : "left-1 bg-zinc-600")} />
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="pt-8 space-y-4 border-t border-zinc-800/50">
                    <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">{t('dataManagement')}</h2>
                    <div className="space-y-3">
                      <button onClick={() => fileInputRef.current?.click()} className="w-full premium-button-secondary justify-center py-3">
                        <Upload size={18} />
                        <span>{t('importCards')}</span>
                      </button>
                      <button onClick={() => handleExport(customCards, 'sagrada-patterns')} className="w-full premium-button-secondary justify-center py-3">
                        <Download size={18} />
                        <span>{t('exportOwn')}</span>
                      </button>
                    </div>
                  </div>
                </section>
              )}
            </div>
          </motion.aside>
        </AnimatePresence>

        {/* Center: Main View */}
        <div className="flex-1 bg-[#050505] flex flex-col relative overflow-hidden no-scrollbar">
          <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '32px 32px' }}></div>
          
          <div className="flex-1 flex flex-col items-center justify-center p-8 relative overflow-hidden no-scrollbar">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center justify-center gap-12 w-full h-full"
            >
              <div className="preview-card-container preview-glow shrink-0 z-10" style={{ transform: `scale(${previewScale})`, transition: 'transform 0.2s ease' }}>
                <Card 
                  data={currentCard}
                  activeCellIndex={activeCell?.side === activeSide ? activeCell.index : null}
                  onCellClick={(idx) => handleCellClick(activeSide, idx)}
                  onDifficultyChange={(diff) => setCurrentCard(prev => ({ ...prev, difficulty: diff }))}
                  onTitleChange={(title) => setCurrentCard(prev => ({ ...prev, title }))}
                  editable={true}
                  cornerRadius={cornerRadius}
                  printerFriendly={printerFriendly}
                  showCropMarks={showBlackFrame ? true : showCropMarks}
                  showBlackFrame={showBlackFrame}
                />
              </div>
              
              <div className="flex gap-4 items-center scale-110 z-20 bg-[#050505]/80 backdrop-blur-md p-4 rounded-2xl border border-zinc-800 shadow-2xl">
                <button 
                  onClick={() => addToQueue()} 
                  className="premium-button-primary px-6 py-3 text-xs rounded-xl"
                >
                  <Plus size={18} />
                  <span>{t('addToPrintList')}</span>
                </button>
                <button 
                  onClick={() => saveCard(editingCustomCardIndex !== null)}
                  className="premium-button-secondary px-6 py-3 text-xs rounded-xl"
                >
                  <Save size={18} />
                  <span>{editingCustomCardIndex !== null ? t('cardUpdated') : t('savePattern')}</span>
                </button>
                <button 
                  onClick={resetCurrentCard}
                  className="bg-zinc-900 border border-zinc-800 text-zinc-500 hover:text-white px-6 py-3 rounded-xl text-xs font-bold uppercase transition-all flex items-center gap-2"
                >
                  <RotateCcw size={18} />
                  <span>{t('reset')}</span>
                </button>
              </div>
            </motion.div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-zinc-950 border-t border-zinc-900 px-6 py-4 flex items-center justify-between text-zinc-600 text-[10px] font-bold uppercase tracking-widest">
        <div>© 2026 Sagrada Pattern Designer. {t('allRightsReserved')}</div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]"></div>
            <span>{t('systemOnline')}</span>
          </div>
          <span>{t('version')}: 0.1.6.0-beta</span>
        </div>
      </footer>

      <AnimatePresence>
        {showWiki && <Wiki onClose={() => setShowWiki(false)} t={t} language={language} />}
      </AnimatePresence>

      {/* Notification */}
      <AnimatePresence>
        {notification && (
          <motion.div 
            initial={{ opacity: 0, y: 50, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 50, x: '-50%' }}
            className={cn(
              "fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 rounded-xl shadow-2xl font-bold flex items-center gap-3 border",
              notification.type === 'success' ? "bg-zinc-900 text-white border-zinc-700" : "bg-red-950 text-red-200 border-red-900"
            )}
          >
            {notification.type === 'success' ? <Check size={18} className="text-green-500" /> : <Info size={18} className="text-red-500" />}
            {notification.message}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default App;
