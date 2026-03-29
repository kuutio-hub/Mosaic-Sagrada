import { state } from './js/state.js';
import { renderGrid, renderDifficulty, updateQueueUI } from './js/ui.js';
import { addToQueue, removeFromQueue, loadFromQueue, loadPromoCards, loadSavedCardsList, applyCardToState, applySavedCard, deleteSavedCard } from './js/cardManager.js';
import { translations } from './js/i18n.js';
import { generateRandomPattern } from './js/generator.js';

// Service worker eltávolítása, ha van (megoldás a "gura" oldal frissítésre)
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(registrations => {
        for (let registration of registrations) {
            registration.unregister();
        }
    });
}

const APP_VERSION = "0.0.2.5";

// A verziószám rögzítése a footerben
document.addEventListener('DOMContentLoaded', () => {
    const versionEl = document.querySelector('[data-i18n="copyright"]');
    if (versionEl) {
        versionEl.textContent = versionEl.textContent.replace(/v\d+\.\d+\.\d+\.\d+/, `v${APP_VERSION}`);
    }
});

// Zoom state
let currentScale = 1.0;
let activeCell = null;
const SCALE_STEP = 0.1;
const MIN_SCALE = 0.5;
const MAX_SCALE = 2.0;

// Promo kártyák adatai
let promoCards = [];

// SVG Sablonok
const frameSVG = `
<svg width="900" height="800" viewBox="0 0 900 800" fill="none" xmlns="http://www.w3.org/2000/svg">
    <!-- Csak a keret és a díszítés, a kártya alapja a CSS background -->
    <rect x="2" y="2" width="896" height="796" stroke="#333" stroke-width="1" fill="none"/>
    
    <!-- Rács keret -->
    <rect x="15" y="15" width="870" height="670" rx="5" stroke="#222" stroke-width="2" fill="none" class="grid-frame"/>
</svg>
`;

/**
 * PDF exportálás: Milliméter-pontos HTML renderelés és PDF generálás (300 DPI)
 */
