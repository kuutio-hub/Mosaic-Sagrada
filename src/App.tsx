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
  Check
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

const getDiceSvgDataUrl = (value: string, color: string) => {
  const dots: Record<string, number[][]> = {
    '1': [[50, 50]],
    '2': [[25, 25], [75, 75]],
    '3': [[25, 25], [50, 50], [75, 75]],
    '4': [[25, 25], [25, 75], [75, 25], [75, 75]],
    '5': [[25, 25], [25, 75], [50, 50], [75, 25], [75, 75]],
    '6': [[25, 25], [25, 50], [25, 75], [75, 25], [75, 50], [75, 75]],
  };
  
  if (!dots[value]) return '';
  
  const dotColor = (color === 'W' || color === '.') ? 'black' : 'white';
  const circles = dots[value].map(([cx, cy]) => 
    `<circle cx="${cx}" cy="${cy}" r="10" fill="${dotColor}" />`
  ).join('');
  
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${circles}</svg>`;
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentCard = activeSide === 'front' ? front : back;
  const setCurrentCard = activeSide === 'front' ? setFront : setBack;

  // Notification timer
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

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
      showNotification("Kártya frissítve!");
    } else {
      const newCustomCards = [...customCards, { ...currentCard }];
      setCustomCards(newCustomCards);
      setEditingCustomCardIndex(newCustomCards.length - 1);
      localStorage.setItem('customCards', JSON.stringify(newCustomCards));
      showNotification("Kártya elmentve!");
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
          showNotification(`${validCards.length} kártya sikeresen importálva!`);
        } else {
          showNotification("Érvénytelen kártya fájl!", 'error');
        }
      } catch (err) {
        showNotification("Hiba az importálás során!", 'error');
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Handle cell click
  const handleCellClick = (side: 'front' | 'back', index: number) => {
    setActiveCell({ side, index });
  };

  // Handle picker selection
  const handlePickerSelect = (color?: Color, value?: Value) => {
    if (!activeCell) return;

    const { side, index } = activeCell;
    const updateFn = side === 'front' ? setFront : setBack;

    updateFn(prev => {
      const newCells = [...prev.cells];
      const cell = { ...newCells[index] };

      if (color !== undefined) {
        // Toggle logic
        if (cell.color === color) {
          cell.color = '.';
        } else {
          cell.color = color;
          // Mutual exclusivity: if setting color, clear value
          cell.value = '.';
        }
      }
      
      if (value !== undefined) {
        // Toggle logic
        if (cell.value === value) {
          cell.value = '.';
          cell.color = '.'; // Delete button clears both
        } else {
          cell.value = value;
          // Mutual exclusivity: if setting value, clear color
          cell.color = '.';
          
          // Special case for delete button
          if (value === '.') {
            cell.color = '.';
            cell.value = '.';
          }
        }
      }

      newCells[index] = cell;
      return { ...prev, cells: newCells };
    });
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
      alert("A nyomtatási lista üres!");
      return;
    }
    setIsGenerating(true);
    try {
      await generatePDF(queue, cornerRadius);
    } catch (err) {
      console.error(err);
      alert("Hiba történt a PDF generálása közben.");
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
          <h1 className="font-display text-xl hidden sm:block text-white">Sagrada Designer</h1>
        </div>

        <nav className="flex items-center gap-1 sm:gap-2">
          <button 
            onClick={() => setActivePanel('editor')}
            className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-lg transition-colors",
              activePanel === 'editor' ? "bg-white text-black" : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
            )}
          >
            <Plus size={18} />
            <span className="hidden md:inline">Szerkesztő</span>
          </button>
          <button 
            onClick={() => setActivePanel('queue')}
            className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-lg transition-colors relative",
              activePanel === 'queue' ? "bg-white text-black" : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
            )}
          >
            <Layers size={18} />
            <span className="hidden md:inline">Nyomtatási lista</span>
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
            <span className="hidden md:inline">Beállítások</span>
          </button>
        </nav>

        <div className="flex items-center gap-2">
          <select 
            onChange={(e) => loadPromo(e.target.value)}
            className="w-32 sm:w-40 bg-zinc-800 border border-zinc-700 text-white text-xs rounded-lg px-2 py-2 outline-none focus:ring-1 focus:ring-white"
            defaultValue=""
          >
            <option value="" disabled>Minta kártyák</option>
            {Object.keys(promos).map(name => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>

          <div className="flex items-center gap-1">
            <select 
              onChange={(e) => loadCustomCard(parseInt(e.target.value))}
              className="w-32 sm:w-40 bg-zinc-800 border border-zinc-700 text-white text-xs rounded-lg px-2 py-2 outline-none focus:ring-1 focus:ring-white"
              value={editingCustomCardIndex !== null ? editingCustomCardIndex : ""}
            >
              <option value="" disabled>Saját kártyák</option>
              {customCards.map((card, idx) => (
                <option key={idx} value={idx}>{card.title}</option>
              ))}
            </select>
            {editingCustomCardIndex !== null && (
              <button 
                onClick={() => deleteCustomCard(editingCustomCardIndex)}
                className="p-2 text-zinc-500 hover:text-red-500 hover:bg-zinc-800 rounded-lg transition-all"
                title="Saját kártya törlése"
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>

          <button 
            onClick={handleExportPDF}
            disabled={isGenerating || queue.length === 0}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-300 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm"
          >
            {isGenerating ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Printer size={18} />
            )}
            <span className="hidden sm:inline">PDF Export</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col md:flex-row overflow-hidden">
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
                  <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-500">Kártya adatok</h2>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-medium text-zinc-500 mb-1 block">Kártya neve</label>
                      <input 
                        type="text" 
                        value={currentCard.title}
                        onChange={(e) => setCurrentCard(prev => ({ ...prev, title: e.target.value }))}
                        className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 text-white rounded-lg focus:ring-2 focus:ring-white focus:border-transparent outline-none transition-all"
                        placeholder="Minta név"
                      />
                    </div>
                  </div>
                </section>

                <section className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-500">Paletta</h2>
                    <div className="flex items-center gap-2">
                      <div className="flex bg-zinc-800 p-1 rounded-lg">
                        <button 
                          onClick={() => setActiveSide('front')}
                          className={cn(
                            "px-3 py-1 text-xs font-bold rounded-md transition-all",
                            activeSide === 'front' ? "bg-zinc-700 shadow-sm text-white" : "text-zinc-500"
                          )}
                        >
                          Előlap
                        </button>
                        <button 
                          onClick={() => setActiveSide('back')}
                          className={cn(
                            "px-3 py-1 text-xs font-bold rounded-md transition-all",
                            activeSide === 'back' ? "bg-zinc-700 shadow-sm text-white" : "text-zinc-500"
                          )}
                        >
                          Hátlap
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
                        <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Színek</span>
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
                            <div className="palette-grid colors">
                              {COLORS.filter(c => c.id !== '.').map(color => (
                                <button
                                  key={color.id}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handlePickerSelect(color.id as Color);
                                  }}
                                  className={cn(
                                    "rounded-md border-2 transition-all flex items-center justify-center",
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
                        <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Számok</span>
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
                            <div className="palette-grid numbers">
                              {VALUES.map(val => (
                                <button
                                  key={val}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handlePickerSelect(undefined, val as Value);
                                  }}
                                  className={cn(
                                    "rounded-md border-2 bg-zinc-800 flex items-center justify-center transition-all overflow-hidden",
                                    activeCell && (sideData(activeCell.side).cells[activeCell.index].value === val)
                                      ? "border-white bg-zinc-700 scale-105 shadow-md"
                                      : "border-transparent hover:bg-zinc-700 hover:scale-105"
                                  )}
                                >
                                  {val === '.' ? (
                                    <Trash2 size={14} className="text-zinc-600" />
                                  ) : val === 'X' ? (
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
                                          target.src = getDiceSvgDataUrl(val, '.');
                                        }
                                      }}
                                    />
                                  )}
                                </button>
                              ))}
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
                    Hozzáadás a nyomtatási listához
                  </button>

                  <button 
                    onClick={() => setCurrentCard(prev => ({ ...prev, cells: createEmptyGrid() }))}
                    className="w-full flex items-center justify-center gap-2 bg-transparent text-zinc-600 py-2 rounded-lg text-[10px] font-bold hover:text-red-500 transition-colors uppercase tracking-widest"
                  >
                    <Trash2 size={14} />
                    Rács törlése
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
                      {editingCustomCardIndex !== null ? "Változások mentése" : "Mentés sajátként"}
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
                  <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-500">Nyomtatási lista</h2>
                  <span className="text-xs font-bold bg-zinc-800 px-2 py-1 rounded-full text-zinc-500">
                    {queue.length} / 6
                  </span>
                </div>

                <div className="flex-1 space-y-4 overflow-y-auto pr-2">
                  {queue.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center text-zinc-600 space-y-3">
                      <Layers size={48} strokeWidth={1} />
                      <p className="text-sm">A lista még üres.<br/>Adj hozzá kártyákat a szerkesztőből!</p>
                    </div>
                  ) : (
                    queue.map((item, idx) => (
                      <div 
                        key={item.id}
                        className="group bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex items-center gap-4 hover:border-zinc-600 transition-all cursor-pointer shadow-sm"
                        onClick={() => loadFromQueue(item)}
                      >
                        <div className="w-20 h-18 bg-black rounded-lg flex items-center justify-center overflow-hidden p-0.5 shrink-0 border border-zinc-800 group-hover:border-zinc-600 transition-colors">
                          <div className="origin-top-left scale-[0.21]">
                            <Card data={item.front} activeCellIndex={null} hideShadow />
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold truncate text-white group-hover:text-blue-400 transition-colors">{item.front.title}</p>
                          <div className="flex flex-col gap-1 mt-1">
                            <p className="text-[10px] text-zinc-500 uppercase font-bold flex items-center gap-1.5">
                              {item.isDoubleSided ? (
                                <span className="flex items-center gap-1 text-blue-500">
                                  <FlipHorizontal size={10} />
                                  Kétoldalas
                                </span>
                              ) : (
                                <span className="text-zinc-600">Egyoldalas</span>
                              )}
                            </p>
                            <div className="flex gap-0.5">
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
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            removeFromQueue(item.id);
                          }}
                          className="p-2 text-zinc-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))
                  )}
                </div>

                {queue.length > 0 && (
                  <div className="pt-6 space-y-3">
                    <button 
                      onClick={handleExportPDF}
                      className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition-colors shadow-lg"
                    >
                      <Printer size={20} />
                      PDF Generálása
                    </button>
                    <button 
                      onClick={() => setQueue([])}
                      className="w-full text-xs font-bold text-zinc-500 hover:text-red-500 transition-colors py-2"
                    >
                      Lista ürítése
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
                    <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-500">Beállítások</h2>
                  </div>
                
                <div className="space-y-6">
                  {/* Export/Import Section */}
                  <div className="space-y-4">
                    <label className="text-xs font-medium text-zinc-500 uppercase tracking-widest">Adatok kezelése</label>
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
                        <span className="text-xs font-bold text-white">Minta kártyák exportálása</span>
                        <Download size={16} className="text-zinc-400" />
                      </button>

                      <button 
                        onClick={() => handleExport(customCards, 'sagrada_sajat_kartyak')}
                        className="flex items-center justify-between bg-zinc-800 p-3 rounded-xl border border-zinc-700 hover:bg-zinc-700 transition-colors"
                      >
                        <span className="text-xs font-bold text-white">Saját kártyák exportálása</span>
                        <Download size={16} className="text-zinc-400" />
                      </button>

                      <label className="flex items-center justify-between bg-zinc-800 p-3 rounded-xl border border-zinc-700 hover:bg-zinc-700 transition-colors cursor-pointer">
                        <span className="text-xs font-bold text-white">Kártyák importálása</span>
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
                    <label className="text-xs font-medium text-zinc-500 uppercase tracking-widest">Nagyítás</label>
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
                    <label className="text-xs font-medium text-zinc-500 uppercase tracking-widest">Szöveg beállítások</label>
                    
                    <div className="space-y-2">
                      <label className="text-[10px] text-zinc-500 uppercase">Betűtípus</label>
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
                      <label className="text-[10px] text-zinc-500 uppercase">Betűméret (pt)</label>
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
                      <label className="text-[10px] text-zinc-500 uppercase">Sarok lekerekítés (mm)</label>
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

                  <div className="flex items-center justify-between pt-4 border-t border-zinc-800">
                    <div>
                      <p className="text-sm font-bold text-white">Kétoldalas mód</p>
                      <p className="text-xs text-zinc-500">Hátlap generálása a kártyákhoz</p>
                    </div>
                    <button 
                      onClick={() => setIsDoubleSided(!isDoubleSided)}
                      className={cn(
                        "w-12 h-6 rounded-full p-1 transition-colors",
                        isDoubleSided ? "bg-green-600" : "bg-zinc-700"
                      )}
                    >
                      <div className={cn(
                        "w-4 h-4 bg-white rounded-full transition-transform",
                        isDoubleSided ? "translate-x-6" : "translate-x-0"
                      )} />
                    </button>
                  </div>
                </div>

                <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-2 text-zinc-500">
                    <Info size={16} />
                    <p className="text-xs font-bold uppercase">Információ</p>
                  </div>
                  <p className="text-xs text-zinc-500 leading-relaxed">
                    A kártyák fizikai mérete 90x80mm. A PDF exportálás 300 DPI felbontással készül, A4-es lapra optimalizálva (6 kártya/oldal).
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </aside>

        {/* Right Area: Preview */}
        <section 
          className="flex-1 bg-zinc-950 flex flex-col items-center justify-center p-4 sm:p-8 relative overflow-hidden cursor-default"
          onClick={() => setActiveCell(null)}
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
              ELŐLAP
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
              HÁTLAP
            </button>
          </div>

          {/* Card Preview Container */}
          <div className="preview-card-wrapper" onClick={(e) => e.stopPropagation()}>
            <div className={cn("preview-card-container group preview-glow")}>
              <Card 
                data={currentCard} 
                activeCellIndex={activeCell?.side === activeSide ? activeCell.index : null}
                onCellClick={(index) => handleCellClick(activeSide, index)}
                onDifficultyChange={(diff) => setCurrentCard(prev => ({ ...prev, difficulty: diff }))}
                scale={previewScale}
                cornerRadius={cornerRadius}
                editable
              />
              
              {/* Scale Info */}
              <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">
                  Fizikai méret: 90mm × 80mm
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer / Status Bar */}
      <footer className="bg-zinc-900 border-t border-zinc-800 px-4 py-2 flex items-center justify-between text-[10px] font-bold text-zinc-600 uppercase tracking-widest">
        <div>Sagrada Pattern Designer v0.0.3.0</div>
        <div className="flex items-center gap-4">
          <span>{activeSide === 'front' ? 'Előlap szerkesztése' : 'Hátlap szerkesztése'}</span>
          <span className="w-1 h-1 bg-zinc-700 rounded-full" />
          <span>{queue.length} kártya a listán</span>
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
  hideShadow = false
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

  return (
    <div 
      id={id}
      className={cn("card-container", !hideShadow && "shadow-2xl", className)}
      style={{ 
        transform: `scale(${scale})`,
        transformOrigin: 'top left',
        borderRadius: `${cornerRadius}mm`
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
                        target.src = getDiceSvgDataUrl(cell.value, cell.color);
                      }
                    }}
                  />
                )}
              </>
            )}
          </div>
        ))}
      </div>

      <div className="card-footer">
        <div className="card-title-container" ref={containerRef}>
          <span 
            ref={titleRef}
            className="card-title" 
            style={{ 
              fontFamily: data.titleFont || '"Uncial Antiqua", serif',
              fontSize: adjustedFontSize ? `${adjustedFontSize}pt` : `${data.titleSize || 14}pt`
            }}
          >
            {data.title}
          </span>
          {data.code && <span ref={codeRef} className="card-code">({data.code})</span>}
        </div>
        <div className={cn("card-difficulty", editable && "editable")}>
          {Array.from({ length: 6 }).map((_, i) => {
            // Fill from right: if difficulty is 3, dots at index 3, 4, 5 are active
            const dotIndex = i; // 0 to 5
            const isActive = dotIndex >= (6 - data.difficulty);
            return (
              <div 
                key={i} 
                className={cn("difficulty-dot", isActive && "active")}
                onClick={(e) => {
                  if (editable && onDifficultyChange) {
                    e.stopPropagation();
                    // If we click dot at index i, difficulty becomes 6 - i
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
