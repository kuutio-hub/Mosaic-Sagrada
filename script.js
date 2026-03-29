// Sagrada Pattern Designer v0.0.3.0 - Vanilla JS Version
const APP_VERSION = "0.0.3.0";

// --- Constants ---
const COLORS = [
    { id: 'R', name: 'Piros', hex: '#ef4444' },
    { id: 'G', name: 'Zöld', hex: '#22c55e' },
    { id: 'B', name: 'Kék', hex: '#3b82f6' },
    { id: 'Y', name: 'Sárga', hex: '#eab308' },
    { id: 'P', name: 'Lila', hex: '#a855f7' },
    { id: 'W', name: 'Fehér', hex: '#ffffff' },
    { id: '.', name: 'Üres', hex: 'transparent' }
];

const VALUES = ['1', '2', '3', '4', '5', '6', '.', 'X'];

const DEFAULT_FRONT = {
    title: "Minta kártya",
    difficulty: 3,
    cells: Array(20).fill(null).map(() => ({ color: '.', value: '.' })),
    code: "FRONT-001",
    titleFont: "Uncial Antiqua",
    titleSize: 14,
    cornerRadius: 0
};

const DEFAULT_BACK = {
    title: "Minta kártya (hátlap)",
    difficulty: 4,
    cells: Array(20).fill(null).map(() => ({ color: '.', value: '.' })),
    code: "BACK-001",
    titleFont: "Uncial Antiqua",
    titleSize: 14,
    cornerRadius: 0
};

// --- State ---
let state = {
    front: JSON.parse(JSON.stringify(DEFAULT_FRONT)),
    back: JSON.parse(JSON.stringify(DEFAULT_BACK)),
    queue: [],
    activeSide: 'front',
    isDoubleSided: true,
    activeCell: null, // { side: 'front'|'back', index: number }
    activePanel: 'editor',
    promos: {},
    customCards: [],
    editingCustomCardIndex: null,
    cornerRadius: 0,
    previewScale: 1,
    isColorsExpanded: true,
    isValuesExpanded: true,
    selectedColor: null,
    selectedValue: null
};

// --- Helpers ---
const generateId = () => Math.random().toString(36).substr(2, 9).toUpperCase();