window.generatePDF = async function() {
    const { jsPDF } = window.jspdf;
    const isDoubleSided = document.getElementById('double-sided').checked;
    const itemsPerPage = 6;
    const queue = state.patternQueue;
    
    if (queue.length === 0) {
        const lang = document.documentElement.lang || 'hu';
        alert(translations[lang]?.emptyQueue || "A nyomtatási lista üres!");
        return;
    }

    // Create temporary container for rendering
    const printRoot = document.createElement('div');
    printRoot.id = 'print-root';
    printRoot.style.position = 'fixed';
    printRoot.style.left = '-5000mm';
    printRoot.style.top = '0';
    printRoot.style.width = '210mm';
    printRoot.style.zIndex = '-1000';
    document.body.appendChild(printRoot);

    // Add print-specific styles
    const style = document.createElement('style');
    style.textContent = `
        @import url('https://fonts.googleapis.com/css2?family=Uncial+Antiqua&display=swap');
        
        .print-page { 
            width: 210mm; 
            height: 297mm; 
            background: white; 
            position: relative; 
            overflow: hidden;
            display: grid;
            grid-template-columns: 90mm 90mm;
            grid-template-rows: 80mm 80mm 80mm;
            padding: 28.5mm 15mm;
            gap: 0;
            box-sizing: border-box;
        }
        .print-card {
            width: 90mm;
            height: 80mm;
            background: black;
            position: relative;
            box-sizing: border-box;
            border: 0.05mm solid #222;
            overflow: hidden;
        }
        .print-grid {
            position: absolute;
            top: 2.5mm;
            left: 2.5mm;
            display: grid;
            grid-template-columns: repeat(5, 15mm);
            grid-template-rows: repeat(4, 15mm);
            gap: 2.5mm;
        }
        .print-cell {
            width: 15mm;
            height: 15mm;
            background: #f0f0f0;
            border-radius: 1.2mm;
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: 'Uncial Antiqua', serif;
            font-size: 9mm;
            color: #000;
            position: relative;
            box-sizing: border-box;
            border: 0.3mm solid rgba(255,255,255,0.3);
        }
        .print-cell.c-r { background-color: #DC3232; }
        .print-cell.c-g { background-color: #32A050; }
        .print-cell.c-b { background-color: #3264C8; }
        .print-cell.c-y { background-color: #F0C828; }
        .print-cell.c-p { background-color: #8C3CA0; }
        .print-cell.c-w { background-color: #f0f0f0; }
        
        .print-cell.v-x { font-family: Arial, sans-serif; font-weight: bold; font-size: 8mm; color: #fff; }
        .print-cell.c-w.v-x { color: #333; }
        
        .print-dice-img {
            width: 100%;
            height: 100%;
            object-fit: contain;
        }
        
        .print-footer {
            position: absolute;
            bottom: 0;
            left: 0;
            width: 100%;
            height: 10mm;
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 0 4.5mm;
            box-sizing: border-box;
        }
        .print-title {
            font-family: 'Uncial Antiqua', serif;
            font-size: 4.2mm;
            color: white;
            white-space: nowrap;
            overflow: hidden;
            max-width: 60mm;
        }
        .print-difficulty {
            display: flex;
            gap: 1.2mm;
        }
        .print-dot {
            width: 2.4mm;
            height: 2.4mm;
            background: #333;
            border-radius: 50%;
            border: 0.2mm solid #555;
        }
        .print-dot.active {
            background: white;
            border-color: white;
        }
        
        .print-cell.glass-on::after {
            content: "";
            position: absolute;
            top: 0; left: 0; right: 0; bottom: 0;
            background: linear-gradient(135deg, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0) 50%, rgba(255,255,255,0.1) 100%);
            pointer-events: none;
        }
    `;
    printRoot.appendChild(style);

    const doc = new jsPDF('p', 'mm', 'a4');
    const numPages = Math.ceil(queue.length / itemsPerPage);

    for (let p = 0; p < numPages; p++) {
        const pageQueue = queue.slice(p * itemsPerPage, (p + 1) * itemsPerPage);
        
        // Render Front Page
        const frontPage = createPrintPage(pageQueue, 'front');
        printRoot.appendChild(frontPage);
        
        // Wait for images and fonts
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const frontCanvas = await html2canvas(frontPage, { 
            scale: 3.125, // 300 DPI
            useCORS: true,
            backgroundColor: '#ffffff'
        });
        const frontImg = frontCanvas.toDataURL('image/jpeg', 0.95);
        if (p > 0) doc.addPage();
        doc.addImage(frontImg, 'JPEG', 0, 0, 210, 297);
        printRoot.removeChild(frontPage);

        // Render Back Page (if double sided)
        if (isDoubleSided) {
            const backPage = createPrintPage(pageQueue, 'back');
            printRoot.appendChild(backPage);
            
            await new Promise(resolve => setTimeout(resolve, 500));
            
            const backCanvas = await html2canvas(backPage, { 
                scale: 3.125, // 300 DPI
                useCORS: true,
                backgroundColor: '#ffffff'
            });
            const backImg = backCanvas.toDataURL('image/jpeg', 0.95);
            doc.addPage();
            doc.addImage(backImg, 'JPEG', 0, 0, 210, 297);
            printRoot.removeChild(backPage);
        }
    }

    const timestamp = new Date().getTime();
    doc.save(`Sagrada_Cards_${timestamp}.pdf`);
    document.body.removeChild(printRoot);
};

