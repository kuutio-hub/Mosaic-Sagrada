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
  ChevronDown,
  BookOpen
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
import { generateSagradaCard } from './services/cardGenerator';
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
  front: CardData;
  back: CardData | null;
  isDoubleSided: boolean;
}

const getValueSvgDataUrl = (value: string, color: string = 'W') => {
  if (value === '.' || value === 'X') return '';
  
  const dotColor = (color === 'W' || color === '.') ? '#333333' : 'white';
  const dotSize = 10;
  const dots: Record<string, string> = {
    '1': `<circle cx="50" cy="50" r="${dotSize}" fill="${dotColor}" />`,
    '2': `<circle cx="33" cy="33" r="${dotSize}" fill="${dotColor}" /><circle cx="67" cy="67" r="${dotSize}" fill="${dotColor}" />`,
    '3': `<circle cx="33" cy="33" r="${dotSize}" fill="${dotColor}" /><circle cx="50" cy="50" r="${dotSize}" fill="${dotColor}" /><circle cx="67" cy="67" r="${dotSize}" fill="${dotColor}" />`,
    '4': `<circle cx="33" cy="33" r="${dotSize}" fill="${dotColor}" /><circle cx="67" cy="33" r="${dotSize}" fill="${dotColor}" /><circle cx="33" cy="67" r="${dotSize}" fill="${dotColor}" /><circle cx="67" cy="67" r="${dotSize}" fill="${dotColor}" />`,
    '5': `<circle cx="33" cy="33" r="${dotSize}" fill="${dotColor}" /><circle cx="67" cy="33" r="${dotSize}" fill="${dotColor}" /><circle cx="50" cy="50" r="${dotSize}" fill="${dotColor}" /><circle cx="33" cy="67" r="${dotSize}" fill="${dotColor}" /><circle cx="67" cy="67" r="${dotSize}" fill="${dotColor}" />`,
    '6': `<circle cx="33" cy="33" r="${dotSize}" fill="${dotColor}" /><circle cx="67" cy="33" r="${dotSize}" fill="${dotColor}" /><circle cx="33" cy="50" r="${dotSize}" fill="${dotColor}" /><circle cx="67" cy="50" r="${dotSize}" fill="${dotColor}" /><circle cx="33" cy="67" r="${dotSize}" fill="${dotColor}" /><circle cx="67" cy="67" r="${dotSize}" fill="${dotColor}" />`
  };

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
      ${dots[value] || ''}
    </svg>
  `;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
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
  printerOpacity?: number;
  showCropMarks?: boolean;
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
  printerOpacity = 1,
  showCropMarks = false
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

  return (
    <div 
      id={id}
      className={cn(
        "card-container", 
        !hideShadow && "shadow-2xl", 
        printerFriendly && "printer-friendly",
        showCropMarks && "crop-marks",
        className
      )}
      style={{ 
        transform: `scale(${scale})`,
        transformOrigin: 'center',
        borderRadius: showCropMarks ? '0' : `${cornerRadius}mm`,
        opacity: printerFriendly ? printerOpacity : 1
      }}
    >
      <div className="card-grid">
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
          >
            {cell.color !== '.' && cell.color !== 'W' && (
              <div 
                className={cn(
                  "color-overlay", 
                  `c-${cell.color.toLowerCase()}`
                )} 
              />
            )}
            {cell.value !== '.' && (
              <>
                {cell.value === 'X' ? (
                  <span className="x-mark">X</span>
                ) : (
                  <img 
                    src={`/png/${cell.value}.png`}
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      const target = e.currentTarget as HTMLImageElement;
                      target.onerror = null;
                      // Fallback to GitHub raw
                      target.src = `https://raw.githubusercontent.com/kuutio-hub/Mosaic-Sagrada/main/png/${cell.value}.png`;
                      // Final fallback to SVG
                      target.onerror = () => {
                        target.onerror = null;
                        target.src = getValueSvgDataUrl(cell.value, cell.color);
                      };
                    }}
                    alt={cell.value}
                  />
                )}
              </>
            )}
          </div>
        ))}
      </div>

      <div className="card-footer" ref={containerRef}>
        <div className="card-title-container">
          <input 
            className="card-title bg-transparent border-none outline-none flex-1 min-w-0 hover:bg-white/5 focus:bg-white/10 rounded px-1 -ml-1 transition-colors" 
            value={data.title}
            onChange={(e) => onTitleChange?.(e.target.value)}
            style={{ 
              fontFamily: data.titleFont || '"Uncial Antiqua", serif',
              fontSize: adjustedFontSize ? `${adjustedFontSize}pt` : `${data.titleSize || 10}pt`
            }}
          />
          {data.code && <span className="card-code ml-2 opacity-40 shrink-0">{data.code}</span>}
        </div>
        <div className={cn("card-difficulty", editable && "editable")}>
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
  const [cornerRadius, setCornerRadius] = useState(0);
  const [previewScale, setPreviewScale] = useState(1);
  const [isColorsExpanded, setIsColorsExpanded] = useState(true);
  const [isValuesExpanded, setIsValuesExpanded] = useState(true);
  const [notification, setNotification] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
  const [showWiki, setShowWiki] = useState(false);
  const [selectedTool, setSelectedTool] = useState<{ type: 'color' | 'value', value: string } | null>(null);
  const [printerFriendly, setPrinterFriendly] = useState(false);
  const [showBackground, setShowBackground] = useState(true);
  const [printerOpacity, setPrinterOpacity] = useState(1);
  const [showCropMarks, setShowCropMarks] = useState(false);
  const [genOptions, setGenOptions] = useState({
    colorCount: 5,
    coloredCells: 6,
    valueCount: 6,
    valuedCells: 6,
    symmetric: false,
    horizontalSymmetry: false,
    verticalSymmetry: false
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
    if (savedCorner) setCornerRadius(parseInt(savedCorner));
    const savedPrinter = localStorage.getItem('sagrada_printerFriendly');
    if (savedPrinter) setPrinterFriendly(savedPrinter === 'true');
    const savedBg = localStorage.getItem('sagrada_showBackground');
    if (savedBg) setShowBackground(savedBg === 'true');
    const savedLang = localStorage.getItem('sagrada_language');
    if (savedLang) setLanguage(savedLang as any);

    fetch('/promos.json')
      .then(res => res.json())
      .then(data => setPromos(data))
      .catch(err => console.error("Failed to load promos:", err));

    const saved = localStorage.getItem('customCards');
    if (saved) {
      try { setCustomCards(JSON.parse(saved)); } catch (e) {}
    }
  }, []);

  useEffect(() => { localStorage.setItem('sagrada_previewScale', previewScale.toString()); }, [previewScale]);
  useEffect(() => { localStorage.setItem('sagrada_cornerRadius', cornerRadius.toString()); }, [cornerRadius]);
  useEffect(() => { localStorage.setItem('sagrada_printerFriendly', printerFriendly.toString()); }, [printerFriendly]);
  useEffect(() => { localStorage.setItem('sagrada_showBackground', showBackground.toString()); }, [showBackground]);
  useEffect(() => { localStorage.setItem('sagrada_language', language); }, [language]);

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

  const handleCellClick = (side: 'front' | 'back', index: number) => {
    if (selectedTool) {
      const updateFn = side === 'front' ? setFront : setBack;
      updateFn(prev => {
        const newCells = [...prev.cells];
        const cell = { ...newCells[index] };
        if (selectedTool.type === 'color') {
          if (cell.color === selectedTool.value) cell.color = '.';
          else { cell.color = selectedTool.value; cell.value = '.'; }
        } else {
          if (cell.value === selectedTool.value) { cell.value = '.'; cell.color = '.'; }
          else { cell.value = selectedTool.value; cell.color = '.'; }
        }
        newCells[index] = cell;
        return { ...prev, cells: newCells };
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
          if (cell.color === color) cell.color = '.';
          else { cell.color = color; cell.value = '.'; }
        }
        if (value !== undefined) {
          if (cell.value === value) { cell.value = '.'; cell.color = '.'; }
          else { cell.value = value; cell.color = '.'; }
        }
        newCells[index] = cell;
        return { ...prev, cells: newCells };
      });
    }
  };

  const addToQueue = () => {
    const newItem: QueueItem = {
      id: generateId(),
      front: isDoubleSided ? JSON.parse(JSON.stringify(front)) : JSON.parse(JSON.stringify(activeSide === 'front' ? front : back)),
      back: isDoubleSided ? JSON.parse(JSON.stringify(back)) : null,
      isDoubleSided
    };
    setQueue(prev => [...prev, newItem]);
    setActivePanel('queue');
  };

  const handleExportPDF = async () => {
    if (queue.length === 0) { alert(t('queueEmptyAlert')); return; }
    setIsGenerating(true);
    try { await generatePDF(queue, cornerRadius, printerFriendly, printerOpacity, showCropMarks); }
    catch (err) { console.error(err); alert(t('pdfError')); }
    finally { setIsGenerating(false); }
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-zinc-900/80 backdrop-blur-xl border-b border-zinc-800 px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-gradient-to-br from-white to-zinc-400 rounded-xl flex items-center justify-center text-black font-display text-2xl shadow-lg shadow-white/10">S</div>
          <h1 className="font-display text-2xl hidden sm:block text-white tracking-tight">{t('title')}</h1>
        </div>
        <nav className="flex items-center gap-2">
          {['editor', 'generator', 'saved'].map(panel => (
            <button 
              key={panel}
              onClick={() => setActivePanel(panel)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl transition-all font-bold text-sm",
                activePanel === panel ? "bg-white text-black shadow-lg shadow-white/10" : "text-zinc-500 hover:text-white hover:bg-zinc-800/50"
              )}
            >
              <span>{t(panel === 'saved' ? 'savedPatterns' : panel === 'generator' ? 'generation' : panel)}</span>
            </button>
          ))}
          <div className="w-px h-6 bg-zinc-800 mx-2 hidden md:block" />
          <button 
            onClick={() => setActivePanel('queue')}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl transition-all font-bold text-sm relative",
              activePanel === 'queue' ? "bg-white text-black shadow-lg shadow-white/10" : "text-zinc-500 hover:text-white hover:bg-zinc-800/50"
            )}
          >
            <Printer size={18} />
            <span className="hidden md:inline">{t('print')}</span>
            {queue.length > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-zinc-900 animate-in zoom-in">
                {queue.length}
              </span>
            )}
          </button>
          <button 
            onClick={() => setActivePanel('settings')}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl transition-all font-bold text-sm",
              activePanel === 'settings' ? "bg-white text-black shadow-lg shadow-white/10" : "text-zinc-500 hover:text-white hover:bg-zinc-800/50"
            )}
          >
            <Settings size={18} />
            <span className="hidden md:inline">{t('settings')}</span>
          </button>
          <div className="flex items-center bg-zinc-900 rounded-xl p-1 ml-4 border border-zinc-800">
            {(['hu', 'en', 'de'] as const).map(lang => (
              <button 
                key={lang}
                onClick={() => setLanguage(lang)}
                className={cn(
                  "px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all",
                  language === lang ? "bg-zinc-800 text-white shadow-inner" : "text-zinc-600 hover:text-zinc-400"
                )}
              >
                {lang}
              </button>
            ))}
          </div>
        </nav>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col md:flex-row overflow-hidden" onClick={() => setSelectedTool(null)}>
        {/* Left Sidebar */}
        <aside className="w-full md:w-80 bg-zinc-900/50 backdrop-blur-xl border-r border-zinc-800 flex flex-col overflow-y-auto shrink-0 z-40">
          <AnimatePresence mode="wait">
            {activePanel === 'editor' && (
              <motion.div 
                key="editor"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="p-6 space-y-8"
              >
                <section className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-500">{t('palette')}</h2>
                    {isDoubleSided && (
                      <div className="flex bg-zinc-800 p-1 rounded-lg">
                        {(['front', 'back'] as const).map(side => (
                          <button 
                            key={side}
                            onClick={() => setActiveSide(side)}
                            className={cn(
                              "px-3 py-1 text-xs font-bold rounded-md transition-all",
                              activeSide === side ? "bg-zinc-700 shadow-sm text-white" : "text-zinc-500"
                            )}
                          >
                            {t(side)}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="space-y-4">
                    {/* Colors */}
                    <div className="bg-zinc-900/50 rounded-xl border border-zinc-800 overflow-hidden">
                      <button 
                        onClick={() => setIsColorsExpanded(!isColorsExpanded)}
                        className="w-full px-4 py-3 flex items-center justify-between hover:bg-zinc-800/50 transition-colors"
                      >
                        <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">{t('colors')}</span>
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
                            <div className="grid grid-cols-3 gap-2">
                              {COLORS.filter(c => c.id !== '.').map(color => (
                                <button 
                                  key={color.id}
                                  onClick={(e) => { e.stopPropagation(); handlePickerSelect(color.id); }}
                                  className={cn(
                                    "aspect-square rounded-md border-2 transition-all flex items-center justify-center",
                                    selectedTool?.value === color.id ? "border-white scale-105 shadow-md" : "border-transparent hover:scale-105"
                                  )}
                                  style={{ backgroundColor: color.hex }}
                                  title={color.label}
                                />
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Values */}
                    <div className="bg-zinc-900/50 rounded-xl border border-zinc-800 overflow-hidden">
                      <button 
                        onClick={() => setIsValuesExpanded(!isValuesExpanded)}
                        className="w-full px-4 py-3 flex items-center justify-between hover:bg-zinc-800/50 transition-colors"
                      >
                        <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">{t('values')}</span>
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
                            <div className="grid grid-cols-3 gap-2">
                              {['1', '2', '3', '4', '5', '6', 'X', '.', '.'].map((val, idx) => {
                                if (idx === 8) return (
                                  <button 
                                    key="trash" 
                                    onClick={(e) => { e.stopPropagation(); handlePickerSelect(undefined, '.'); }}
                                    className="aspect-square rounded-md border-2 bg-zinc-800 flex items-center justify-center transition-all border-transparent hover:bg-zinc-700 hover:scale-105"
                                  >
                                    <Trash2 size={16} className="text-red-500" />
                                  </button>
                                );
                                if (idx === 7) return <div key="empty" />;
                                return (
                                  <button 
                                    key={val}
                                    onClick={(e) => { e.stopPropagation(); handlePickerSelect(undefined, val); }}
                                    className={cn(
                                      "aspect-square rounded-md border-2 bg-zinc-800 flex items-center justify-center transition-all overflow-hidden",
                                      selectedTool?.value === val ? "border-white bg-zinc-700 scale-105 shadow-md" : "border-transparent hover:bg-zinc-700 hover:scale-105"
                                    )}
                                  >
                                    {val === 'X' ? (
                                      <span className="font-display text-xl text-zinc-500">X</span>
                                    ) : (
                                      <img 
                                        src={`/png/${val}.png`} 
                                        className="w-full h-full object-contain" 
                                        onError={(e) => { 
                                          const target = e.currentTarget as HTMLImageElement;
                                          target.onerror = null; 
                                          target.src = getValueSvgDataUrl(val); 
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
                </section>

                <div className="pt-6 space-y-4 border-t border-zinc-800/50">
                  <button 
                    onClick={addToQueue}
                    className="w-full flex items-center justify-center gap-3 bg-white text-black py-4 rounded-2xl font-bold hover:bg-zinc-200 transition-all shadow-xl shadow-white/5 active:scale-95"
                  >
                    <Plus size={20} />
                    {t('addToQueue')}
                  </button>
                  <div className="grid grid-cols-2 gap-3">
                    <button 
                      onClick={() => saveCard(editingCustomCardIndex !== null)}
                      className={cn(
                        "flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold transition-all active:scale-95",
                        editingCustomCardIndex !== null ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20" : "bg-zinc-800 text-zinc-300 border border-zinc-700 hover:bg-zinc-700"
                      )}
                    >
                      <Download size={16} />
                      {editingCustomCardIndex !== null ? t('cardUpdated') : t('savePattern')}
                    </button>
                    <button 
                      onClick={() => setCurrentCard(prev => ({ ...prev, cells: createEmptyGrid() }))}
                      className="flex items-center justify-center gap-2 bg-zinc-900 border border-zinc-800 text-zinc-500 py-3 rounded-xl text-xs font-bold hover:text-red-500 hover:border-red-500/30 transition-all active:scale-95"
                    >
                      <Trash2 size={16} />
                      {t('clearQueue')}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {activePanel === 'generator' && (
              <motion.div 
                key="generator"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="p-6 space-y-8"
              >
                <section className="space-y-6">
                  <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-500">{t('generation')}</h2>
                  
                  <div className="space-y-6">
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <label className="text-xs font-medium text-zinc-400">{t('colorCount')}</label>
                        <span className="text-xs font-bold text-white">{genOptions.colorCount}</span>
                      </div>
                      <input 
                        type="range" min="1" max="5" 
                        value={genOptions.colorCount}
                        onChange={(e) => setGenOptions(prev => ({ ...prev, colorCount: parseInt(e.target.value) }))}
                        className="w-full accent-white"
                      />
                    </div>

                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <label className="text-xs font-medium text-zinc-400">{t('coloredCells')}</label>
                        <span className="text-xs font-bold text-white">{genOptions.coloredCells}</span>
                      </div>
                      <input 
                        type="range" min="0" max="20" 
                        value={genOptions.coloredCells}
                        onChange={(e) => setGenOptions(prev => ({ ...prev, coloredCells: parseInt(e.target.value) }))}
                        className="w-full accent-white"
                      />
                    </div>

                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <label className="text-xs font-medium text-zinc-400">{t('valueCount')}</label>
                        <span className="text-xs font-bold text-white">{genOptions.valueCount}</span>
                      </div>
                      <input 
                        type="range" min="1" max="6" 
                        value={genOptions.valueCount}
                        onChange={(e) => setGenOptions(prev => ({ ...prev, valueCount: parseInt(e.target.value) }))}
                        className="w-full accent-white"
                      />
                    </div>

                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <label className="text-xs font-medium text-zinc-400">{t('valuedCells')}</label>
                        <span className="text-xs font-bold text-white">{genOptions.valuedCells}</span>
                      </div>
                      <input 
                        type="range" min="0" max="20" 
                        value={genOptions.valuedCells}
                        onChange={(e) => setGenOptions(prev => ({ ...prev, valuedCells: parseInt(e.target.value) }))}
                        className="w-full accent-white"
                      />
                    </div>

                    <div className="space-y-3 pt-2">
                      <label className="flex items-center gap-3 cursor-pointer group">
                        <div className="relative">
                          <input 
                            type="checkbox" 
                            checked={genOptions.symmetric}
                            onChange={(e) => setGenOptions(prev => ({ ...prev, symmetric: e.target.checked }))}
                            className="sr-only"
                          />
                          <div className={cn("w-10 h-5 rounded-full transition-colors", genOptions.symmetric ? "bg-white" : "bg-zinc-800")} />
                          <div className={cn("absolute top-1 left-1 w-3 h-3 rounded-full bg-black transition-transform", genOptions.symmetric && "translate-x-5")} />
                        </div>
                        <span className="text-xs font-medium text-zinc-400 group-hover:text-white transition-colors">{t('symmetric')}</span>
                      </label>
                    </div>
                  </div>

                  <button 
                    onClick={() => {
                      const generated = generateSagradaCard(genOptions);
                      setCurrentCard(generated);
                      setEditingCustomCardIndex(null);
                      showNotification(t('cardGenerated'));
                    }}
                    className="w-full flex items-center justify-center gap-3 bg-white text-black py-4 rounded-2xl font-bold hover:bg-zinc-200 transition-all shadow-xl shadow-white/5 active:scale-95"
                  >
                    <Layout size={20} />
                    {t('generate')}
                  </button>
                </section>
              </motion.div>
            )}

            {activePanel === 'saved' && (
              <motion.div 
                key="saved"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex-1 flex flex-col min-h-0"
              >
                <div className="p-6 border-b border-zinc-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-500">{t('savedPatterns')}</h2>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-colors"
                        title={t('import')}
                      >
                        <Upload size={18} />
                      </button>
                      <button 
                        onClick={() => handleExport(customCards, 'sagrada_patterns')}
                        className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-colors"
                        title={t('export')}
                      >
                        <Download size={18} />
                      </button>
                    </div>
                  </div>
                  
                  <div className="flex bg-zinc-900 p-1 rounded-xl border border-zinc-800">
                    <button 
                      onClick={() => setLibraryTab('saved')}
                      className={cn(
                        "flex-1 py-2 text-xs font-bold rounded-lg transition-all",
                        libraryTab === 'saved' ? "bg-white text-black shadow-lg" : "text-zinc-500 hover:text-zinc-300"
                      )}
                    >
                      {t('myCards')}
                    </button>
                    <button 
                      onClick={() => setLibraryTab('promos')}
                      className={cn(
                        "flex-1 py-2 text-xs font-bold rounded-lg transition-all",
                        libraryTab === 'promos' ? "bg-white text-black shadow-lg" : "text-zinc-500 hover:text-zinc-300"
                      )}
                    >
                      {t('promos')}
                    </button>
                  </div>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {libraryTab === 'saved' ? (
                    customCards.length === 0 ? (
                      <div className="text-center py-12 space-y-4">
                        <div className="w-16 h-16 bg-zinc-900 rounded-full flex items-center justify-center mx-auto text-zinc-700">
                          <BookOpen size={32} />
                        </div>
                        <p className="text-xs text-zinc-600 font-medium">{t('noSavedPatterns')}</p>
                      </div>
                    ) : (
                      customCards.map((card, idx) => (
                        <div 
                          key={idx}
                          className={cn(
                            "group p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between",
                            editingCustomCardIndex === idx 
                              ? "bg-white border-white shadow-xl shadow-white/10" 
                              : "bg-zinc-900/50 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/50"
                          )}
                          onClick={() => loadCustomCard(idx)}
                        >
                          <div className="flex items-center gap-3 min-width-0">
                            <div className={cn(
                              "w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs",
                              editingCustomCardIndex === idx ? "bg-zinc-900 text-white" : "bg-zinc-800 text-zinc-400"
                            )}>
                              {card.difficulty}
                            </div>
                            <span className={cn(
                              "text-xs font-bold truncate max-w-[120px]",
                              editingCustomCardIndex === idx ? "text-black" : "text-white"
                            )}>
                              {card.title}
                            </span>
                          </div>
                          <button 
                            onClick={(e) => { e.stopPropagation(); deleteCustomCard(idx); }}
                            className={cn(
                              "p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-all",
                              editingCustomCardIndex === idx ? "hover:bg-zinc-100 text-zinc-400 hover:text-red-500" : "hover:bg-zinc-800 text-zinc-600 hover:text-red-500"
                            )}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))
                    )
                  ) : (
                    Object.keys(promos).map(name => (
                      <div 
                        key={name}
                        className="group p-4 rounded-2xl border bg-zinc-900/50 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/50 transition-all cursor-pointer flex items-center justify-between"
                        onClick={() => loadPromo(name)}
                      >
                        <div className="flex items-center gap-3 min-width-0">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs bg-zinc-800 text-zinc-400">
                            {promos[name].difficulty}
                          </div>
                          <span className="text-xs font-bold truncate max-w-[160px] text-white">
                            {name}
                          </span>
                        </div>
                        <ChevronRight size={16} className="text-zinc-700 group-hover:text-zinc-400 transition-colors" />
                      </div>
                    ))
                  )}
                </div>
              </motion.div>
            )}

            {activePanel === 'queue' && (
              <motion.div 
                key="queue"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex-1 flex flex-col min-h-0"
              >
                <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
                  <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-500">{t('printQueue')}</h2>
                  <button 
                    onClick={() => setQueue([])}
                    className="text-[10px] font-bold text-zinc-600 hover:text-red-500 uppercase tracking-widest transition-colors"
                  >
                    {t('clearAll')}
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {queue.length === 0 ? (
                    <div className="text-center py-12 space-y-4">
                      <div className="w-16 h-16 bg-zinc-900 rounded-full flex items-center justify-center mx-auto text-zinc-700">
                        <Printer size={32} />
                      </div>
                      <p className="text-xs text-zinc-600 font-medium">{t('queueEmpty')}</p>
                    </div>
                  ) : (
                    queue.map((item, idx) => (
                      <div key={item.id} className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden group">
                        <div className="p-3 bg-zinc-800/50 flex items-center justify-between border-b border-zinc-800">
                          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">#{idx + 1}</span>
                          <button 
                            onClick={() => setQueue(prev => prev.filter(q => q.id !== item.id))}
                            className="text-zinc-600 hover:text-red-500 transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                        <div className="p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-white truncate max-w-[140px]">{item.front.title}</span>
                            <span className="text-[10px] font-bold text-zinc-500">{item.isDoubleSided ? '2-SIDED' : '1-SIDED'}</span>
                          </div>
                          <div className="flex gap-1">
                            <div className="flex-1 h-1 bg-zinc-800 rounded-full overflow-hidden">
                              <div className="h-full bg-white" style={{ width: `${(item.front.difficulty / 6) * 100}%` }} />
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="p-6 bg-zinc-900 border-t border-zinc-800 space-y-4">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-zinc-500 uppercase tracking-widest">{t('totalCards')}</span>
                    <span className="text-white">{queue.length}</span>
                  </div>
                  <button 
                    onClick={handleExportPDF}
                    disabled={queue.length === 0 || isGenerating}
                    className={cn(
                      "w-full flex items-center justify-center gap-3 py-4 rounded-xl font-bold transition-all shadow-lg active:scale-95",
                      queue.length === 0 || isGenerating ? "bg-zinc-800 text-zinc-600 cursor-not-allowed" : "bg-white text-black hover:bg-zinc-200"
                    )}
                  >
                    {isGenerating ? (
                      <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Download size={20} />
                    )}
                    {isGenerating ? t('generating') : t('downloadPDF')}
                  </button>
                </div>
              </motion.div>
            )}

            {activePanel === 'settings' && (
              <motion.div 
                key="settings"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="p-6 space-y-8"
              >
                <section className="space-y-6">
                  <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-500">{t('settings')}</h2>
                  
                  <div className="space-y-6">
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <label className="text-xs font-medium text-zinc-400">{t('previewScale')}</label>
                        <span className="text-xs font-bold text-white">{Math.round(previewScale * 100)}%</span>
                      </div>
                      <input 
                        type="range" min="0.5" max="1.5" step="0.1"
                        value={previewScale}
                        onChange={(e) => setPreviewScale(parseFloat(e.target.value))}
                        className="w-full accent-white"
                      />
                    </div>

                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <label className="text-xs font-medium text-zinc-400">{t('cornerRadius')}</label>
                        <span className="text-xs font-bold text-white">{cornerRadius}mm</span>
                      </div>
                      <input 
                        type="range" min="0" max="10" 
                        value={cornerRadius}
                        onChange={(e) => setCornerRadius(parseInt(e.target.value))}
                        className="w-full accent-white"
                      />
                    </div>

                    <div className="space-y-4 pt-4 border-t border-zinc-800">
                      <label className="flex items-center gap-3 cursor-pointer group">
                        <div className="relative">
                          <input 
                            type="checkbox" 
                            checked={isDoubleSided}
                            onChange={(e) => setIsDoubleSided(e.target.checked)}
                            className="sr-only"
                          />
                          <div className={cn("w-10 h-5 rounded-full transition-colors", isDoubleSided ? "bg-white" : "bg-zinc-800")} />
                          <div className={cn("absolute top-1 left-1 w-3 h-3 rounded-full bg-black transition-transform", isDoubleSided && "translate-x-5")} />
                        </div>
                        <span className="text-xs font-medium text-zinc-400 group-hover:text-white transition-colors">{t('doubleSided')}</span>
                      </label>

                      <label className="flex items-center gap-3 cursor-pointer group">
                        <div className="relative">
                          <input 
                            type="checkbox" 
                            checked={printerFriendly}
                            onChange={(e) => setPrinterFriendly(e.target.checked)}
                            className="sr-only"
                          />
                          <div className={cn("w-10 h-5 rounded-full transition-colors", printerFriendly ? "bg-white" : "bg-zinc-800")} />
                          <div className={cn("absolute top-1 left-1 w-3 h-3 rounded-full bg-black transition-transform", printerFriendly && "translate-x-5")} />
                        </div>
                        <span className="text-xs font-medium text-zinc-400 group-hover:text-white transition-colors">{t('printerFriendly')}</span>
                      </label>

                      <label className="flex items-center gap-3 cursor-pointer group">
                        <div className="relative">
                          <input 
                            type="checkbox" 
                            checked={showCropMarks}
                            onChange={(e) => setShowCropMarks(e.target.checked)}
                            className="sr-only"
                          />
                          <div className={cn("w-10 h-5 rounded-full transition-colors", showCropMarks ? "bg-white" : "bg-zinc-800")} />
                          <div className={cn("absolute top-1 left-1 w-3 h-3 rounded-full bg-black transition-transform", showCropMarks && "translate-x-5")} />
                        </div>
                        <span className="text-xs font-medium text-zinc-400 group-hover:text-white transition-colors">{t('showCropMarks')}</span>
                      </label>

                      <label className="flex items-center gap-3 cursor-pointer group">
                        <div className="relative">
                          <input 
                            type="checkbox" 
                            checked={showBackground}
                            onChange={(e) => setShowBackground(e.target.checked)}
                            className="sr-only"
                          />
                          <div className={cn("w-10 h-5 rounded-full transition-colors", showBackground ? "bg-white" : "bg-zinc-800")} />
                          <div className={cn("absolute top-1 left-1 w-3 h-3 rounded-full bg-black transition-transform", showBackground && "translate-x-5")} />
                        </div>
                        <span className="text-xs font-medium text-zinc-400 group-hover:text-white transition-colors">{t('showBackground')}</span>
                      </label>
                    </div>
                  </div>
                </section>
              </motion.div>
            )}
          </AnimatePresence>
        </aside>

        {/* Preview Area */}
        <section 
          className="flex-1 bg-zinc-950 flex flex-col items-center justify-center p-8 relative overflow-hidden" 
          onClick={() => { setActiveCell(null); setSelectedTool(null); }}
          style={showBackground ? { 
            background: 'radial-gradient(circle at center, #18181b 0%, #09090b 100%)',
            backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.03) 1px, transparent 0)', 
            backgroundSize: '24px 24px' 
          } : { background: '#000' }}
        >
          <div className="absolute top-6 right-6 flex items-center gap-3 z-10">
            <div className="relative group">
              <button className="w-10 h-10 bg-zinc-900 border border-zinc-800 rounded-full flex items-center justify-center text-zinc-400 hover:bg-zinc-800 hover:text-white transition-all shadow-lg">
                <Layers size={18} />
              </button>
              <div className="absolute top-full right-0 mt-2 w-64 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all p-2 z-50">
                <div className="max-h-96 overflow-y-auto">
                  <div className="px-3 py-2 text-[10px] font-bold text-zinc-500 uppercase tracking-widest border-b border-zinc-800 mb-1">{t('promos')}</div>
                  {Object.keys(promos).map(name => (
                    <button 
                      key={name}
                      onClick={() => loadPromo(name)}
                      className="w-full text-left px-3 py-2 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-white rounded-lg transition-colors flex items-center justify-between"
                    >
                      <span>{name}</span>
                      <ChevronRight size={12} className="text-zinc-700" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <button 
              onClick={() => setShowWiki(!showWiki)}
              className="w-10 h-10 bg-zinc-900 border border-zinc-800 rounded-full flex items-center justify-center text-zinc-400 hover:bg-zinc-800 hover:text-white transition-all shadow-lg"
            >
              <BookOpen size={18} />
            </button>
          </div>
          {isDoubleSided && (
            <div className="absolute top-6 left-1/2 -translate-x-1/2 flex items-center gap-4 z-10">
              <button 
                onClick={() => setActiveSide('front')} 
                className={cn(
                  "px-4 py-2 rounded-full text-xs font-bold transition-all shadow-sm",
                  activeSide === 'front' ? "bg-white text-black scale-110" : "bg-zinc-800 text-zinc-500"
                )}
              >
                {t('front')}
              </button>
              <button 
                onClick={() => setActiveSide(activeSide === 'front' ? 'back' : 'front')}
                className="w-10 h-10 bg-zinc-800 rounded-full flex items-center justify-center shadow-md hover:scale-110 transition-transform text-zinc-400"
              >
                <FlipHorizontal size={20} />
              </button>
              <button 
                onClick={() => setActiveSide('back')} 
                className={cn(
                  "px-4 py-2 rounded-full text-xs font-bold transition-all shadow-sm",
                  activeSide === 'back' ? "bg-white text-black scale-110" : "bg-zinc-800 text-zinc-500"
                )}
              >
                {t('back')}
              </button>
            </div>
          )}
          <div className="preview-card-wrapper" onClick={(e) => e.stopPropagation()}>
            <div className="flex flex-col items-center gap-8">
              <div className="preview-card-container preview-glow" style={{ transform: `scale(${previewScale})` }}>
                <Card 
                  data={currentCard}
                  activeCellIndex={activeCell?.side === activeSide ? activeCell.index : null}
                  onCellClick={(idx) => handleCellClick(activeSide, idx)}
                  onDifficultyChange={(diff) => setCurrentCard(prev => ({ ...prev, difficulty: diff }))}
                  onTitleChange={(title) => setCurrentCard(prev => ({ ...prev, title }))}
                  cornerRadius={cornerRadius}
                  editable={true}
                />
              </div>
              
              <motion.button 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={addToQueue}
                className="flex items-center gap-3 bg-white text-black px-8 py-4 rounded-2xl font-bold shadow-2xl shadow-white/10"
              >
                <Plus size={20} />
                {t('addToQueue')}
              </motion.button>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-zinc-950 border-t border-zinc-900 px-6 py-4 flex items-center justify-between text-zinc-600 text-[10px] font-bold uppercase tracking-widest">
        <div>© 2026 Sagrada Pattern Designer. {t('allRightsReserved')}</div>
        <div className="flex items-center gap-4">
          <span>Design by: hrvthgrgly@gmail.com</span>
          <span>{t('version')}: v1.3.0</span>
        </div>
      </footer>

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
