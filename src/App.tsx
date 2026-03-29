import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, 
  Trash2, 
  Download, 
  FlipHorizontal, 
  Settings, 
  Layers, 
  Printer,
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

  const currentCard = activeSide === 'front' ? front : back;
  const setCurrentCard = activeSide === 'front' ? setFront : setBack;

  // Load promos and custom cards
  useEffect(() => {
    fetch('/data/promos.json')
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
      alert("Kártya frissítve!");
    } else {
      const newCustomCards = [...customCards, { ...currentCard }];
      setCustomCards(newCustomCards);
      setEditingCustomCardIndex(newCustomCards.length - 1);
      localStorage.setItem('customCards', JSON.stringify(newCustomCards));
      alert("Kártya elmentve!");
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
  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(customCards, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", url);
    downloadAnchorNode.setAttribute("download", "sagrada_custom_cards.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
    URL.revokeObjectURL(url);
  };

  // Import JSON
  const importJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target?.result as string);
        if (Array.isArray(imported)) {
          const merged = [...customCards, ...imported];
          setCustomCards(merged);
          localStorage.setItem('customCards', JSON.stringify(merged));
          alert("Sikeres importálás!");
        }
      } catch (err) {
        alert("Hiba az importálás során!");
      }
    };
    reader.readAsText(file);
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
        // If 'X' is present, don't allow color unless it's clearing 'X'
        if (cell.value === 'X' && color !== '.') {
          // Do nothing or clear X? User said: "X mezőbe rakni... ebbe nem lehet színt is ráhúzni"
          // So if X is there, we can't add color.
          return prev;
        }
        cell.color = color;
      }
      
      if (value !== undefined) {
        // If setting 'X', clear color
        if (value === 'X') {
          cell.color = '.';
        }
        cell.value = value;
      }

      newCells[index] = cell;
      return { ...prev, cells: newCells };
    });

    // Don't close picker automatically if user wants to set both color and value
    // But for now, let's keep it simple.
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
      await generatePDF(queue);
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
            className="bg-zinc-800 border border-zinc-700 text-white text-xs rounded-lg px-2 py-2 outline-none focus:ring-1 focus:ring-white"
            defaultValue=""
          >
            <option value="" disabled>Minta kártyák</option>
            {Object.keys(promos).map(name => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>

          <select 
            onChange={(e) => loadCustomCard(parseInt(e.target.value))}
            className="bg-zinc-800 border border-zinc-700 text-white text-xs rounded-lg px-2 py-2 outline-none focus:ring-1 focus:ring-white"
            defaultValue=""
          >
            <option value="" disabled>Saját kártyák</option>
            {customCards.map((card, idx) => (
              <option key={idx} value={idx}>{card.title}</option>
            ))}
          </select>

          <button 
            onClick={saveCard}
            className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-all"
            title="Mentés"
          >
            <Check size={18} />
          </button>

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
        <aside className="w-full md:w-80 lg:w-96 bg-zinc-900 border-r border-zinc-800 flex flex-col overflow-y-auto">
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
                    <div>
                      <label className="text-xs font-medium text-zinc-500 mb-1 block">Nehézség (1-6)</label>
                      <div className="flex gap-2">
                        {[1, 2, 3, 4, 5, 6].map(val => (
                          <button
                            key={val}
                            onClick={() => setCurrentCard(prev => ({ ...prev, difficulty: val }))}
                            className={cn(
                              "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all",
                              currentCard.difficulty === val 
                                ? "bg-white text-black scale-110 shadow-md" 
                                : "bg-zinc-800 text-zinc-500 hover:bg-zinc-700"
                            )}
                          >
                            {val}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </section>

                <section className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-500">Paletta</h2>
                    <div className="flex items-center gap-2">
                      {activeCell && (
                        <div className="text-[10px] font-bold bg-zinc-800 px-2 py-1 rounded text-zinc-500 uppercase">
                          Cella {activeCell.index + 1}
                        </div>
                      )}
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

                  <div className="space-y-6">
                    <div>
                      <label className="text-xs font-medium text-zinc-500 mb-2 block">Színek</label>
                      <div className="grid grid-cols-4 gap-2">
                        {COLORS.map(color => (
                          <button
                            key={color.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePickerSelect(color.id as Color);
                            }}
                            className={cn(
                              "aspect-square rounded-md border-2 transition-all flex items-center justify-center",
                              color.id === '.' ? "bg-zinc-950" : `c-${color.id.toLowerCase()}`,
                              activeCell && (sideData(activeCell.side).cells[activeCell.index].color === color.id)
                                ? "border-white scale-105 shadow-md"
                                : "border-transparent hover:scale-105"
                            )}
                            title={color.label}
                          >
                            {color.id === '.' && <Trash2 size={14} className="text-zinc-600" />}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-medium text-zinc-500 mb-2 block">Számok</label>
                      <div className="grid grid-cols-4 gap-2">
                        {VALUES.map(val => (
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
                    </div>
                  </div>
                </section>

                  <div className="pt-4 space-y-4">
                    {/* Main Action: Add to Queue */}
                    <button 
                      onClick={addToQueue}
                      className="w-full flex items-center justify-center gap-2 bg-white text-black py-4 rounded-xl font-bold hover:bg-zinc-200 transition-colors shadow-lg active:scale-95"
                    >
                      <Plus size={20} />
                      Hozzáadás a nyomtatási listához
                    </button>

                    {/* Custom Cards Section */}
                    <div className="bg-zinc-900/80 rounded-2xl p-5 border border-zinc-800 space-y-4 shadow-inner">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Download size={14} className="text-zinc-500" />
                          <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Saját kártyák</label>
                        </div>
                        <button 
                          onClick={() => saveCard(editingCustomCardIndex !== null)}
                          className={cn(
                            "flex items-center gap-2 px-4 py-2 rounded-xl text-[11px] font-bold transition-all active:scale-95 shadow-lg",
                            editingCustomCardIndex !== null 
                              ? "bg-blue-600 text-white hover:bg-blue-500" 
                              : "bg-zinc-100 text-black hover:bg-white"
                          )}
                        >
                          <Download size={14} />
                          {editingCustomCardIndex !== null ? "Változások mentése" : "Mentés sajátként"}
                        </button>
                      </div>
                      
                      {customCards.length > 0 ? (
                        <div className="grid grid-cols-1 gap-2 max-h-[240px] overflow-y-auto pr-1 custom-scrollbar">
                          {customCards.map((card, idx) => (
                            <div 
                              key={idx} 
                              className={cn(
                                "group relative flex items-center gap-3 p-3 rounded-xl transition-all border",
                                editingCustomCardIndex === idx 
                                  ? "bg-white/10 border-white/20 shadow-md" 
                                  : "bg-zinc-950/50 border-zinc-800/50 hover:border-zinc-700"
                              )}
                            >
                              <div className="flex-1 min-width-0">
                                <p className={cn(
                                  "text-xs font-bold truncate",
                                  editingCustomCardIndex === idx ? "text-white" : "text-zinc-300"
                                )}>
                                  {card.title}
                                </p>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-tighter">Nehézség: {card.difficulty}</span>
                                  {card.code && <span className="text-[9px] text-zinc-600 font-medium">({card.code})</span>}
                                </div>
                              </div>
                              
                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={() => loadCustomCard(idx)}
                                  className={cn(
                                    "px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all",
                                    editingCustomCardIndex === idx 
                                      ? "bg-white text-black" 
                                      : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white"
                                  )}
                                >
                                  Alkalmaz
                                </button>
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteCustomCard(idx);
                                  }}
                                  className="p-2 text-zinc-600 hover:text-red-500 transition-colors rounded-lg hover:bg-red-500/10"
                                  title="Törlés"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="py-8 text-center border-2 border-dashed border-zinc-800/50 rounded-2xl bg-zinc-950/30">
                          <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest opacity-50">Nincs mentett kártyád</p>
                        </div>
                      )}
                    </div>

                    <button 
                      onClick={() => setCurrentCard(prev => ({ ...prev, cells: createEmptyGrid() }))}
                      className="w-full flex items-center justify-center gap-2 bg-transparent text-zinc-600 py-2 rounded-lg text-[10px] font-bold hover:text-red-500 transition-colors uppercase tracking-widest"
                    >
                      <Trash2 size={14} />
                      Rács törlése
                    </button>
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
                        className="group bg-zinc-800 border border-zinc-700 rounded-xl p-3 flex items-center gap-3 hover:border-white transition-all cursor-pointer"
                        onClick={() => loadFromQueue(item)}
                      >
                        <div className="w-12 h-10 bg-black rounded flex items-center justify-center text-[8px] text-white font-display overflow-hidden p-1">
                          {item.front.title}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold truncate text-white">{item.front.title}</p>
                          <p className="text-[10px] text-zinc-500 uppercase font-bold">
                            {item.isDoubleSided ? 'Kétoldalas' : 'Egyoldalas'} • Nehézség: {item.front.difficulty}
                          </p>
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
                    <div className="flex gap-2">
                      <button 
                        onClick={exportJSON}
                        className="text-[10px] font-bold bg-zinc-800 px-2 py-1 rounded text-zinc-400 hover:text-white uppercase"
                      >
                        Export JSON
                      </button>
                      <label className="text-[10px] font-bold bg-zinc-800 px-2 py-1 rounded text-zinc-400 hover:text-white uppercase cursor-pointer">
                        Import JSON
                        <input type="file" accept=".json" onChange={importJSON} className="hidden" />
                      </label>
                    </div>
                  </div>
                
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
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
  scale?: number;
  className?: string;
  id?: string;
}

const Card: React.FC<CardProps> = ({ data, activeCellIndex, onCellClick, scale = 1, className, id }) => {
  // Dynamic font size for title
  const titleFontSize = data.title.length > 15 ? '11pt' : '14pt';

  return (
    <div 
      id={id}
      className={cn("card-container shadow-2xl rounded-sm", className)}
      style={{ 
        transform: `scale(${scale})`,
        transformOrigin: 'center center'
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
              cell.color !== '.' ? `c-${cell.color.toLowerCase()}` : "c-w",
              activeCellIndex === idx && "ring-2 ring-white ring-offset-2 ring-offset-black z-10 scale-105"
            )}
          >
            {cell.value !== '.' && (
              <div className={cn(
                "font-bold select-none flex items-center justify-center w-full h-full",
                cell.color === 'W' ? "text-black" : "text-white"
              )}>
                {cell.value === 'X' ? (
                  <span className="font-display text-[36pt] opacity-50 leading-none">X</span>
                ) : (
                  <img 
                    src={`/Cells/${cell.value}.png`}
                    alt={cell.value}
                    className="w-full h-full object-contain opacity-100 block scale-[1.02]"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      if (!target.src.includes('raw.githubusercontent.com')) {
                        target.src = `https://raw.githubusercontent.com/chardila/sagrada_generator/main/${cell.value}.png`;
                      } else if (!target.src.startsWith('data:image/svg+xml')) {
                        target.src = getDiceSvgDataUrl(cell.value, cell.color);
                      } else {
                        target.style.display = 'none';
                        target.parentElement!.textContent = cell.value;
                      }
                    }}
                  />
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="card-footer">
        <div className="card-title-container">
          <span className="card-title" style={{ fontSize: titleFontSize }}>{data.title}</span>
          {data.code && <span className="card-code">({data.code})</span>}
        </div>
        <div className="card-difficulty">
          {Array.from({ length: data.difficulty }).map((_, i) => (
            <div key={i} className="difficulty-dot" />
          ))}
        </div>
      </div>
    </div>
  );
};

export default App;