function createPrintPage(items, side) {
    const page = document.createElement('div');
    page.className = 'print-page';
    
    items.forEach(item => {
        const cardData = side === 'front' ? item.frontState : (item.backState || item.frontState);
        const card = document.createElement('div');
        card.className = 'print-card';
        
        // Grid
        const grid = document.createElement('div');
        grid.className = 'print-grid';
        cardData.cells.forEach(cell => {
            const cellDiv = document.createElement('div');
            cellDiv.className = 'print-cell';
            if (cell.color !== '.') {
                cellDiv.classList.add(`c-${cell.color.toLowerCase()}`);
                if (state.glassEffect) cellDiv.classList.add('glass-on');
            }
            
            if (cell.value === 'X') {
                cellDiv.classList.add('v-x');
                cellDiv.textContent = 'X';
            } else if (cell.value !== '.' && !isNaN(cell.value)) {
                const img = document.createElement('img');
                img.src = `Cells/${cell.value}.png`;
                img.className = 'print-dice-img';
                
                // Filter logic to match preview
                if (cell.color === '.') {
                    img.style.filter = 'brightness(0) drop-shadow(0 0 1px rgba(255,255,255,0.8))';
                } else {
                    img.style.filter = 'brightness(0) invert(1) drop-shadow(0 0 1px rgba(0,0,0,0.8))';
                }
                cellDiv.appendChild(img);
            }
            grid.appendChild(cellDiv);
        });
        card.appendChild(grid);
        
        // Footer
        const footer = document.createElement('div');
        footer.className = 'print-footer';
        
        const title = document.createElement('div');
        title.className = 'print-title';
        title.textContent = cardData.title || "";
        footer.appendChild(title);
        
        const diff = document.createElement('div');
        diff.className = 'print-difficulty';
        for (let i = 1; i <= 6; i++) {
            const dot = document.createElement('div');
            dot.className = 'print-dot' + (i <= (cardData.difficulty || 3) ? ' active' : '');
            diff.appendChild(dot);
        }
        footer.appendChild(diff);
        
        card.appendChild(footer);
        page.appendChild(card);
    });
    
    return page;
}

/**
 * Inicializálás
 */
async function init() {
    // Verziószám beállítása
    const versionEl = document.getElementById('app-version');
    if (versionEl) versionEl.textContent = `v${APP_VERSION}`;

    // SVG-k behelyezése
    const frameFront = document.getElementById('frame-front-svg');
    const frameBack = document.getElementById('frame-back-svg');
    if (frameFront) frameFront.innerHTML = frameSVG;
    if (frameBack) frameBack.innerHTML = frameSVG;

    // Rácsok generálása
    renderGrid('front');
    renderGrid('back');

    // Promo kártyák betöltése
    promoCards = await loadPromoCards();

    // Mentett kártyák betöltése
    loadSavedCardsList();

    // Eseménykezelők
    setupEventListeners();
    
    // Set initial language
    updateLanguage('hu');

    // Initial title scaling
    updateTitleScaling('front');
    updateTitleScaling('back');

    // Initial card scaling
    updateCardScaling();

    // Glass effect initial state
    const glassToggle = document.getElementById('glass-effect-toggle');
    if (glassToggle) {
        glassToggle.checked = state.glassEffect || false;
    }
}

/**
 * Picker megnyitása
 */
window.openPicker = function(e, side, index) {
    e.stopPropagation();
    
    // Open the palette panel if it's not open
    togglePanel('panel-palette', true);

    // Remove active class from all cells
    document.querySelectorAll('.cell').forEach(c => c.classList.remove('active'));
    
    // Add active class to clicked cell
    const cell = e.currentTarget;
    cell.classList.add('active');
    
    activeCell = { side, index };
}

/**
 * Picker bezárása
 */
function closePicker() {
    document.querySelectorAll('.cell').forEach(c => c.classList.remove('active'));
    activeCell = null;
}

/**
 * Panel kezelése
 */
function togglePanel(panelId, forceOpen = false) {
    const panels = document.querySelectorAll('.floating-panel');
    const tabs = document.querySelectorAll('.toolbar-tab');
    const targetPanel = document.getElementById(panelId);
    
    if (!targetPanel) return;

    const isOpen = targetPanel.classList.contains('active');

    if (isOpen && !forceOpen) {
        // Close it
        targetPanel.classList.remove('active');
        document.querySelector(`.toolbar-tab[data-target="${panelId}"]`)?.classList.remove('active');
        if (panelId === 'panel-palette') closePicker();
    } else {
        // Close others
        panels.forEach(p => p.classList.remove('active'));
        tabs.forEach(t => t.classList.remove('active'));

        // Open target
        targetPanel.classList.add('active');
        document.querySelector(`.toolbar-tab[data-target="${panelId}"]`)?.classList.add('active');
    }
}

/**
 * Eseménykezelők beállítása
 */
