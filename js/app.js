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
import { motion, AnimatePresence } from 'motion/react';
import { 
  DEFAULT_FRONT, 
  DEFAULT_BACK, 
  COLORS, 
  VALUES, 
  createEmptyGrid 
} from './constants.js';
import { cn, generateId } from './utils.js';
import { generatePDF } from './pdfService.js';
import { generateSagradaCard } from './cardGenerator.js';
import { translations } from './i18n.js';

const getValueSvgDataUrl = (value, color = 'W') => {
  if (value === '.' || value === 'X') return '';
  
  const dotColor = (color === 'W' || color === '.') ? '#333333' : 'white';
  const dotSize = 10;
  const dots = {
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

const Card = ({ 
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
  const titleRef = useRef(null);
  const containerRef = useRef(null);
  const [adjustedFontSize, setAdjustedFontSize] = useState(null);

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

  return React.createElement('div', {
    id,
    className: cn(
      "card-container", 
      !hideShadow && "shadow-2xl", 
      printerFriendly && "printer-friendly",
      showCropMarks && "crop-marks",
      className
    ),
    style: { 
      transform: `scale(${scale})`,
      transformOrigin: 'center',
      borderRadius: showCropMarks ? '0' : `${cornerRadius}mm`,
      opacity: printerFriendly ? printerOpacity : 1
    }
  }, 
    React.createElement('div', { className: "card-grid" }, 
      data.cells.map((cell, idx) => 
        React.createElement('div', {
          key: idx,
          onClick: (e) => {
            e.stopPropagation();
            onCellClick?.(idx);
          },
          className: cn(
            "card-cell cursor-pointer transition-all",
            cell.color !== '.' && "has-color",
            cell.value === 'X' && "val-x",
            activeCellIndex === idx && "ring-2 ring-white ring-offset-2 ring-offset-black z-10 scale-105"
          )
        }, 
          cell.color !== '.' && cell.color !== 'W' && React.createElement('div', {
            className: cn("color-overlay", `c-${cell.color.toLowerCase()}`)
          }),
          cell.value !== '.' && (
            cell.value === 'X' 
              ? React.createElement('span', { className: "x-mark" }, "X")
              : React.createElement('img', {
                  src: `./PNG/${cell.value}.png`,
                  referrerPolicy: "no-referrer",
                  onError: (e) => {
                    e.currentTarget.onerror = null;
                    // Fallback to GitHub raw
                    e.currentTarget.src = `https://raw.githubusercontent.com/kuutio-hub/Mosaic-Sagrada/main/PNG/${cell.value}.png`;
                    // Final fallback to SVG
                    e.currentTarget.onerror = () => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = getValueSvgDataUrl(cell.value, cell.color);
                    };
                  },
                  alt: cell.value
                })
          )
        )
      )
    ),
    React.createElement('div', { 
      className: "card-footer", 
      ref: containerRef, 
      style: { height: '12mm', position: 'absolute', bottom: 0, left: 0, right: 0 } 
    }, 
      React.createElement('div', { className: "card-title-container" }, 
        React.createElement('span', {
          ref: titleRef,
          className: "card-title",
          style: { 
            fontFamily: data.titleFont || '"Uncial Antiqua", serif',
            fontSize: adjustedFontSize ? `${adjustedFontSize}pt` : `${data.titleSize || 12}pt`,
            display: 'flex',
            alignItems: 'center',
            height: '100%'
          }
        }, `${data.title} ${data.code || ''}`)
      ),
      React.createElement('div', { className: cn("card-difficulty", editable && "editable") }, 
        Array.from({ length: 6 }).map((_, i) => {
          const isActive = i >= (6 - data.difficulty);
          return React.createElement('div', {
            key: i,
            className: cn(
              "difficulty-dot", 
              isActive && "active",
              isGenerated && "generated"
            ),
            onClick: (e) => {
              if (editable && onDifficultyChange) {
                e.stopPropagation();
                onDifficultyChange(6 - i);
              }
            }
          });
        })
      )
    )
  );
};

const App = () => {
  const [front, setFront] = useState(JSON.parse(JSON.stringify(DEFAULT_FRONT)));
  const [back, setBack] = useState(JSON.parse(JSON.stringify(DEFAULT_BACK)));
  const [queue, setQueue] = useState([]);
  const [activeSide, setActiveSide] = useState('front');
  const [isDoubleSided, setIsDoubleSided] = useState(false);
  const [activeCell, setActiveCell] = useState(null);
  const [activePanel, setActivePanel] = useState('editor');
  const [isGenerating, setIsGenerating] = useState(false);
  const [promos, setPromos] = useState({});
  const [customCards, setCustomCards] = useState([]);
  const [editingCustomCardIndex, setEditingCustomCardIndex] = useState(null);
  const [cornerRadius, setCornerRadius] = useState(0);
  const [previewScale, setPreviewScale] = useState(1);
  const [isColorsExpanded, setIsColorsExpanded] = useState(true);
  const [isValuesExpanded, setIsValuesExpanded] = useState(true);
  const [notification, setNotification] = useState(null);
  const [showWiki, setShowWiki] = useState(false);
  const [selectedTool, setSelectedTool] = useState(null);
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
  const fileInputRef = useRef(null);
  const [language, setLanguage] = useState('hu');

  const t = (key, params) => {
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
    if (savedLang) setLanguage(savedLang);

    fetch('./promos.json')
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

  const showNotification = (message, type = 'success') => setNotification({ message, type });

  const parsePattern = (pattern) => {
    const cells = [];
    pattern.forEach(row => {
      for (let i = 0; i < row.length; i++) {
        const char = row[i].toLowerCase();
        const cell = { color: '.', value: '.' };
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

  const serializePattern = (cells) => {
    const pattern = [];
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

  const loadPromo = (name) => {
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

  const loadCustomCard = (idx) => {
    const card = customCards[idx];
    if (!card) return;
    setCurrentCard(JSON.parse(JSON.stringify(card)));
    setEditingCustomCardIndex(idx);
  };

  const deleteCustomCard = (idx) => {
    const newCustomCards = customCards.filter((_, i) => i !== idx);
    setCustomCards(newCustomCards);
    localStorage.setItem('customCards', JSON.stringify(newCustomCards));
    if (editingCustomCardIndex === idx) setEditingCustomCardIndex(null);
  };

  const handleExport = (cards, filename) => {
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

  const handleImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target?.result);
        const items = Array.isArray(imported) ? imported : [imported];
        const validCards = items.map(item => {
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

  const handleCellClick = (side, index) => {
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

  const handlePickerSelect = (color, value) => {
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
    const newItem = {
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

  return React.createElement('div', { className: "min-h-screen flex flex-col" },
    // Header
    React.createElement('header', { className: "bg-zinc-900 border-b border-zinc-800 px-4 py-3 flex items-center justify-between sticky top-0 z-50" },
      React.createElement('div', { className: "flex items-center gap-3" },
        React.createElement('div', { className: "w-10 h-10 bg-white rounded-lg flex items-center justify-center text-black font-display text-xl" }, "S"),
        React.createElement('h1', { className: "font-display text-xl hidden sm:block text-white" }, t('title'))
      ),
      React.createElement('nav', { className: "flex items-center gap-1 sm:gap-2" },
        ['editor', 'generator', 'saved'].map(panel => 
          React.createElement('button', {
            key: panel,
            onClick: () => setActivePanel(panel),
            className: cn("flex items-center gap-2 px-3 py-2 rounded-lg transition-colors", activePanel === panel ? "bg-white text-black" : "text-zinc-400 hover:bg-zinc-800 hover:text-white")
          }, React.createElement('span', { className: "font-bold" }, t(panel === 'saved' ? 'savedPatterns' : panel === 'generator' ? 'generation' : panel)))
        ),
        React.createElement('button', {
          onClick: () => setActivePanel('queue'),
          className: cn("flex items-center gap-2 px-3 py-2 rounded-lg transition-colors relative", activePanel === 'queue' ? "bg-white text-black" : "text-zinc-400 hover:bg-zinc-800 hover:text-white")
        }, React.createElement(Printer, { size: 18 }), React.createElement('span', { className: "hidden md:inline" }, t('print')), queue.length > 0 && React.createElement('span', { className: "absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-zinc-900" }, queue.length)),
        React.createElement('button', {
          onClick: () => setActivePanel('settings'),
          className: cn("flex items-center gap-2 px-3 py-2 rounded-lg transition-colors", activePanel === 'settings' ? "bg-white text-black" : "text-zinc-400 hover:bg-zinc-800 hover:text-white")
        }, React.createElement(Settings, { size: 18 }), React.createElement('span', { className: "hidden md:inline" }, t('settings'))),
        React.createElement('div', { className: "flex items-center bg-zinc-800 rounded-lg p-1 ml-2 border border-zinc-700" },
          ['hu', 'en', 'de'].map(lang => 
            React.createElement('button', {
              key: lang,
              onClick: () => setLanguage(lang),
              className: cn("px-2 py-1 text-[10px] font-bold uppercase tracking-widest rounded-md transition-all", language === lang ? "bg-white text-black shadow-lg" : "text-zinc-500 hover:text-zinc-300")
            }, lang)
          )
        )
      )
    ),
    // Main Content
    React.createElement('main', { className: "flex-1 flex flex-col md:flex-row overflow-hidden", onClick: () => setSelectedTool(null) },
      // Left Sidebar
      React.createElement('aside', { className: "w-full md:w-64 lg:w-72 bg-zinc-900 border-r border-zinc-800 flex flex-col overflow-y-auto shrink-0" },
        React.createElement(AnimatePresence, { mode: "wait" },
          activePanel === 'editor' && React.createElement(motion.div, { key: "editor", initial: { opacity: 0, x: -20 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: -20 }, className: "p-6 space-y-8" },
            React.createElement('section', { className: "space-y-4" },
              React.createElement('h2', { className: "text-sm font-bold uppercase tracking-wider text-zinc-500" }, t('cardData')),
              React.createElement('div', { className: "space-y-3" },
                React.createElement('label', { className: "text-xs font-medium text-zinc-500 mb-1 block" }, t('cardName')),
                React.createElement('input', {
                  type: "text",
                  value: currentCard.title,
                  onChange: (e) => setCurrentCard(prev => ({ ...prev, title: e.target.value })),
                  className: "w-full px-3 py-2 bg-zinc-800 border border-zinc-700 text-white rounded-lg focus:ring-2 focus:ring-white focus:border-transparent outline-none transition-all",
                  placeholder: t('patternName')
                })
              )
            ),
            React.createElement('section', { className: "space-y-4" },
              React.createElement('div', { className: "flex items-center justify-between" },
                React.createElement('h2', { className: "text-sm font-bold uppercase tracking-wider text-zinc-500" }, t('palette')),
                isDoubleSided && React.createElement('div', { className: "flex bg-zinc-800 p-1 rounded-lg" },
                  ['front', 'back'].map(side => 
                    React.createElement('button', {
                      key: side,
                      onClick: () => setActiveSide(side),
                      className: cn("px-3 py-1 text-xs font-bold rounded-md transition-all", activeSide === side ? "bg-zinc-700 shadow-sm text-white" : "text-zinc-500")
                    }, t(side))
                  )
                )
              ),
              React.createElement('div', { className: "space-y-4" },
                // Colors
                React.createElement('div', { className: "bg-zinc-900/50 rounded-xl border border-zinc-800 overflow-hidden" },
                  React.createElement('button', { onClick: () => setIsColorsExpanded(!isColorsExpanded), className: "w-full px-4 py-3 flex items-center justify-between hover:bg-zinc-800/50 transition-colors" },
                    React.createElement('span', { className: "text-xs font-bold text-zinc-400 uppercase tracking-widest" }, t('colors')),
                    React.createElement(motion.div, { animate: { rotate: isColorsExpanded ? 90 : 0 } }, React.createElement(ChevronRight, { size: 14, className: "text-zinc-600" }))
                  ),
                  React.createElement(AnimatePresence, null, isColorsExpanded && React.createElement(motion.div, { initial: { height: 0, opacity: 0 }, animate: { height: 'auto', opacity: 1 }, exit: { height: 0, opacity: 0 }, className: "px-4 pb-4" },
                    React.createElement('div', { className: "grid grid-cols-3 gap-2" },
                      COLORS.filter(c => c.id !== '.').map(color => 
                        React.createElement('button', {
                          key: color.id,
                          onClick: (e) => { e.stopPropagation(); handlePickerSelect(color.id); },
                          className: cn("aspect-square rounded-md border-2 transition-all flex items-center justify-center", selectedTool?.value === color.id ? "border-white scale-105 shadow-md" : "border-transparent hover:scale-105"),
                          style: { backgroundColor: color.hex },
                          title: color.label
                        })
                      )
                    )
                  ))
                ),
                // Values
                React.createElement('div', { className: "bg-zinc-900/50 rounded-xl border border-zinc-800 overflow-hidden" },
                  React.createElement('button', { onClick: () => setIsValuesExpanded(!isValuesExpanded), className: "w-full px-4 py-3 flex items-center justify-between hover:bg-zinc-800/50 transition-colors" },
                    React.createElement('span', { className: "text-xs font-bold text-zinc-400 uppercase tracking-widest" }, t('values')),
                    React.createElement(motion.div, { animate: { rotate: isValuesExpanded ? 90 : 0 } }, React.createElement(ChevronRight, { size: 14, className: "text-zinc-600" }))
                  ),
                  React.createElement(AnimatePresence, null, isValuesExpanded && React.createElement(motion.div, { initial: { height: 0, opacity: 0 }, animate: { height: 'auto', opacity: 1 }, exit: { height: 0, opacity: 0 }, className: "px-4 pb-4" },
                    React.createElement('div', { className: "grid grid-cols-3 gap-2" },
                      ['1', '2', '3', '4', '5', '6', 'X', '.', '.'].map((val, idx) => {
                        if (idx === 8) return React.createElement('button', { key: "trash", onClick: (e) => { e.stopPropagation(); handlePickerSelect(undefined, '.'); }, className: "aspect-square rounded-md border-2 bg-zinc-800 flex items-center justify-center transition-all border-transparent hover:bg-zinc-700 hover:scale-105" }, React.createElement(Trash2, { size: 16, className: "text-red-500" }));
                        if (idx === 7) return React.createElement('div', { key: "empty" });
                        return React.createElement('button', {
                          key: val,
                          onClick: (e) => { e.stopPropagation(); handlePickerSelect(undefined, val); },
                          className: cn("aspect-square rounded-md border-2 bg-zinc-800 flex items-center justify-center transition-all overflow-hidden", selectedTool?.value === val ? "border-white bg-zinc-700 scale-105 shadow-md" : "border-transparent hover:bg-zinc-700 hover:scale-105")
                        }, val === 'X' ? React.createElement('span', { className: "font-display text-xl text-zinc-500" }, "X") : React.createElement('img', { src: `./PNG/${val}.png`, className: "w-full h-full object-contain", onError: (e) => { e.currentTarget.onerror = null; e.currentTarget.src = getValueSvgDataUrl(val); } }));
                      })
                    )
                  ))
                )
              )
            ),
            React.createElement('div', { className: "pt-4 space-y-4" },
              React.createElement('button', { onClick: addToQueue, className: "w-full flex items-center justify-center gap-2 bg-white text-black py-4 rounded-xl font-bold hover:bg-zinc-200 transition-colors shadow-lg active:scale-95" }, React.createElement(Plus, { size: 20 }), t('addToQueue')),
              React.createElement('button', { onClick: () => setCurrentCard(prev => ({ ...prev, cells: createEmptyGrid() })), className: "w-full flex items-center justify-center gap-2 bg-transparent text-zinc-600 py-2 rounded-lg text-[10px] font-bold hover:text-red-500 transition-colors uppercase tracking-widest" }, React.createElement(Trash2, { size: 14 }), t('clearQueue')),
              React.createElement('button', { onClick: () => saveCard(editingCustomCardIndex !== null), className: cn("w-full flex items-center justify-center gap-2 py-4 rounded-xl text-xs font-bold transition-all active:scale-95 shadow-lg", editingCustomCardIndex !== null ? "bg-blue-600 text-white" : "bg-zinc-100 text-black") }, React.createElement(Download, { size: 16 }), editingCustomCardIndex !== null ? t('cardUpdated') : t('savePattern'))
            )
          )
        )
      ),
      // Preview Area
      React.createElement('section', { className: "flex-1 bg-zinc-950 flex flex-col items-center justify-center p-8 relative overflow-hidden", onClick: () => { setActiveCell(null); setSelectedTool(null); }, style: showBackground ? { backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.05) 1px, transparent 0)', backgroundSize: '24px 24px' } : {} },
        isDoubleSided && React.createElement('div', { className: "absolute top-6 left-1/2 -translate-x-1/2 flex items-center gap-4 z-10" },
          React.createElement('button', { onClick: () => setActiveSide('front'), className: cn("px-4 py-2 rounded-full text-xs font-bold transition-all shadow-sm", activeSide === 'front' ? "bg-white text-black scale-110" : "bg-zinc-800 text-zinc-500") }, t('front')),
          React.createElement('button', { onClick: () => setActiveSide(activeSide === 'front' ? 'back' : 'front'), className: "w-10 h-10 bg-zinc-800 rounded-full flex items-center justify-center shadow-md hover:scale-110 transition-transform text-zinc-400" }, React.createElement(FlipHorizontal, { size: 20 })),
          React.createElement('button', { onClick: () => setActiveSide('back'), className: cn("px-4 py-2 rounded-full text-xs font-bold transition-all shadow-sm", activeSide === 'back' ? "bg-white text-black scale-110" : "bg-zinc-800 text-zinc-500") }, t('back'))
        ),
        React.createElement('div', { className: "preview-card-wrapper", onClick: (e) => e.stopPropagation() },
          React.createElement('div', { className: "preview-card-container preview-glow", style: { transform: `scale(${previewScale})` } },
            React.createElement(Card, {
              data: currentCard,
              activeCellIndex: activeCell?.side === activeSide ? activeCell.index : null,
              onCellClick: (idx) => handleCellClick(activeSide, idx),
              onDifficultyChange: (diff) => setCurrentCard(prev => ({ ...prev, difficulty: diff })),
              cornerRadius: cornerRadius,
              editable: true
            })
          )
        )
      )
    ),
    // Footer
    React.createElement('footer', { className: "bg-zinc-950 border-t border-zinc-900 px-6 py-4 flex items-center justify-between text-zinc-600 text-[10px] font-bold uppercase tracking-widest" },
      React.createElement('div', null, "© 2026 Sagrada Pattern Designer. ", t('allRightsReserved')),
      React.createElement('div', { className: "flex items-center gap-4" }, React.createElement('span', null, "Design by: hrvthgrgly@gmail.com"), React.createElement('span', null, t('version'), ": v1.3.0"))
    ),
    // Notification
    React.createElement(AnimatePresence, null, notification && React.createElement(motion.div, { initial: { opacity: 0, y: 50, x: '-50%' }, animate: { opacity: 1, y: 0, x: '-50%' }, exit: { opacity: 0, y: 50, x: '-50%' }, className: cn("fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 rounded-xl shadow-2xl font-bold flex items-center gap-3 border", notification.type === 'success' ? "bg-zinc-900 text-white border-zinc-700" : "bg-red-950 text-red-200 border-red-900") }, React.createElement(notification.type === 'success' ? Check : Info, { size: 18, className: notification.type === 'success' ? "text-green-500" : "text-red-500" }), notification.message))
  );
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(React.createElement(App));