const getDiceSvgDataUrl = (value, color) => {
    const dots = {
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

const parsePattern = (pattern) => {
    const cells = [];
    pattern.forEach(row => {
        for (let i = 0; i < row.length; i++) {
            const char = row[i].toLowerCase();
            const cell = { color: '.', value: '.' };
            
            if (char >= '1' && char <= '6') {
                cell.value = char;
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

// --- UI Logic ---
const shrinkTitleToFit = (cardEl) => {
    const container = cardEl.querySelector('.card-title-container');
    const title = cardEl.querySelector('.card-title');
    if (!container || !title) return;

    let fontSize = parseFloat(title.style.fontSize);
    const minFontSize = 6;
    
    // Reset to original size first to measure
    title.style.fontSize = `${fontSize}pt`;

    while (title.scrollWidth > container.clientWidth && fontSize > minFontSize) {
        fontSize -= 0.5;
        title.style.fontSize = `${fontSize}pt`;
    }
};

const showNotification = (message, type = 'success') => {
    const container = document.getElementById('notification-container');
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    container.appendChild(notification);
    
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateY(20px)';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
};

const updateBadge = () => {
    const badge = document.getElementById('queue-badge');
    const count = state.queue.length;
    if (count > 0) {
        badge.textContent = count;
        badge.classList.remove('hidden');
    } else {
        badge.classList.add('hidden');
    }
    document.getElementById('queue-count').textContent = `${count} / 6`;
    document.getElementById('queue-status').textContent = `${count} kártya a listán`;
    
    const actions = document.getElementById('queue-actions');
    if (count > 0) {
        actions.classList.remove('hidden');
    } else {
        actions.classList.add('hidden');
    }
};

const renderCard = (cardData, containerId, isMini = false) => {
    const container = typeof containerId === 'string' ? document.getElementById(containerId) : containerId;
    if (!container) return;

    const radius = state.cornerRadius;
    const side = state.activeSide;

    container.innerHTML = `
        <div class="sagrada-card ${isMini ? 'mini' : ''}" style="border-radius: ${radius}mm; font-family: '${cardData.titleFont || 'Uncial Antiqua'}';">
            <div class="card-header">
                <div class="card-title-container">
                    <span class="card-title" style="font-size: ${cardData.titleSize || 14}pt;">${cardData.title}</span>
                </div>
                <div class="card-difficulty">
                    ${[1,2,3,4,5,6].map(d => `
                        <div class="difficulty-dot ${d <= cardData.difficulty ? 'active' : ''}" data-difficulty="${d}"></div>
                    `).join('')}
                </div>
            </div>
            <div class="card-grid">
                ${cardData.cells.map((cell, idx) => {
                    const isActive = state.activeCell && state.activeCell.side === side && state.activeCell.index === idx;
                    const diceUrl = (cell.value >= '1' && cell.value <= '6') ? getDiceSvgDataUrl(cell.value, cell.color) : '';
                    return `
                        <div class="card-cell color-${cell.color} ${isActive ? 'active' : ''}" data-index="${idx}">
                            ${diceUrl ? `<img src="${diceUrl}" alt="${cell.value}" referrerPolicy="no-referrer">` : ''}
                            ${cell.value === 'X' ? '<span class="text-zinc-500 font-bold">X</span>' : ''}
                        </div>
                    `;
                }).join('')}
            </div>
            <div class="card-footer">
                <span class="card-code">${cardData.code}</span>
            </div>
        </div>
    `;

    const cardEl = container.querySelector('.sagrada-card');
    shrinkTitleToFit(cardEl);

    // Add event listeners to cells
    if (!isMini) {
        container.querySelectorAll('.card-cell').forEach(cell => {
            cell.addEventListener('click', (e) => {
                const index = parseInt(e.currentTarget.dataset.index);
                state.activeCell = { side: state.activeSide, index };
                updateUI();
            });
        });

        // Add event listeners to difficulty dots
        container.querySelectorAll('.difficulty-dot').forEach(dot => {
            dot.addEventListener('click', (e) => {
                e.stopPropagation();
                const d = parseInt(e.currentTarget.dataset.difficulty);
                const current = state.activeSide === 'front' ? state.front : state.back;
                current.difficulty = d;
                updateUI();
            });
        });
    }
};

const renderPalette = () => {
    const colorsContainer = document.getElementById('palette-colors');
    const valuesContainer = document.getElementById('palette-values');

    colorsContainer.innerHTML = COLORS.map(c => `
        <div class="palette-item color-${c.id} ${state.selectedColor === c.id ? 'active' : ''}" data-color="${c.id}" title="${c.name}">
            ${c.id === '.' ? '<i data-lucide="trash-2" class="w-5 h-5 text-red-500"></i>' : ''}
        </div>
    `).join('');

    valuesContainer.innerHTML = VALUES.map(v => `
        <div class="palette-item ${state.selectedValue === v ? 'active' : ''} ${v === 'X' ? 'special-X' : ''} ${v === '.' ? 'special-clear' : ''}" data-value="${v}">
            ${v === '.' ? '<i data-lucide="trash-2" class="w-5 h-5 text-red-500"></i>' : (v === 'X' ? 'X' : v)}
        </div>
    `).join('');

    lucide.createIcons();

    // Add event listeners
    colorsContainer.querySelectorAll('.palette-item').forEach(item => {
        item.addEventListener('click', (e) => {
            const color = e.currentTarget.dataset.color;
            state.selectedColor = state.selectedColor === color ? null : color;
            state.selectedValue = null;
            applyToActiveCell();
            updateUI();
        });
    });

    valuesContainer.querySelectorAll('.palette-item').forEach(item => {
        item.addEventListener('click', (e) => {
            const value = e.currentTarget.dataset.value;
            state.selectedValue = state.selectedValue === value ? null : value;
            state.selectedColor = null;
            applyToActiveCell();
            updateUI();
        });
    });
};

const applyToActiveCell = () => {
    if (!state.activeCell) return;
    const { side, index } = state.activeCell;
    const card = side === 'front' ? state.front : state.back;
    const cell = card.cells[index];

    if (state.selectedColor) {
        cell.color = state.selectedColor;
    } else if (state.selectedValue) {
        cell.value = state.selectedValue;
    }
};

const renderQueue = () => {
    const list = document.getElementById('queue-list');
    list.innerHTML = state.queue.map((item, idx) => `
        <div class="queue-item">
            <div class="queue-mini-preview">
                <div id="mini-preview-${idx}"></div>
            </div>
            <div class="queue-info">
                <div class="queue-title">${item.front.title}</div>
                <div class="queue-meta">
                    ${item.isDoubleSided ? '<i data-lucide="flip-horizontal" class="w-3 h-3"></i> 2-oldalas' : '1-oldalas'}
                    <span class="mx-1">•</span>
                    <div class="flex gap-0.5">
                        ${Array(item.front.difficulty).fill(0).map(() => '<div class="w-1.5 h-1.5 rounded-full bg-white"></div>').join('')}
                    </div>
                </div>
            </div>
            <button class="remove-from-queue p-2 text-zinc-600 hover:text-red-500" data-index="${idx}">
                <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
        </div>
    `).join('');

    state.queue.forEach((item, idx) => {
        renderCard(item.front, `mini-preview-${idx}`, true);
    });

    lucide.createIcons();

    list.querySelectorAll('.remove-from-queue').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = parseInt(e.currentTarget.dataset.index);
            state.queue.splice(idx, 1);
            updateUI();
        });
    });
};

const renderDropdowns = () => {
    const promoSelect = document.getElementById('promo-select');
    const customSelect = document.getElementById('custom-select');

    // Promos
    const promoOptions = Object.keys(state.promos).map(name => `<option value="${name}">${name}</option>`).join('');
    promoSelect.innerHTML = '<option value="" disabled selected>Minta kártyák</option>' + promoOptions;

    // Custom
    const customOptions = state.customCards.map((c, idx) => `<option value="${idx}">${c.title}</option>`).join('');
    customSelect.innerHTML = '<option value="" disabled selected>Saját kártyák</option>' + customOptions;

    const deleteBtn = document.getElementById('delete-custom');
    if (state.editingCustomCardIndex !== null) {
        deleteBtn.classList.remove('hidden');
    } else {
        deleteBtn.classList.add('hidden');
    }
};

const updateUI = () => {
    // Panels
    ['editor', 'queue', 'settings'].forEach(p => {
        const panel = document.getElementById(`panel-${p}`);
        const nav = document.getElementById(`nav-${p}`);
        if (state.activePanel === p) {
            panel.classList.remove('hidden');
            nav.classList.add('bg-white', 'text-black');
            nav.classList.remove('text-zinc-400');
        } else {
            panel.classList.add('hidden');
            nav.classList.remove('bg-white', 'text-black');
            nav.classList.add('text-zinc-400');
        }
    });

    // Preview Side
    const frontBtn = document.getElementById('preview-front-btn');
    const backBtn = document.getElementById('preview-back-btn');
    if (state.activeSide === 'front') {
        frontBtn.classList.add('bg-white', 'text-black', 'scale-110');
        frontBtn.classList.remove('bg-zinc-800', 'text-zinc-500');
        backBtn.classList.remove('bg-white', 'text-black', 'scale-110');
        backBtn.classList.add('bg-zinc-800', 'text-zinc-500');
        document.getElementById('side-front').classList.add('bg-zinc-700', 'text-white');
        document.getElementById('side-back').classList.remove('bg-zinc-700', 'text-white');
        document.getElementById('status-text').textContent = "Előlap szerkesztése";
    } else {
        backBtn.classList.add('bg-white', 'text-black', 'scale-110');
        backBtn.classList.remove('bg-zinc-800', 'text-zinc-500');
        frontBtn.classList.remove('bg-white', 'text-black', 'scale-110');
        frontBtn.classList.add('bg-zinc-800', 'text-zinc-500');
        document.getElementById('side-back').classList.add('bg-zinc-700', 'text-white');
        document.getElementById('side-front').classList.remove('bg-zinc-700', 'text-white');
        document.getElementById('status-text').textContent = "Hátlap szerkesztése";
    }

    // Inputs
    const current = state.activeSide === 'front' ? state.front : state.back;
    document.getElementById('card-title-input').value = current.title;
    document.getElementById('font-select').value = current.titleFont || "Uncial Antiqua";
    document.getElementById('size-value').textContent = current.titleSize || 14;
    document.getElementById('radius-value').textContent = state.cornerRadius;
    document.getElementById('radius-slider').value = state.cornerRadius;
    document.getElementById('zoom-value').textContent = `${Math.round(state.previewScale * 100)}%`;
    document.getElementById('card-preview-container').style.transform = `scale(${state.previewScale})`;

    // Render components
    renderCard(current, 'card-preview-container');
    renderPalette();
    renderQueue();
    renderDropdowns();
    updateBadge();
    lucide.createIcons();
};

// --- PDF Generation ---
const generatePDF = async () => {
    if (state.queue.length === 0) {
        showNotification("A nyomtatási lista üres!", "error");
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = 210;
    const pageHeight = 297;
    const cardWidth = 64;
    const cardHeight = 51;
    const marginX = (pageWidth - (cardWidth * 2 + 10)) / 2;
    const marginY = 20;
    const gapX = 10;
    const gapY = 10;

    showNotification("PDF generálása folyamatban...");

    const renderBatchPage = async (batch, side) => {
        const container = document.createElement('div');
        container.id = 'print-container';
        container.style.width = '210mm';
        container.style.background = 'white';
        container.style.position = 'fixed';
        container.style.top = '-5000px';
        container.style.left = '0';
        document.body.appendChild(container);

        batch.forEach((item, idx) => {
            const cardData = side === 'front' ? item.front : item.back;
            const col = side === 'back' ? (1 - (idx % 2)) : (idx % 2);
            const row = Math.floor(idx / 2);
            
            const cardEl = document.createElement('div');
            cardEl.className = 'sagrada-card';
            cardEl.style.position = 'absolute';
            cardEl.style.left = `${marginX + col * (cardWidth + gapX)}mm`;
            cardEl.style.top = `${marginY + row * (cardHeight + gapY)}mm`;
            cardEl.style.width = `${cardWidth}mm`;
            cardEl.style.height = `${cardHeight}mm`;
            cardEl.style.borderRadius = `${state.cornerRadius}mm`;
            cardEl.style.fontFamily = `'${cardData.titleFont || 'Uncial Antiqua'}'`;
            cardEl.style.background = 'black';
            cardEl.style.border = '1px solid #333';
            cardEl.style.padding = '2mm';

            cardEl.innerHTML = `
                <div class="card-header" style="height: 6mm; margin-bottom: 2mm;">
                    <div class="card-title-container">
                        <span class="card-title" style="font-size: ${cardData.titleSize || 14}pt; color: white;">${cardData.title}</span>
                    </div>
                    <div class="card-difficulty" style="gap: 1mm;">
                        ${[1,2,3,4,5,6].map(d => `
                            <div class="difficulty-dot ${d <= cardData.difficulty ? 'active' : ''}" style="width: 1.5mm; height: 1.5mm; background: ${d <= cardData.difficulty ? 'white' : '#333'}; border-radius: 50%;"></div>
                        `).join('')}
                    </div>
                </div>
                <div class="card-grid" style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 1mm; flex: 1;">
                    ${cardData.cells.map(cell => {
                        const diceUrl = (cell.value >= '1' && cell.value <= '6') ? getDiceSvgDataUrl(cell.value, cell.color) : '';
                        const colorHex = COLORS.find(c => c.id === cell.color)?.hex || 'transparent';
                        return `
                            <div class="card-cell" style="aspect-ratio: 1; background: ${colorHex}; border-radius: 1mm; display: flex; items-center; justify-content: center;">
                                ${diceUrl ? `<img src="${diceUrl}" style="width: 80%; height: 80%;">` : ''}
                                ${cell.value === 'X' ? '<span style="color: #666; font-weight: bold; font-size: 8pt;">X</span>' : ''}
                            </div>
                        `;
                    }).join('')}
                </div>
                <div class="card-footer" style="margin-top: 1mm; text-align: right;">
                    <span class="card-code" style="font-size: 6pt; color: #444;">${cardData.code}</span>
                </div>
            `;
            container.appendChild(cardEl);
            shrinkTitleToFit(cardEl);
        });

        const canvas = await html2canvas(container, {
            scale: 3,
            useCORS: true,
            backgroundColor: '#ffffff'
        });
        
        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        doc.addImage(imgData, 'JPEG', 0, 0, pageWidth, pageHeight);
        document.body.removeChild(container);
    };

    for (let i = 0; i < state.queue.length; i += 6) {
        const batch = state.queue.slice(i, i + 6);
        
        // Front side
        if (i > 0) doc.addPage();
        await renderBatchPage(batch, 'front');
        
        // Back side if any card is double sided
        const hasDouble = batch.some(item => item.isDoubleSided);
        if (hasDouble) {
            doc.addPage();
            await renderBatchPage(batch, 'back');
        }
    }

    doc.save(`sagrada-patterns-${new Date().getTime()}.pdf`);
    showNotification("PDF sikeresen letöltve!");
};

// --- Initialization & Events ---
document.addEventListener('DOMContentLoaded', () => {
    // Load Promos
    fetch('data/promos.json')
        .then(res => res.json())
        .then(data => {
            state.promos = data;
            updateUI();
        })
        .catch(err => console.error("Failed to load promos:", err));

    // Load Custom
    const saved = localStorage.getItem('customCards');
    if (saved) {
        try {
            state.customCards = JSON.parse(saved);
        } catch (e) {
            console.error("Failed to parse customCards:", e);
        }
    }

    // Navigation
    document.getElementById('nav-editor').addEventListener('click', () => { state.activePanel = 'editor'; updateUI(); });
    document.getElementById('nav-queue').addEventListener('click', () => { state.activePanel = 'queue'; updateUI(); });
    document.getElementById('nav-settings').addEventListener('click', () => { state.activePanel = 'settings'; updateUI(); });

    // Editor Events
    document.getElementById('card-title-input').addEventListener('input', (e) => {
        const current = state.activeSide === 'front' ? state.front : state.back;
        current.title = e.target.value;
        updateUI();
    });

    document.getElementById('side-front').addEventListener('click', () => { state.activeSide = 'front'; updateUI(); });
    document.getElementById('side-back').addEventListener('click', () => { state.activeSide = 'back'; updateUI(); });
    document.getElementById('preview-front-btn').addEventListener('click', () => { state.activeSide = 'front'; updateUI(); });
    document.getElementById('preview-back-btn').addEventListener('click', () => { state.activeSide = 'back'; updateUI(); });
    document.getElementById('preview-flip-btn').addEventListener('click', () => {
        state.activeSide = state.activeSide === 'front' ? 'back' : 'front';
        updateUI();
    });

    document.getElementById('toggle-colors').addEventListener('click', () => {
        state.isColorsExpanded = !state.isColorsExpanded;
        document.getElementById('colors-palette').classList.toggle('hidden');
        document.getElementById('toggle-colors').querySelector('i').classList.toggle('rotate-90');
    });

    document.getElementById('toggle-values').addEventListener('click', () => {
        state.isValuesExpanded = !state.isValuesExpanded;
        document.getElementById('values-palette').classList.toggle('hidden');
        document.getElementById('toggle-values').querySelector('i').classList.toggle('rotate-90');
    });

    document.getElementById('clear-grid').addEventListener('click', () => {
        const current = state.activeSide === 'front' ? state.front : state.back;
        current.cells = Array(20).fill(null).map(() => ({ color: '.', value: '.' }));
        updateUI();
    });

    document.getElementById('add-to-queue').addEventListener('click', () => {
        state.queue.push({
            id: generateId(),
            front: JSON.parse(JSON.stringify(state.front)),
            back: JSON.parse(JSON.stringify(state.back)),
            isDoubleSided: true // Default to double sided
        });
        showNotification("Kártya hozzáadva a listához!");
        updateUI();
    });

    document.getElementById('save-custom').addEventListener('click', () => {
        const current = state.activeSide === 'front' ? state.front : state.back;
        if (state.editingCustomCardIndex !== null) {
            state.customCards[state.editingCustomCardIndex] = JSON.parse(JSON.stringify(current));
            showNotification("Kártya frissítve!");
        } else {
            state.customCards.push(JSON.parse(JSON.stringify(current)));
            state.editingCustomCardIndex = state.customCards.length - 1;
            showNotification("Kártya elmentve!");
        }
        localStorage.setItem('customCards', JSON.stringify(state.customCards));
        updateUI();
    });

    // Dropdowns
    document.getElementById('promo-select').addEventListener('change', (e) => {
        const name = e.target.value;
        const promo = state.promos[name];
        if (promo) {
            const current = state.activeSide === 'front' ? state.front : state.back;
            current.title = name;
            current.difficulty = promo.difficulty;
            current.cells = parsePattern(promo.pattern);
            current.code = promo.code;
            state.editingCustomCardIndex = null;
            updateUI();
        }
    });

    document.getElementById('custom-select').addEventListener('change', (e) => {
        const idx = parseInt(e.target.value);
        const card = state.customCards[idx];
        if (card) {
            const current = state.activeSide === 'front' ? state.front : state.back;
            Object.assign(current, JSON.parse(JSON.stringify(card)));
            state.editingCustomCardIndex = idx;
            updateUI();
        }
    });

    document.getElementById('delete-custom').addEventListener('click', () => {
        if (state.editingCustomCardIndex !== null) {
            state.customCards.splice(state.editingCustomCardIndex, 1);
            state.editingCustomCardIndex = null;
            localStorage.setItem('customCards', JSON.stringify(state.customCards));
            showNotification("Kártya törölve!");
            updateUI();
        }
    });

    // Settings
    document.getElementById('zoom-in').addEventListener('click', () => { state.previewScale = Math.min(2, state.previewScale + 0.1); updateUI(); });
    document.getElementById('zoom-out').addEventListener('click', () => { state.previewScale = Math.max(0.5, state.previewScale - 0.1); updateUI(); });
    
    document.getElementById('font-select').addEventListener('change', (e) => {
        const current = state.activeSide === 'front' ? state.front : state.back;
        current.titleFont = e.target.value;
        updateUI();
    });

    document.getElementById('size-increase').addEventListener('click', () => {
        const current = state.activeSide === 'front' ? state.front : state.back;
        current.titleSize = (current.titleSize || 14) + 1;
        updateUI();
    });

    document.getElementById('size-decrease').addEventListener('click', () => {
        const current = state.activeSide === 'front' ? state.front : state.back;
        current.titleSize = Math.max(6, (current.titleSize || 14) - 1);
        updateUI();
    });

    document.getElementById('radius-slider').addEventListener('input', (e) => {
        state.cornerRadius = parseFloat(e.target.value);
        updateUI();
    });

    // Export/Import
    document.getElementById('export-presets').addEventListener('click', () => {
        const cards = Object.entries(state.promos).map(([name, p]) => ({
            title: name,
            difficulty: p.difficulty,
            cells: parsePattern(p.pattern),
            code: p.code
        }));
        handleExport(cards, 'sagrada-presets');
    });

    document.getElementById('export-custom').addEventListener('click', () => {
        handleExport(state.customCards, 'sagrada-custom');
    });

    document.getElementById('import-input').addEventListener('change', handleImport);

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

    function handleImport(e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const imported = JSON.parse(event.target.result);
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
                    return null;
                }).filter(c => c !== null);
                
                if (validCards.length > 0) {
                    state.customCards = [...state.customCards, ...validCards];
                    localStorage.setItem('customCards', JSON.stringify(state.customCards));
                    showNotification(`${validCards.length} kártya importálva!`);
                    updateUI();
                }
            } catch (err) {
                showNotification("Hiba az importálás során!", "error");
            }
        };
        reader.readAsText(file);
    }

    // PDF Buttons
    document.getElementById('header-pdf-btn').addEventListener('click', generatePDF);
    document.getElementById('queue-pdf-btn').addEventListener('click', generatePDF);
    document.getElementById('clear-queue').addEventListener('click', () => {
        state.queue = [];
        updateUI();
    });

    // Initial Render
    updateUI();
    lucide.createIcons();
});