function setupEventListeners() {
    // Toolbar tabs
    document.querySelectorAll('.toolbar-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            e.stopPropagation();
            const panelId = tab.dataset.target;
            togglePanel(panelId);
        });
    });

    // Panel close buttons
    document.querySelectorAll('.close-panel').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const panel = btn.closest('.floating-panel');
            if (panel) togglePanel(panel.id);
        });
    });

    // Double-sided mode toggle
    const doubleSidedToggle = document.getElementById('double-sided');
    if (doubleSidedToggle) {
        doubleSidedToggle.addEventListener('change', (e) => {
            const backCard = document.getElementById('card-back');
            const toggle = document.getElementById('side-toggle');
            const backSchematic = document.getElementById('schematic-back');
            
            if (e.target.checked) {
                backCard.style.display = 'none'; // Default to front
                toggle.style.display = 'block';
                if(backSchematic) backSchematic.style.display = 'grid';
            } else {
                backCard.style.display = 'none';
                document.getElementById('card-front').style.display = 'block';
                toggle.style.display = 'none';
                if(backSchematic) backSchematic.style.display = 'none';
            }
            updateQueueUI();
        });
    }

    // Picker elemek kattintása
    document.querySelectorAll('.picker-btn').forEach(item => {
        item.addEventListener('click', () => {
            if (!activeCell) {
                // Ha nincs aktív cella, válasszuk ki az elsőt (0-ás index)
                const side = document.getElementById('card-front').style.display !== 'none' ? 'front' : 'back';
                activeCell = { side, index: 0 };
                const cell = document.querySelector(`.cell[data-side="${side}"][data-index="0"]`);
                if(cell) cell.classList.add('active');
            }
            
            const { side, index } = activeCell;
            const type = item.dataset.type;
            const val = item.dataset.val;

            if (type === 'color') {
                // Ha X van a mezőben, ne lehessen színt rárakni
                if (state[side].cells[index].value === 'X') return;
                state[side].cells[index].color = val;
            } else if (type === 'value') {
                // Ha X-et választunk, töröljük a színt
                if (val === 'X') {
                    state[side].cells[index].color = '.';
                }
                state[side].cells[index].value = val;
            } else if (type === 'clear') {
                state[side].cells[index].color = '.';
                state[side].cells[index].value = '.';
            }

            renderGrid(side);
            
            // Keep cell active after edit
            const cell = document.querySelector(`.cell[data-side="${side}"][data-index="${index}"]`);
            if(cell) cell.classList.add('active');
        });
    });

    // Clear card button
    const clearCardBtn = document.getElementById('clear-card-btn');
    if (clearCardBtn) {
        clearCardBtn.addEventListener('click', () => {
            const lang = document.documentElement.lang || 'hu';
            const t = translations[lang] || translations['hu'];
            if (confirm(t.confirmDelete || 'Biztosan törlöd a kártya tartalmát?')) {
                const side = document.getElementById('card-front').style.display !== 'none' ? 'front' : 'back';
                state[side].cells = Array(20).fill(null).map(() => ({ color: '.', value: '.' }));
                renderGrid(side);
            }
        });
    }

    // Language switcher
    const currentLangBtn = document.getElementById('current-lang');
    if (currentLangBtn) {
        currentLangBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            document.querySelector('.lang-content').classList.toggle('show');
        });
    }

    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const lang = btn.dataset.lang;
            updateLanguage(lang);
            document.querySelector('.lang-content').classList.remove('show');
        });
    });

    // Reset card
    const resetBtn = document.getElementById('reset-card');
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            const side = document.getElementById('card-front').style.display !== 'none' ? 'front' : 'back';
            const lang = document.documentElement.lang || 'hu';
            const t = translations[lang] || translations['hu'];
            
            if (confirm(t.confirmDelete || 'Biztosan törlöd?')) {
                state[side].title = side === 'front' ? "MINTA NÉV" : "MINTA NÉV (HÁT)";
                state[side].difficulty = side === 'front' ? 3 : 4;
                state[side].cells = Array(20).fill(null).map(() => ({ color: '.', value: '.' }));
                
                renderGrid(side);
                const titleInput = document.querySelector(`.card-title-input[data-side="${side}"]`);
                if (titleInput) titleInput.value = state[side].title;
                updateTitleScaling(side);
            }
        });
    }

    // Glass effect toggle
    const glassToggle = document.getElementById('glass-effect-toggle');
    if (glassToggle) {
        glassToggle.addEventListener('change', (e) => {
            state.glassEffect = e.target.checked;
            renderGrid('front');
            renderGrid('back');
        });
    }

    // Kattintás bárhova máshova -> picker/dropdown bezárása
    document.addEventListener('click', (e) => {
        // Close panels if clicking outside
        const toolbar = document.querySelector('.toolbar');
        const panels = document.querySelectorAll('.floating-panel');
        let clickedOnPanel = false;
        panels.forEach(p => { if(p.contains(e.target)) clickedOnPanel = true; });

        if (toolbar && !toolbar.contains(e.target) && !clickedOnPanel) {
            panels.forEach(p => p.classList.remove('active'));
            document.querySelectorAll('.toolbar-tab').forEach(t => t.classList.remove('active'));
            closePicker();
        }
        
        // Lang menu bezárása
        const langContent = document.querySelector('.lang-content');
        const langBtn = document.getElementById('current-lang');
        if (langContent && langContent.classList.contains('show') && e.target !== langBtn && !langContent.contains(e.target)) {
            langContent.classList.remove('show');
        }
    });

    // Címek frissítése
    document.querySelectorAll('.card-title-input').forEach(input => {
        input.addEventListener('input', (e) => {
            const side = e.target.dataset.side;
            state[side].title = e.target.value;
            updateTitleScaling(side);
        });
    });

    // Hozzáadás a listához
    const addToQueueBtn = document.getElementById('add-to-queue');
    if (addToQueueBtn) addToQueueBtn.addEventListener('click', addToQueue);

    // Lista törlése
    const clearQueueBtn = document.getElementById('clear-queue');
    if (clearQueueBtn) {
        clearQueueBtn.addEventListener('click', () => {
            const lang = document.documentElement.lang || 'hu';
            const t = translations[lang] || translations['hu'];
            if (confirm(t.confirmClearQueue || 'Biztosan üríted a nyomtatási listát?')) {
                state.patternQueue = [];
                updateQueueUI();
            }
        });
    }

    // Nyomtatás gomb a fő panelen
    const printBtnMain = document.getElementById('print-btn-main');
    if (printBtnMain) {
        printBtnMain.addEventListener('click', async (e) => {
            e.stopPropagation();
            await generatePDF();
        });
    }

    // Printer friendly toggle (global)
    const printerFriendlyGlobal = document.getElementById('printer-friendly-global');
    if (printerFriendlyGlobal) {
        printerFriendlyGlobal.addEventListener('change', (e) => {
            // This will affect the print layout generation
            state.printerFriendly = e.target.checked;
        });
    }

    // Side toggle
    const sideToggle = document.getElementById('side-toggle');
    if (sideToggle) {
        sideToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleSide();
        });
    }

    // Promo kártya alkalmazása
    const applyPromoBtn = document.getElementById('apply-promo');
    if (applyPromoBtn) {
        applyPromoBtn.addEventListener('click', () => {
            const cardId = document.getElementById('promo-select').value;
            const side = document.getElementById('card-front').style.display !== 'none' ? 'front' : 'back';
            if (cardId) {
                const card = promoCards.find(c => c.id === cardId);
                if (card) {
                    applyCardToState(card, side);
                    renderGrid(side);
                    const titleInput = document.querySelector(`.card-title-input[data-side="${side}"]`);
                    if (titleInput) titleInput.value = card.title;
                    updateTitleScaling(side);
                    
                    // Close the promo panel
                    togglePanel('panel-promo', false);
                }
            }
        });
    }

    // Saját kártya választás
    const savedSelect = document.getElementById('saved-select');
    if (savedSelect) {
        savedSelect.addEventListener('change', (e) => {
            const cardTitle = e.target.value;
            if (cardTitle) {
                applySavedCard(cardTitle);
                updateTitleScaling('front');
                updateTitleScaling('back');
            }
        });
    }

    // Zoom in
    const zoomInBtn = document.getElementById('zoom-in');
    if (zoomInBtn) {
        zoomInBtn.addEventListener('click', () => {
            currentScale = Math.min(currentScale + SCALE_STEP, MAX_SCALE);
            updateCardScaling();
        });
    }

    // Zoom out
    const zoomOutBtn = document.getElementById('zoom-out');
    if (zoomOutBtn) {
        zoomOutBtn.addEventListener('click', () => {
            currentScale = Math.max(currentScale - SCALE_STEP, MIN_SCALE);
            updateCardScaling();
        });
    }
    // Apply saved card
    const applySavedBtn = document.getElementById('apply-saved');
    if (applySavedBtn) {
        applySavedBtn.addEventListener('click', () => {
            const title = document.getElementById('saved-select').value;
            if (title) {
                applySavedCard(title);
                updateTitleScaling('front');
                updateTitleScaling('back');
            }
        });
    }

    // Delete saved card
    const deleteSavedBtn = document.getElementById('delete-saved-btn');
    if (deleteSavedBtn) {
        deleteSavedBtn.addEventListener('click', () => {
            const title = document.getElementById('saved-select').value;
            if (title) {
                const lang = document.documentElement.lang || 'hu';
                const t = translations[lang] || translations['hu'];
                if (confirm(t.confirmDelete || 'Biztosan törlöd?')) {
                    deleteSavedCard(title);
                }
            }
        });
    }

    // Mentés gomb
    const saveCardBtn = document.getElementById('save-card');
    if (saveCardBtn) {
        saveCardBtn.addEventListener('click', () => {
            const side = document.getElementById('card-front').style.display !== 'none' ? 'front' : 'back';
            const savedCards = JSON.parse(localStorage.getItem('sagrada_saved_cards') || '[]');
            const currentCard = JSON.parse(JSON.stringify(state[side]));
            
            const existingIdx = savedCards.findIndex(c => c.title === currentCard.title);
            if (existingIdx >= 0) {
                savedCards[existingIdx] = currentCard;
            } else {
                savedCards.push(currentCard);
            }
            
            localStorage.setItem('sagrada_saved_cards', JSON.stringify(savedCards));
            loadSavedCardsList();
            
            const lang = document.documentElement.lang || 'hu';
            const t = translations[lang] || translations['hu'];
            alert(t.alertSaved);
        });
    }

    // Generate pattern button
    const generateBtn = document.getElementById('generate-pattern-btn');
    if (generateBtn) {
        generateBtn.addEventListener('click', () => {
            const side = document.getElementById('card-front').style.display !== 'none' ? 'front' : 'back';
            
            // Biztonságos érték lekérés, ha a mezők nincsenek a DOM-ban
            const getColorCount = () => document.getElementById('gen-color-count') ? parseInt(document.getElementById('gen-color-count').value) : 7;
            const getUniqueColors = () => document.getElementById('gen-unique-colors') ? parseInt(document.getElementById('gen-unique-colors').value) : 5;
            const getValueCount = () => document.getElementById('gen-value-count') ? parseInt(document.getElementById('gen-value-count').value) : 7;
            const getUniqueValues = () => document.getElementById('gen-unique-values') ? parseInt(document.getElementById('gen-unique-values').value) : 6;
            const getSeed = () => document.getElementById('gen-seed') ? document.getElementById('gen-seed').value : null;

            const config = {
                colorCount: getColorCount(),
                uniqueColorsCount: getUniqueColors(),
                valueCount: getValueCount(),
                uniqueValuesCount: getUniqueValues(),
                seed: getSeed()
            };
            generateRandomPattern(side, config);
        });
    }

    // Resize observer for card container
    const editorContainer = document.getElementById('editor-container');
    if (editorContainer) {
        const resizeObserver = new ResizeObserver(entries => {
            for (let entry of entries) {
                updateCardScaling();
            }
        });
        resizeObserver.observe(editorContainer);
    }
}

