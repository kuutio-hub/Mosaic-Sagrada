import React, { useState, useEffect, useRef } from 'react';
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
  BookOpen,
  Globe
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  CardData, 
  CellData, 
  PatternQueueItem, 
  Color, 
  Value,
  PromoCards,
  PromoCard
} from './types';
import { 
  DEFAULT_FRONT, 
  DEFAULT_BACK, 
  COLORS, 
  VALUES, 
  createEmptyGrid 
} from './constants';
import { cn, generateId } from './lib/utils';
import { generatePDF } from './services/pdfService';
import { generateSagradaCard } from './services/cardGenerator';
import { translations, Language } from './i18n';

const getValueSvgDataUrl = (value: string, color: string = 'W') => {
  if (value === '.' || value === 'X') return '';
  
  const textColor = (color === 'W' || color === '.') ? '#333333' : 'white';
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
      <text x="50" y="50" dominant-baseline="central" text-anchor="middle" font-family="sans-serif" font-weight="bold" font-size="65" fill="${textColor}">${value}</text>
    </svg>
  `;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
};

const App: React.FC = () => {
  const [front, setFront] = useState<CardData>(JSON.parse(JSON.stringify(DEFAULT_FRONT)));
  const [back, setBack] = useState<CardData>(JSON.parse(JSON.stringify(DEFAULT_BACK)));
  const [queue, setQueue] = useState<PatternQueueItem[]>([]);
  const [activeSide, setActiveSide] = useState<'front' | 'back'>('front');
  const [isDoubleSided, setIsDoubleSided] = useState(true);
  const [activeCell, setActiveCell] = useState<{ side: 'front' | 'back', index: number } | null>(null);
  const [activePanel, setActivePanel] = useState<'editor' | 'queue' | 'settings'>('editor');
  const [isGenerating, setIsGenerating] = useState(false);
  const [promos, setPromos] = useState<PromoCards>({});
  const [customCards, setCustomCards] = useState<CardData[]>([]);
  const [editingCustomCardIndex, setEditingCustomCardIndex] = useState<number | null>(null);
  const [cornerRadius, setCornerRadius] = useState(0);
  const [previewScale, setPreviewScale] = useState(1);
  const [isColorsExpanded, setIsColorsExpanded] = useState(true);
  const [isValuesExpanded, setIsValuesExpanded] = useState(true);
  const [notification, setNotification] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
  const [showGeneratorModal, setShowGeneratorModal] = useState(false);
  const [showWiki, setShowWiki] = useState(false);
  const [selectedTool, setSelectedTool] = useState<{ type: 'color' | 'value', value: Color | Value } | null>(null);
  const [printerFriendly, setPrinterFriendly] = useState(false);
  const [printerOpacity, setPrinterOpacity] = useState(100);
  const [showCropMarks, setShowCropMarks] = useState(false);
  const [showBackground, setShowBackground] = useState(true);
  const [genOptions, setGenOptions] = useState({
    colorCount: 5,
    coloredCells: 6,
    valueCount: 6,
    valuedCells: 6
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [language, setLanguage] = useState<Language>('hu');

  const t = (key: keyof typeof translations['hu'], params?: Record<string, string | number>) => {
    let text = translations[language][key] || translations['hu'][key] || key;
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        text = text.replace(`{{${k}}}`, String(v));
      });
    }
    return text;
  };

  const currentCard = activeSide === 'front' ? front : back;
  const setCurrentCard = activeSide === 'front' ? setFront : setBack;

  // Notification timer
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Persistence
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
    if (savedLang) setLanguage(savedLang as Language);
  }, []);

  useEffect(() => {
    localStorage.setItem('sagrada_previewScale', previewScale.toString());
  }, [previewScale]);

  useEffect(() => {
    localStorage.setItem('sagrada_cornerRadius', cornerRadius.toString());
  }, [cornerRadius]);

  useEffect(() => {
    localStorage.setItem('sagrada_printerFriendly', printerFriendly.toString());
  }, [printerFriendly]);

  useEffect(() => {
    localStorage.setItem('sagrada_showBackground', showBackground.toString());
  }, [showBackground]);

  useEffect(() => {
    localStorage.setItem('sagrada_language', language);
  }, [language]);

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
  };

  // Load promos and custom cards
  useEffect(() => {
    fetch('/promos.json')
      .then(res => res.json())
      .then(data => setPromos(data))
      .catch(err => console.error("Failed to load promos:", err));

    const saved = localStorage.getItem('customCards');
    if (saved) {
      try {
        setCustomCards(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse customCards:", e);
      }
    }
  }, []);

  // Helper to parse pattern string
  const parsePattern = (pattern: string[]): CellData[] => {
    const cells: CellData[] = [];
    pattern.forEach(row => {
      for (let i = 0; i < row.length; i++) {
        const char = row[i].toLowerCase();
        const cell: CellData = { color: '.', value: '.' };
        
        if (char >= '1' && char <= '6') {
          cell.value = char as Value;
        } else if (char === 'r') {
          cell.color = 'R';
        } else if (char === 'g') {
          cell.color = 'G';
        } else if (char === 'b') {
          cell.color = 'B';
        } else if (char === 'y') {
          cell.color = 'Y';
        } else if (char === 'p') {
          cell.color = 'P';
        } else if (char === 'w') {
          cell.color = 'W';
        } else if (char === 'x') {
          cell.value = 'X';
        }
        // 'w' or any other char remains empty
        cells.push(cell);
      }
    });
    return cells;
  };

  const serializePattern = (cells: CellData[]): string[] => {
    const pattern: string[] = [];
    for (let r = 0; r < 4; r++) {
      let row = "";
      for (let c = 0; c < 5; c++) {
        const cell = cells[r * 5 + c];
        if (cell.value !== '.') {
          row += cell.value;
        } else if (cell.color !== '.') {
          row += cell.color.toLowerCase();
        } else {
          row += ".";
        }
      }
      pattern.push(row);
    }
    return pattern;
  };

  // Load a promo card
  const loadPromo = (name: string) => {
    const promo = promos[name];
    if (!promo) return;

    const newCard: CardData = {
      title: name,
      difficulty: promo.difficulty,
      cells: parsePattern(promo.pattern),
      code: promo.code
    };

    setCurrentCard(newCard);
    setEditingCustomCardIndex(null);
  };

  // Save current card to local storage
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

  // Load a custom card
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

  // Export JSON
  const handleExport = (cards: CardData[], filename: string) => {
    const simplified = cards.map(c => ({
      title: c.title,
      difficulty: c.difficulty,
      pattern: serializePattern(c.cells),
      code: c.code,
      titleFont: c.titleFont,
      titleSize: c.titleSize,
      cornerRadius: c.cornerRadius
    }));

    const blob = new Blob([JSON.stringify(simplified, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Import JSON
  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target?.result as string);
        const items = Array.isArray(imported) ? imported : [imported];
        
        const validCards: CardData[] = items.map(item => {
          // Simplified format
          if (item.pattern && Array.isArray(item.pattern)) {
            return {
              title: item.title || "Névtelen",
              difficulty: item.difficulty || 1,
              cells: parsePattern(item.pattern),
              code: item.code,
              titleFont: item.titleFont,
              titleSize: item.titleSize,
              cornerRadius: item.cornerRadius
            };
          }
          // Old format
          if (item.cells && Array.isArray(item.cells)) {
            return {
              ...item,
              cells: item.cells
            } as CardData;
          }
          return null;
        }).filter((c): c is CardData => c !== null && c.cells.length === 20);
        
        if (validCards.length > 0) {
          const merged = [...customCards, ...validCards];
          setCustomCards(merged);
          localStorage.setItem('customCards', JSON.stringify(merged));
          showNotification(t('importSuccessCount', { count: validCards.length }));
        } else {
          showNotification(t('invalidFile'), 'error');
        }
      } catch (err) {
        showNotification(t('importError'), 'error');
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Handle cell click
  const handleCellClick = (side: 'front' | 'back', index: number) => {
    if (selectedTool) {
      // Apply selected tool directly
      const updateFn = side === 'front' ? setFront : setBack;
      updateFn(prev => {
        const newCells = [...prev.cells];
        const cell = { ...newCells[index] };

        if (selectedTool.type === 'color') {
          const color = selectedTool.value as Color;
          if (cell.color === color) {
            cell.color = '.';
          } else {
            cell.color = color;
            cell.value = '.';
          }
        } else {
          const value = selectedTool.value as Value;
          if (cell.value === value) {
            cell.value = '.';
            cell.color = '.';
          } else {
            cell.value = value;
            cell.color = '.';
          }
        }

        newCells[index] = cell;
        return { ...prev, cells: newCells };
      });
    } else {
      setActiveCell({ side, index });
    }
  };

  // Handle picker selection
  const handlePickerSelect = (color?: Color, value?: Value) => {
    if (color) {
      setSelectedTool({ type: 'color', value: color });
      setActiveCell(null);
    } else if (value) {
      setSelectedTool({ type: 'value', value: value });
      setActiveCell(null);
    } else if (activeCell) {
      const { side, index } = activeCell;
      const updateFn = side === 'front' ? setFront : setBack;

      updateFn(prev => {
        const newCells = [...prev.cells];
        const cell = { ...newCells[index] };

        if (color !== undefined) {
          if (cell.color === color) {
            cell.color = '.';
          } else {
            cell.color = color;
            cell.value = '.';
          }
        }
        
        if (value !== undefined) {
          if (cell.value === value) {
            cell.value = '.';
            cell.color = '.';
          } else {
            cell.value = value;
            cell.color = '.';
          }
        }

        newCells[index] = cell;
        return { ...prev, cells: newCells };
      });
    }
  };

  // Add to queue
  const addToQueue = () => {
    const newItem: PatternQueueItem = {
      id: generateId(),
      front: JSON.parse(JSON.stringify(front)),
      back: isDoubleSided ? JSON.parse(JSON.stringify(back)) : null,
      isDoubleSided
    };
    setQueue(prev => [...prev, newItem]);
    setActivePanel('queue');
  };

  // Remove from queue
  const removeFromQueue = (id: string) => {
    setQueue(prev => prev.filter(item => item.id !== id));
  };

  // Load from queue
  const loadFromQueue = (item: PatternQueueItem) => {
    setFront(JSON.parse(JSON.stringify(item.front)));
    if (item.back) {
      setBack(JSON.parse(JSON.stringify(item.back)));
      setIsDoubleSided(true);
    } else {
      setIsDoubleSided(false);
    }
    setActivePanel('editor');
  };

  // Handle PDF Export
  const handleExportPDF = async () => {
    if (queue.length === 0) {
      alert(t('queueEmptyAlert'));
      return;
    }
    setIsGenerating(true);
    try {
      await generatePDF(queue, cornerRadius, printerFriendly, printerOpacity, showCropMarks);
    } catch (err) {
      console.error(err);
      alert(t('pdfError'));
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-zinc-900 border-b border-zinc-800 px-4 py-3 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center text-black font-display text-xl">
            S
          </div>
          <h1 className="font-display text-xl hidden sm:block text-white">{t('title')}</h1>
        </div>

        <nav className="flex items-center gap-1 sm:gap-2">
          <button 
            onClick={() => setActivePanel('editor')}
            className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-lg transition-colors",
              activePanel === 'editor' ? "bg-white text-black" : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
            )}
          >
            <span className="font-bold">{t('editor')}</span>
          </button>
          <button 
            onClick={() => setShowGeneratorModal(true)}
            className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-lg transition-colors",
              "text-zinc-400 hover:bg-zinc-800 hover:text-white"
            )}
          >
            <span className="font-bold">{t('generation')}</span>
          </button>

          {/* Mentett minták (korábban Kártyatár) */}
          <div className="relative group/menu">
            <button className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-lg transition-colors",
              "text-zinc-400 hover:bg-zinc-800 hover:text-white"
            )}>
              <Layout size={18} />
              <span className="font-bold">{t('savedPatterns')}</span>
              <ChevronDown size={14} className="opacity-50" />
            </button>
            
            <div className="absolute top-full left-0 mt-2 w-64 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl opacity-0 invisible group-hover/menu:opacity-100 group-hover/menu:visible transition-all z-50 p-4 space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-1">{t('patternCards')}</label>
                <select 
                  onChange={(e) => loadPromo(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 text-white text-xs rounded-lg px-2 py-2 outline-none focus:ring-1 focus:ring-white"
                  defaultValue=""
                >
                  <option value="" disabled>{t('choosePattern')}</option>
                  {Object.keys(promos).map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-1">{t('myCards')}</label>
                <div className="flex items-center gap-1">
                  <select 
                    onChange={(e) => loadCustomCard(parseInt(e.target.value))}
                    className="flex-1 bg-zinc-800 border border-zinc-700 text-white text-xs rounded-lg px-2 py-2 outline-none focus:ring-1 focus:ring-white"
                    value={editingCustomCardIndex !== null ? editingCustomCardIndex : ""}
                  >
                    <option value="" disabled>{t('chooseOwn')}</option>
                    {customCards.map((card, idx) => (
                      <option key={idx} value={idx}>{card.title}</option>
                    ))}
                  </select>
                  {editingCustomCardIndex !== null && (
                    <button 
                      onClick={() => deleteCustomCard(editingCustomCardIndex)}
                      className="p-2 text-zinc-500 hover:text-red-500 hover:bg-zinc-800 rounded-lg transition-all"
                      title={t('deleteOwnCard')}
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          <button 
            onClick={() => setActivePanel('queue')}
            className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-lg transition-colors relative",
              activePanel === 'queue' ? "bg-white text-black" : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
            )}
          >
            <Printer size={18} />
            <span className="hidden md:inline">{t('print')}</span>
            {queue.length > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-zinc-900">
                {queue.length}
              </span>
            )}
          </button>
          <button 
            onClick={() => setActivePanel('settings')}
            className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-lg transition-colors",
              activePanel === 'settings' ? "bg-white text-black" : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
            )}
          >
            <Settings size={18} />
            <span className="hidden md:inline">{t('settings')}</span>
          </button>
          <button 
            onClick={() => setShowWiki(true)}
            className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-lg transition-colors",
              "text-zinc-400 hover:bg-zinc-800 hover:text-white"
            )}
          >
            <span className="font-bold">Wiki</span>
          </button>
        </nav>

        <div className="flex items-center gap-2">
          {/* Kártyatár eltávolítva innen, feljebb került */}
        </div>
      </header>

      {/* Main Content */}
      <main 
        className="flex-1 flex flex-col md:flex-row overflow-hidden"
        onClick={() => setSelectedTool(null)}
      >
        {/* Left Panel: Editor / Queue / Settings */}
        <aside className="w-full md:w-64 lg:w-72 bg-zinc-900 border-r border-zinc-800 flex flex-col overflow-y-auto shrink-0">
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
                  <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-500">{t('cardData')}</h2>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-medium text-zinc-500 mb-1 block">{t('cardName')}</label>
                      <input 
                        type="text" 
                        value={currentCard.title}
                        onChange={(e) => setCurrentCard(prev => ({ ...prev, title: e.target.value }))}
                        className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 text-white rounded-lg focus:ring-2 focus:ring-white focus:border-transparent outline-none transition-all"
                        placeholder={t('patternName')}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-zinc-500 mb-1 block">{t('altTitle')}</label>
                      <input 
                        type="text" 
                        value={currentCard.altTitle || ''}
                        onChange={(e) => setCurrentCard(prev => ({ ...prev, altTitle: e.target.value }))}
                        className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 text-white rounded-lg focus:ring-2 focus:ring-white focus:border-transparent outline-none transition-all"
                        placeholder={t('altTitle')}
                      />
                    </div>
                  </div>
                </section>

                <section className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-500">{t('palette')}</h2>
                    <div className="flex items-center gap-2">
                      <div className="flex bg-zinc-800 p-1 rounded-lg">
                        <button 
                          onClick={() => setActiveSide('front')}
                          className={cn(
                            "px-3 py-1 text-xs font-bold rounded-md transition-all",
                            activeSide === 'front' ? "bg-zinc-700 shadow-sm text-white" : "text-zinc-500"
                          )}
                        >
                          {t('front')}
                        </button>
                        <button 
                          onClick={() => setActiveSide('back')}
                          className={cn(
                            "px-3 py-1 text-xs font-bold rounded-md transition-all",
                            activeSide === 'back' ? "bg-zinc-700 shadow-sm text-white" : "text-zinc-500"
                          )}
                        >
                          {t('back')}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
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
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handlePickerSelect(color.id as Color);
                                  }}
                                  className={cn(
                                    "aspect-square rounded-md border-2 transition-all flex items-center justify-center",
                                    activeCell && (sideData(activeCell.side).cells[activeCell.index].color === color.id)
                                      ? "border-white scale-105 shadow-md"
                                      : "border-transparent hover:scale-105"
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
                                if (idx === 8) { // Trash icon at the end
                                  return (
                                    <button
                                      key="trash"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handlePickerSelect(undefined, '.');
                                      }}
                                      className={cn(
                                        "aspect-square rounded-md border-2 bg-zinc-800 flex items-center justify-center transition-all overflow-hidden border-transparent hover:bg-zinc-700 hover:scale-105"
                                      )}
                                    >
                                      <Trash2 size={16} className="text-red-500" />
                                    </button>
                                  );
                                }
                                if (idx === 7) return <div key="empty" />; // Empty slot before trash

                                return (
                                  <button
                                    key={val}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handlePickerSelect(undefined, val as Value);
                                    }}
                                    className={cn(
                                      "aspect-square rounded-md border-2 bg-zinc-800 flex items-center justify-center transition-all overflow-hidden",
                                      activeCell && (sideData(activeCell.side).cells[activeCell.index].value === val)
                                        ? "border-white bg-zinc-700 scale-105 shadow-md"
                                        : "border-transparent hover:bg-zinc-700 hover:scale-105"
                                    )}
                                  >
                                    {val === 'X' ? (
                                      <span className="font-display text-xl text-zinc-500">X</span>
                                    ) : (
                                      <img 
                                        src={`/Cells/${val}.png`}
                                        alt={val}
                                        className="w-full h-full object-contain opacity-100 block scale-[1.02]"
                                        onError={(e) => {
                                          const target = e.target as HTMLImageElement;
                                          if (!target.src.includes('raw.githubusercontent.com')) {
                                            target.src = `https://raw.githubusercontent.com/chardila/sagrada_generator/main/${val}.png`;
                                          } else if (!target.src.startsWith('data:image/svg+xml')) {
                                            target.src = getValueSvgDataUrl(val);
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
                </section>

                <div className="pt-4 space-y-4">
                  <button 
                    onClick={addToQueue}
                    className="w-full flex items-center justify-center gap-2 bg-white text-black py-4 rounded-xl font-bold hover:bg-zinc-200 transition-colors shadow-lg active:scale-95"
                  >
                    <Plus size={20} />
                    {t('addToQueue')}
                  </button>

                  <button 
                    onClick={() => setCurrentCard(prev => ({ ...prev, cells: createEmptyGrid() }))}
                    className="w-full flex items-center justify-center gap-2 bg-transparent text-zinc-600 py-2 rounded-lg text-[10px] font-bold hover:text-red-500 transition-colors uppercase tracking-widest"
                  >
                    <Trash2 size={14} />
                    {t('clearQueue')}
                  </button>

                  <div className="pt-4 border-t border-zinc-800">
                    <button 
                      onClick={() => saveCard(editingCustomCardIndex !== null)}
                      className={cn(
                        "w-full flex items-center justify-center gap-2 py-4 rounded-xl text-xs font-bold transition-all active:scale-95 shadow-lg",
                        editingCustomCardIndex !== null 
                          ? "bg-blue-600 text-white hover:bg-blue-500" 
                          : "bg-zinc-100 text-black hover:bg-white"
                      )}
                    >
                      <Download size={16} />
                      {editingCustomCardIndex !== null ? t('patternSaved') : t('savePattern')}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {activePanel === 'queue' && (
              <motion.div 
                key="queue"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="p-6 flex flex-col h-full"
              >
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-500">{t('printQueue')}</h2>
                  <span className="text-xs font-bold bg-zinc-800 px-2 py-1 rounded-full text-zinc-500">
                    {queue.length} / 6
                  </span>
                </div>

                <div className="flex-1 space-y-4 overflow-y-auto pr-2 custom-scrollbar">
                  {queue.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center text-zinc-600 space-y-3">
                      <Layers size={48} strokeWidth={1} />
                      <p className="text-sm">{t('queueEmpty')}</p>
                    </div>
                  ) : (
                    queue.map((item) => (
                      <div 
                        key={item.id}
                        className="group relative bg-zinc-800/30 border border-zinc-800 hover:border-zinc-700 rounded-xl p-3 transition-all"
                      >
                        <div className="flex flex-col gap-3">
                          {/* Front Side */}
                          <div className="flex gap-3 items-center">
                            <div className="w-16 h-14 bg-black rounded-lg overflow-hidden shrink-0 border border-zinc-800 flex items-center justify-center">
              <Card 
                data={item.front} 
                activeCellIndex={null} 
                scale={0.15} 
                cornerRadius={cornerRadius}
                hideShadow
                className="pointer-events-none"
              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold truncate text-white group-hover:text-blue-400 transition-colors">
                                {item.front.title}
                              </p>
                              <div className="flex gap-1 mt-1.5">
                                {Array.from({ length: 6 }).map((_, i) => {
                                  const isActive = i >= (6 - item.front.difficulty);
                                  return (
                                    <div 
                                      key={i} 
                                      className={cn(
                                        "w-1.5 h-1.5 rounded-full",
                                        isActive ? "bg-white shadow-[0_0_2px_rgba(255,255,255,0.5)]" : "bg-zinc-800"
                                      )} 
                                    />
                                  );
                                })}
                              </div>
                            </div>
                          </div>

                          {/* Back Side */}
                          {item.isDoubleSided && item.back && (
                            <div className="flex gap-3 items-center pt-2 border-t border-zinc-800/50">
                              <div className="w-16 h-14 bg-black rounded-lg overflow-hidden shrink-0 border border-zinc-800 flex items-center justify-center">
                <Card 
                  data={item.back} 
                  activeCellIndex={null} 
                  scale={0.15} 
                  cornerRadius={cornerRadius}
                  hideShadow
                  className="pointer-events-none"
                />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold truncate text-white group-hover:text-blue-400 transition-colors">
                                  {item.back.title}
                                </p>
                                <div className="flex gap-1 mt-1.5">
                                  {Array.from({ length: 6 }).map((_, i) => {
                                    const isActive = i >= (6 - item.back!.difficulty);
                                    return (
                                      <div 
                                        key={i} 
                                        className={cn(
                                          "w-1.5 h-1.5 rounded-full",
                                          isActive ? "bg-white shadow-[0_0_2px_rgba(255,255,255,0.5)]" : "bg-zinc-800"
                                        )} 
                                      />
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            removeFromQueue(item.id);
                          }}
                          className="absolute top-2 right-2 p-1.5 text-zinc-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))
                  )}
                </div>

                {queue.length > 0 && (
                  <div className="pt-6 space-y-4 border-t border-zinc-800 mt-4">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest">{t('doubleSided')}</span>
                        <button 
                          onClick={() => setIsDoubleSided(!isDoubleSided)}
                          className={cn(
                            "w-10 h-5 rounded-full transition-colors relative",
                            isDoubleSided ? "bg-blue-600" : "bg-zinc-800"
                          )}
                        >
                          <div className={cn(
                            "absolute top-1 w-3 h-3 bg-white rounded-full transition-all",
                            isDoubleSided ? "left-6" : "left-1"
                          )} />
                        </button>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest">{t('cropMarks')}</span>
                        <button 
                          onClick={() => setShowCropMarks(!showCropMarks)}
                          className={cn(
                            "w-10 h-5 rounded-full transition-colors relative",
                            showCropMarks ? "bg-blue-600" : "bg-zinc-800"
                          )}
                        >
                          <div className={cn(
                            "absolute top-1 w-3 h-3 bg-white rounded-full transition-all",
                            showCropMarks ? "left-6" : "left-1"
                          )} />
                        </button>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest">{t('printerFriendly')}</span>
                        <button 
                          onClick={() => setPrinterFriendly(!printerFriendly)}
                          className={cn(
                            "w-10 h-5 rounded-full transition-colors relative",
                            printerFriendly ? "bg-blue-600" : "bg-zinc-800"
                          )}
                        >
                          <div className={cn(
                            "absolute top-1 w-3 h-3 bg-white rounded-full transition-all",
                            printerFriendly ? "left-6" : "left-1"
                          )} />
                        </button>
                      </div>
                      {printerFriendly && (
                        <div className="space-y-2">
                          <div className="flex justify-between text-[10px] font-bold text-zinc-500 uppercase">
                            <span>{t('opacity')}</span>
                            <span>{Math.round(printerOpacity * 100)}%</span>
                          </div>
                          <input 
                            type="range" 
                            min="0.1" 
                            max="1" 
                            step="0.1" 
                            value={printerOpacity}
                            onChange={(e) => setPrinterOpacity(parseFloat(e.target.value))}
                            className="w-full accent-blue-600"
                          />
                        </div>
                      )}
                    </div>

                    <button 
                      onClick={handleExportPDF}
                      className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-4 rounded-xl font-bold hover:bg-blue-700 transition-colors shadow-lg active:scale-95"
                    >
                      <Printer size={20} />
                      {t('generatePDF')}
                    </button>
                    <button 
                      onClick={() => setQueue([])}
                      className="w-full text-xs font-bold text-zinc-600 hover:text-red-500 transition-colors py-2 uppercase tracking-widest"
                    >
                      {t('clearQueue')}
                    </button>
                  </div>
                )}
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
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-500">{t('settings')}</h2>
                </div>
                
                <div className="space-y-6">
                  {/* Language Selection */}
                  <div className="space-y-4 pt-2 border-t border-zinc-800">
                    <label className="text-xs font-medium text-zinc-500 uppercase tracking-widest">{t('language')}</label>
                    <div className="flex items-center gap-2 bg-zinc-800 p-2 rounded-xl border border-zinc-700">
                      <Globe size={16} className="text-zinc-500 ml-2" />
                      <select 
                        value={language}
                        onChange={(e) => setLanguage(e.target.value as Language)}
                        className="flex-1 bg-transparent text-white text-xs font-bold outline-none cursor-pointer py-1"
                      >
                        <option value="hu">Magyar</option>
                        <option value="en">English</option>
                        <option value="de">Deutsch</option>
                      </select>
                    </div>
                  </div>

                  {/* Visual Section */}
                  <div className="space-y-4">
                    <label className="text-xs font-medium text-zinc-500 uppercase tracking-widest">{t('display')}</label>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white">{t('backgroundPattern')}</span>
                        <button 
                          onClick={() => setShowBackground(!showBackground)}
                          className={cn(
                            "w-10 h-5 rounded-full transition-colors relative",
                            showBackground ? "bg-blue-600" : "bg-zinc-800"
                          )}
                        >
                          <div className={cn(
                            "absolute top-1 w-3 h-3 bg-white rounded-full transition-all",
                            showBackground ? "left-6" : "left-1"
                          )} />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Export/Import Section */}
                  <div className="space-y-4">
                    <label className="text-xs font-medium text-zinc-500 uppercase tracking-widest">{t('dataManagement')}</label>
                    <div className="grid grid-cols-1 gap-3">
                      <button 
                        onClick={() => {
                          const cards = Object.entries(promos).map(([title, promo]) => ({
                            title,
                            difficulty: promo.difficulty,
                            code: promo.code,
                            cells: parsePattern(promo.pattern)
                          }));
                          handleExport(cards, 'sagrada_minta_kartyak');
                        }}
                        className="flex items-center justify-between bg-zinc-800 p-3 rounded-xl border border-zinc-700 hover:bg-zinc-700 transition-colors"
                      >
                        <span className="text-xs font-bold text-white">{t('exportPatterns')}</span>
                        <Download size={16} className="text-zinc-400" />
                      </button>

                      <button 
                        onClick={() => handleExport(customCards, 'sagrada_sajat_kartyak')}
                        className="flex items-center justify-between bg-zinc-800 p-3 rounded-xl border border-zinc-700 hover:bg-zinc-700 transition-colors"
                      >
                        <span className="text-xs font-bold text-white">{t('exportOwn')}</span>
                        <Download size={16} className="text-zinc-400" />
                      </button>

                      <label className="flex items-center justify-between bg-zinc-800 p-3 rounded-xl border border-zinc-700 hover:bg-zinc-700 transition-colors cursor-pointer">
                        <span className="text-xs font-bold text-white">{t('importCards')}</span>
                        <Upload size={16} className="text-zinc-400" />
                        <input 
                          type="file" 
                          ref={fileInputRef} 
                          accept=".json" 
                          onChange={handleImport} 
                          className="hidden" 
                        />
                      </label>
                    </div>
                  </div>

                  {/* Zoom Controls */}
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-zinc-500 uppercase tracking-widest">{t('zoom')}</label>
                    <div className="flex items-center justify-between bg-zinc-800 p-2 rounded-xl border border-zinc-700">
                      <button 
                        onClick={() => setPreviewScale(prev => Math.max(0.5, prev - 0.1))}
                        className="p-2 text-zinc-400 hover:text-white transition-colors bg-zinc-700 rounded-lg"
                      >
                        <ChevronLeft size={20} />
                      </button>
                      <span className="text-sm font-bold text-white">{Math.round(previewScale * 100)}%</span>
                      <button 
                        onClick={() => setPreviewScale(prev => Math.min(2, prev + 0.1))}
                        className="p-2 text-zinc-400 hover:text-white transition-colors bg-zinc-700 rounded-lg"
                      >
                        <ChevronRight size={20} />
                      </button>
                    </div>
                  </div>

                  {/* Text Settings */}
                  <div className="space-y-4 pt-2 border-t border-zinc-800">
                    <label className="text-xs font-medium text-zinc-500 uppercase tracking-widest">{t('textSettings')}</label>
                    
                    <div className="space-y-2">
                      <label className="text-[10px] text-zinc-500 uppercase">{t('font')}</label>
                      <select 
                        value={currentCard.titleFont || 'Uncial Antiqua'}
                        onChange={(e) => setCurrentCard(prev => ({ ...prev, titleFont: e.target.value }))}
                        className="w-full bg-zinc-800 border border-zinc-700 text-white text-sm rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-white"
                      >
                        {['Uncial Antiqua', 'Cinzel', 'MedievalSharp', 'Almendra', 'Pirata One', 'Great Vibes', 'Playfair Display', 'Cormorant Garamond', 'Montserrat', 'Inter'].map(f => (
                          <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] text-zinc-500 uppercase">{t('fontSize')}</label>
                      <div className="flex items-center justify-between bg-zinc-800 p-2 rounded-xl border border-zinc-700">
                        <button 
                          onClick={() => setCurrentCard(prev => ({ ...prev, titleSize: Math.max(8, (prev.titleSize || 14) - 1) }))}
                          className="p-2 text-zinc-400 hover:text-white transition-colors bg-zinc-700 rounded-lg"
                        >
                          <ChevronLeft size={16} />
                        </button>
                        <span className="text-sm font-bold text-white">{currentCard.titleSize || 14}</span>
                        <button 
                          onClick={() => setCurrentCard(prev => ({ ...prev, titleSize: Math.min(24, (prev.titleSize || 14) + 1) }))}
                          className="p-2 text-zinc-400 hover:text-white transition-colors bg-zinc-700 rounded-lg"
                        >
                          <ChevronRight size={16} />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] text-zinc-500 uppercase">{t('cornerRadius')}</label>
                      <div className="flex items-center justify-between bg-zinc-800 p-2 rounded-xl border border-zinc-700">
                        <button 
                          onClick={() => setCornerRadius(prev => Math.max(0, prev - 1))}
                          className="p-2 text-zinc-400 hover:text-white transition-colors bg-zinc-700 rounded-lg"
                        >
                          <ChevronLeft size={16} />
                        </button>
                        <span className="text-sm font-bold text-white">{cornerRadius}</span>
                        <button 
                          onClick={() => setCornerRadius(prev => Math.min(20, prev + 1))}
                          className="p-2 text-zinc-400 hover:text-white transition-colors bg-zinc-700 rounded-lg"
                        >
                          <ChevronRight size={16} />
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-4 space-y-3">
                    <div className="flex items-center gap-2 text-zinc-500">
                      <Info size={16} />
                      <p className="text-xs font-bold uppercase">{t('info')}</p>
                    </div>
                    <p className="text-xs text-zinc-500 leading-relaxed">
                      {t('infoDesc')}
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </aside>

        {/* Right Area: Preview */}
        <section 
          className="flex-1 bg-zinc-950 flex flex-col items-center justify-center p-4 sm:p-8 relative overflow-hidden cursor-default"
          onClick={() => {
            setActiveCell(null);
            if (selectedTool) setSelectedTool(null);
          }}
          style={showBackground ? {
            backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.05) 1px, transparent 0)',
            backgroundSize: '24px 24px'
          } : {}}
        >
          {/* Side Indicator */}
          <div className="absolute top-6 left-1/2 -translate-x-1/2 flex items-center gap-4 z-10">
            <button 
              onClick={() => setActiveSide('front')}
              className={cn(
                "px-4 py-2 rounded-full text-xs font-bold transition-all shadow-sm",
                activeSide === 'front' ? "bg-white text-black scale-110" : "bg-zinc-800 text-zinc-500 hover:text-white"
              )}
            >
              {t('front')}
            </button>
            <button 
              onClick={() => setActiveSide(activeSide === 'front' ? 'back' : 'front')}
              className="w-10 h-10 bg-zinc-800 rounded-full flex items-center justify-center shadow-md hover:scale-110 transition-transform text-zinc-400 hover:text-white"
            >
              <FlipHorizontal size={20} />
            </button>
            <button 
              onClick={() => setActiveSide('back')}
              className={cn(
                "px-4 py-2 rounded-full text-xs font-bold transition-all shadow-sm",
                activeSide === 'back' ? "bg-white text-black scale-110" : "bg-zinc-800 text-zinc-500 hover:text-white"
              )}
            >
              {t('back')}
            </button>
          </div>

          {/* Card Preview Container */}
          <div 
            className="preview-card-wrapper" 
            onClick={(e) => e.stopPropagation()}
          >
            <div 
              className={cn("preview-card-container group preview-glow")}
              style={{ 
                transform: `scale(${previewScale})`,
                transformOrigin: 'center',
                transition: 'transform 0.2s ease-out'
              }}
            >
              <Card 
                data={currentCard} 
                activeCellIndex={activeCell?.side === activeSide ? activeCell.index : null}
                onCellClick={(index) => handleCellClick(activeSide, index)}
                onDifficultyChange={(diff) => setCurrentCard(prev => ({ ...prev, difficulty: diff }))}
                cornerRadius={cornerRadius}
                editable
              />
              
              {/* Scale Info */}
              <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">
                  {t('physicalSize')}: 90mm × 80mm
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Website Footer */}
      <footer className="bg-zinc-950 border-t border-zinc-900 px-6 py-4 flex items-center justify-between text-zinc-600 text-[10px] font-bold uppercase tracking-widest">
        <div>&copy; 2026 Sagrada Pattern Designer. {t('allRightsReserved')}</div>
        <div className="flex items-center gap-4">
          <span>{t('version')}: v1.2.0</span>
        </div>
      </footer>

      {/* Generator Modal */}
      <AnimatePresence>
        {showGeneratorModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowGeneratorModal(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
                <h3 className="text-lg font-bold text-white">{t('generateCard')}</h3>
                <button onClick={() => setShowGeneratorModal(false)} className="text-zinc-500 hover:text-white">
                  <CloseIcon size={20} />
                </button>
              </div>
              
              <div className="p-6 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{t('colorCount')}</label>
                    <input 
                      type="number" 
                      min="1" max="5"
                      value={genOptions.colorCount}
                      onChange={(e) => setGenOptions(prev => ({ ...prev, colorCount: parseInt(e.target.value) }))}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white outline-none focus:ring-1 focus:ring-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{t('coloredCells')}</label>
                    <input 
                      type="number" 
                      min="0" max="10"
                      value={genOptions.coloredCells}
                      onChange={(e) => setGenOptions(prev => ({ ...prev, coloredCells: parseInt(e.target.value) }))}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white outline-none focus:ring-1 focus:ring-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{t('valueCount')}</label>
                    <input 
                      type="number" 
                      min="1" max="6"
                      value={genOptions.valueCount}
                      onChange={(e) => setGenOptions(prev => ({ ...prev, valueCount: parseInt(e.target.value) }))}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white outline-none focus:ring-1 focus:ring-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{t('valuedCells')}</label>
                    <input 
                      type="number" 
                      min="0" max="10"
                      value={genOptions.valuedCells}
                      onChange={(e) => setGenOptions(prev => ({ ...prev, valuedCells: parseInt(e.target.value) }))}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white outline-none focus:ring-1 focus:ring-white"
                    />
                  </div>
                </div>

                <button 
                  onClick={() => {
                    const newCard = generateSagradaCard(genOptions);
                    setCurrentCard(prev => ({
                      ...prev,
                      ...newCard,
                      title: newCard.title,
                      cells: newCard.cells,
                      difficulty: newCard.difficulty,
                      code: newCard.code
                    }));
                    setShowGeneratorModal(false);
                    showNotification(t('cardGenerated'));
                  }}
                  className="w-full bg-white text-black py-4 rounded-xl font-bold hover:bg-zinc-200 transition-colors shadow-lg"
                >
                  {t('startGeneration')}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Wiki Modal */}
      <AnimatePresence>
        {showWiki && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            onClick={() => setShowWiki(false)}
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
                <h2 className="text-xl font-bold flex items-center gap-2 text-white">
                  <BookOpen className="text-white" />
                  {t('wikiTitle')}
                </h2>
                <button 
                  onClick={() => setShowWiki(false)}
                  className="p-2 hover:bg-zinc-800 rounded-full transition-colors text-zinc-400"
                >
                  <CloseIcon size={20} />
                </button>
              </div>
              <div className="p-6 overflow-y-auto space-y-8 text-zinc-300 custom-scrollbar">
                <section className="space-y-3">
                  <h3 className="text-sm font-bold text-blue-400 uppercase tracking-widest">{t('editorUsage')}</h3>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    {t('editorUsageDesc')}
                  </p>
                </section>

                <section className="space-y-3">
                  <h4 className="text-sm font-bold text-blue-400 uppercase tracking-widest">{t('generation')}</h4>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    {t('generationDesc')}
                  </p>
                </section>

                <section className="space-y-3">
                  <h4 className="text-sm font-bold text-blue-400 uppercase tracking-widest">{t('printAndPdf')}</h4>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    {t('printAndPdfDesc')}
                  </p>
                  <ul className="text-xs text-zinc-400 space-y-2 list-disc pl-4">
                    <li><span className="text-white font-bold">{t('doubleSided')}:</span> {t('doubleSidedDesc')}</li>
                    <li><span className="text-white font-bold">{t('cropMarks')}:</span> {t('cropMarksDesc')}</li>
                    <li><span className="text-white font-bold">{t('printerFriendly')}:</span> {t('printerFriendlyDesc')}</li>
                  </ul>
                </section>

                <section className="space-y-3">
                  <h4 className="text-sm font-bold text-blue-400 uppercase tracking-widest">{t('save')}</h4>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    {t('saveDesc')}
                  </p>
                </section>
              </div>
            </motion.div>
          </motion.div>
        )}
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
              notification.type === 'success' 
                ? "bg-zinc-900 text-white border-zinc-700" 
                : "bg-red-950 text-red-200 border-red-900"
            )}
          >
            {notification.type === 'success' ? <Check size={18} className="text-green-500" /> : <Info size={18} className="text-red-500" />}
            {notification.message}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  function sideData(side: 'front' | 'back') {
    return side === 'front' ? front : back;
  }
};

interface CardProps {
  data: CardData;
  activeCellIndex: number | null;
  onCellClick?: (index: number) => void;
  onDifficultyChange?: (difficulty: number) => void;
  scale?: number;
  cornerRadius?: number;
  className?: string;
  id?: string;
  editable?: boolean;
  hideShadow?: boolean;
  printerFriendly?: boolean;
  printerOpacity?: number;
  showCropMarks?: boolean;
}

const Card: React.FC<CardProps> = ({ 
  data, 
  activeCellIndex, 
  onCellClick, 
  onDifficultyChange,
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
  const titleRef = React.useRef<HTMLSpanElement>(null);
  const codeRef = React.useRef<HTMLSpanElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [adjustedFontSize, setAdjustedFontSize] = React.useState<number | null>(null);

  React.useLayoutEffect(() => {
    if (titleRef.current && containerRef.current) {
      const codeWidth = codeRef.current ? codeRef.current.offsetWidth + 8 : 0;
      const containerWidth = Math.max(50, containerRef.current.clientWidth - 12 - codeWidth);
      const baseFontSize = data.titleSize || 14;
      let currentFontSize = baseFontSize;
      
      // Reset to base size first to measure
      titleRef.current.style.fontSize = `${currentFontSize}pt`;
      
      // Shrink if overflows
      while (titleRef.current.scrollWidth > containerWidth && currentFontSize > 6) {
        currentFontSize -= 0.5;
        titleRef.current.style.fontSize = `${currentFontSize}pt`;
      }
      setAdjustedFontSize(currentFontSize);
    }
  }, [data.title, data.titleSize, data.titleFont, data.code]);

  const isGenerated = (data as any).isGenerated;

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
            {cell.color !== '.' && (
              <div 
                className={cn("color-overlay", `c-${cell.color.toLowerCase()}`)} 
              />
            )}
            {cell.value !== '.' && (
              <>
                {cell.value === 'X' ? (
                  <span className="x-mark">X</span>
                ) : (
                  <img 
                    src={`/Cells/${cell.value}.png`}
                    alt={cell.value}
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      if (!target.src.includes('raw.githubusercontent.com')) {
                        target.src = `https://raw.githubusercontent.com/chardila/sagrada_generator/main/${cell.value}.png`;
                      } else if (!target.src.startsWith('data:image/svg+xml')) {
                        target.src = getValueSvgDataUrl(cell.value, cell.color);
                      }
                    }}
                  />
                )}
              </>
            )}
          </div>
        ))}
      </div>

      <div className="card-footer" ref={containerRef}>
        <div className="card-title-container">
          <span 
            ref={titleRef}
            className="card-title" 
            style={{ 
              fontFamily: data.titleFont || '"Uncial Antiqua", serif',
              fontSize: adjustedFontSize ? `${adjustedFontSize}pt` : `${data.titleSize || 14}pt`,
              display: 'flex',
              alignItems: 'center',
              height: '100%'
            }}
          >
            {data.title} {data.code || ''}
          </span>
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

export default App;