/**
 * Kártya méretezése az ablakhoz
 */
function updateCardScaling() {
    const container = document.getElementById('editor-container');
    const card = document.getElementById('card-container');
    if (!container || !card) return;

    const containerWidth = container.clientWidth - 20;
    const containerHeight = container.clientHeight - 20;
    
    const cardBaseWidth = 900;
    const cardBaseHeight = 800;
    
    const scaleX = (containerWidth / cardBaseWidth) * 0.8;
    const scaleY = (containerHeight / cardBaseHeight) * 0.8;
    // Az alap skálázás az ablakhoz, amit a felhasználói zoom-al módosítunk
    const baseScale = Math.min(scaleX, scaleY, 1.0);
    const scale = baseScale * currentScale;
    
    card.style.transform = `scale(${scale})`;
    
    // Update wrapper height to match scaled card
    const wrapper = document.querySelector('.card-wrapper');
    if (wrapper) {
        wrapper.style.width = (cardBaseWidth * scale) + 'px';
        wrapper.style.height = (cardBaseHeight * scale) + 'px';
    }
}

/**
 * Milliméter-pontos HTML oldal létrehozása a nyomtatáshoz
 */
function createPrintPage(items, side = 'front') {
    const page = document.createElement('div');
    page.className = 'print-page';
    
    const isDoubleSided = document.getElementById('double-sided').checked;
    
    // Duplex nyomtatáshoz a hátlapokat tükrözni kell vízszintesen
    let displayItems = [...items];
    if (side === 'back' && isDoubleSided) {
        // 3 sor, soronként 2 elem tükrözése
        const rows = [
            displayItems.slice(0, 2).reverse(),
            displayItems.slice(2, 4).reverse(),
            displayItems.slice(4, 6).reverse()
        ];
        displayItems = rows.flat();
    }

    displayItems.forEach(item => {
        if (!item) {
            const empty = document.createElement('div');
            page.appendChild(empty);
            return;
        }

        const card = document.createElement('div');
        card.className = 'print-card';
        
        const grid = document.createElement('div');
        grid.className = 'print-grid';
        
        const currentState = side === 'front' ? item.frontState : (item.backState || item.frontState);
        const glassEffect = state.glassEffect; // Globális beállítás használata

        currentState.cells.forEach(cellData => {
            const cell = document.createElement('div');
            cell.className = 'print-cell' + (glassEffect ? ' glass' : '');
            
            if (cellData.color && cellData.color !== 'w') {
                const colorMap = {
                    'r': '#DC3232',
                    'g': '#32A050',
                    'b': '#3264C8',
                    'y': '#F0C828',
                    'p': '#8C3CA0'
                };
                cell.style.backgroundColor = colorMap[cellData.color];
            } else {
                cell.style.backgroundColor = '#f0f0f0';
            }

            if (cellData.value) {
                const num = document.createElement('div');
                num.className = 'print-number';
                num.textContent = cellData.value;
                cell.appendChild(num);
            } else if (cellData.isX) {
                const x = document.createElement('div');
                x.className = 'print-number';
                x.style.opacity = '0.3';
                x.style.color = '#000';
                x.textContent = 'X';
                cell.appendChild(x);
            }

            grid.appendChild(cell);
        });

        card.appendChild(grid);
        
        // Footer
        const footer = document.createElement('div');
        footer.className = 'print-footer';
        
        const title = document.createElement('div');
        title.className = 'print-title';
        title.textContent = item.title;
        footer.appendChild(title);
        
        const difficulty = document.createElement('div');
        difficulty.className = 'print-difficulty';
        for (let i = 1; i <= 6; i++) {
            const dot = document.createElement('div');
            dot.className = 'print-dot';
            if (i <= item.difficulty) {
                dot.style.backgroundColor = 'white';
            } else {
                dot.style.backgroundColor = '#333';
                dot.style.border = '0.1mm solid #555';
            }
            difficulty.appendChild(dot);
        }
        footer.appendChild(difficulty);
        
        card.appendChild(footer);
        page.appendChild(card);
    });

    return page;
}

/**
 * PDF exportálás: milliméter-pontos HTML renderelés 300 DPI-vel
 */
window.generatePDF = async function() {
    const { jsPDF } = window.jspdf;
    const isDoubleSided = document.getElementById('double-sided').checked;
    
    if (state.patternQueue.length === 0) {
        const lang = document.documentElement.lang || 'hu';
        const t = translations[lang] || translations['hu'];
        alert(t.alertQueueEmpty);
        return;
    }

    // Ideiglenes konténer a rendereléshez
    let printRoot = document.getElementById('print-root');
    if (!printRoot) {
        printRoot = document.createElement('div');
        printRoot.id = 'print-root';
        document.body.appendChild(printRoot);
    }
    printRoot.innerHTML = '';

    const doc = new jsPDF('p', 'mm', 'a4');
    const itemsPerPage = 6;
    const numPages = Math.ceil(state.patternQueue.length / itemsPerPage);

    for (let p = 0; p < numPages; p++) {
        const pageItems = state.patternQueue.slice(p * itemsPerPage, (p + 1) * itemsPerPage);
        
        // 1. Előlap generálása
        const frontPageHtml = createPrintPage(pageItems, 'front');
        printRoot.appendChild(frontPageHtml);
        
        const frontCanvas = await html2canvas(frontPageHtml, {
            scale: 3.125, // 300 DPI (96 * 3.125 = 300)
            useCORS: true,
            backgroundColor: '#ffffff',
            logging: false
        });
        
        if (p > 0) doc.addPage();
        doc.addImage(frontCanvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, 210, 297);
        printRoot.removeChild(frontPageHtml);

        // 2. Hátlap generálása (ha szükséges)
        if (isDoubleSided) {
            const backPageHtml = createPrintPage(pageItems, 'back');
            printRoot.appendChild(backPageHtml);
            
            const backCanvas = await html2canvas(backPageHtml, {
                scale: 3.125,
                useCORS: true,
                backgroundColor: '#ffffff',
                logging: false
            });
            
            doc.addPage();
            doc.addImage(backCanvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, 210, 297);
            printRoot.removeChild(backPageHtml);
        }
    }

    doc.save(`Sagrada_Cards_${new Date().getTime()}.pdf`);
}
function updateTitleScaling(side) {
    const titleEl = document.querySelector(`.card-title[data-side="${side}"]`);
    if (!titleEl) return;
    
    const text = state[side].title || "";
    titleEl.textContent = text;
    
    // Alapértelmezett méret
    titleEl.style.fontSize = '42px';
    
    // Ha túl hosszú, csökkentsük a betűméretet
    let fontSize = 42;
    while (titleEl.scrollWidth > titleEl.offsetWidth && fontSize > 12) {
        fontSize -= 2;
        titleEl.style.fontSize = fontSize + 'px';
    }
}

/**
 * Kártya oldal váltása
 */
window.toggleSide = function() {
    const front = document.getElementById('card-front');
    const back = document.getElementById('card-back');
    const toggle = document.getElementById('side-toggle');
    const lang = document.documentElement.lang || 'hu';
    const t = translations[lang];
    
    if (front.style.display === 'none') {
        front.style.display = 'block';
        back.style.display = 'none';
    } else {
        front.style.display = 'none';
        back.style.display = 'block';
    }
    
    if (toggle) {
        toggle.textContent = t.flipSide;
    }

    // Clear active cell when toggling side
    closePicker();
}

function updateLanguage(lang) {
    document.documentElement.lang = lang;
    const t = translations[lang];
    if (!t) return;
    
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.dataset.i18n;
        if (t[key]) {
            el.textContent = t[key];
        }
    });

    // Update side toggle text
    const toggle = document.getElementById('side-toggle');
    if (toggle) {
        toggle.textContent = t.flipSide;
    }

    // Update current lang button
    const currentLangBtn = document.getElementById('current-lang');
    if (currentLangBtn) {
        const activeLangBtn = document.querySelector(`.lang-btn[data-lang="${lang}"]`);
        if (activeLangBtn) {
            currentLangBtn.textContent = activeLangBtn.querySelector('span').textContent;
        }
    }

    // Update queue UI to reflect language change
    updateQueueUI();
}

// Expose functions to window for onclick handlers
window.loadFromQueue = loadFromQueue;
window.removeFromQueue = removeFromQueue;
window.openPicker = openPicker;
window.applySavedCard = applySavedCard;
window.deleteSavedCard = deleteSavedCard;

// Start
window.addEventListener('DOMContentLoaded', async () => {
    try {
        await init();
    } catch (err) {
        console.error("Initialization error:", err);
        document.body.innerHTML = `<div style="color:red; padding:20px;">Hiba történt az alkalmazás betöltésekor: ${err.message}</div>`;
    }
});
