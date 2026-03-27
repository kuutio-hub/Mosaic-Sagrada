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
 * Kártya kép generálása (PNG)
 */
async function generateCardImage(cardData) {
    const container = document.createElement('div');
    container.style.width = '900px';
    container.style.height = '800px';
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.background = 'white';
    document.body.appendChild(container);

    // Render card structure
    container.innerHTML = `
        <div class="sagrada-card" style="width: 900px; height: 800px; position: relative;">
            <div class="svg-layer">${frameSVG}</div>
            <div class="grid-layer" id="temp-grid"></div>
        </div>
    `;

    // Render grid
    const grid = container.querySelector('#temp-grid');
    // Simplified grid rendering for the temporary container
    cardData.cells.forEach(cell => {
        const cellDiv = document.createElement('div');
        cellDiv.className = 'cell';
        // Apply cell appearance (simplified)
        if (cell.color !== '.') cellDiv.classList.add(`c-${cell.color.toLowerCase()}`);
        if (cell.value !== '.') cellDiv.textContent = cell.value;
        grid.appendChild(cellDiv);
    });

    const canvas = await html2canvas(container, { scale: 1 });
    const imgData = canvas.toDataURL('image/png');
    document.body.removeChild(container);
    return imgData;
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
                state[side].cells[index].color = val;
            } else if (type === 'value') {
                // Ha X, akkor ne legyen szín
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
 * Print layout előkészítése duplex nyomtatáshoz
 */
function preparePrintLayout() {
    const printContainer = document.getElementById('print-container');
    printContainer.innerHTML = '';
    
    if (state.patternQueue.length === 0) {
        const lang = document.documentElement.lang || 'hu';
        const t = translations[lang] || translations['hu'];
        alert(t.alertQueueEmpty);
        return;
    }
    
    const isDoubleSided = document.getElementById('double-sided').checked;
    const isRounded = document.getElementById('rounded-corners').checked;
    
    // Handle multiple pages (6 cards per page)
    const itemsPerPage = 6;
    const numPages = Math.ceil(state.patternQueue.length / itemsPerPage);

    for (let p = 0; p < numPages; p++) {
        const pageItems = state.patternQueue.slice(p * itemsPerPage, (p + 1) * itemsPerPage);
        
        // Front page
        const frontPage = document.createElement('div');
        frontPage.className = 'print-page';
        
        pageItems.forEach(item => {
            const cardWrapper = document.createElement('div');
            cardWrapper.className = 'print-card' + (isRounded ? ' rounded' : '');
            
            const img = document.createElement('img');
            img.src = item.frontImg;
            cardWrapper.appendChild(img);
            
            // Info bar at bottom
            const infoBar = document.createElement('div');
            infoBar.className = 'print-card-info';
            
            const nameSpan = document.createElement('span');
            nameSpan.textContent = item.title;
            infoBar.appendChild(nameSpan);
            
            const dotsSpan = document.createElement('span');
            dotsSpan.textContent = '●'.repeat(item.difficulty);
            infoBar.appendChild(dotsSpan);
            
            cardWrapper.appendChild(infoBar);
            frontPage.appendChild(cardWrapper);
        });
        printContainer.appendChild(frontPage);

        // Back page if double sided
        if (isDoubleSided) {
            const backPage = document.createElement('div');
            backPage.className = 'print-page';
            
            const rows = [
                pageItems.slice(0, 2),
                pageItems.slice(2, 4),
                pageItems.slice(4, 6)
            ];
            
            rows.forEach(row => {
                const reversedRow = [...row].reverse();
                
                if (row.length === 1) {
                    const emptyWrapper = document.createElement('div');
                    emptyWrapper.className = 'print-card';
                    backPage.appendChild(emptyWrapper);
                    
                    const cardWrapper = document.createElement('div');
                    cardWrapper.className = 'print-card' + (isRounded ? ' rounded' : '');
                    const img = document.createElement('img');
                    img.src = reversedRow[0].backImg || reversedRow[0].frontImg;
                    cardWrapper.appendChild(img);
                    backPage.appendChild(cardWrapper);
                } else {
                    reversedRow.forEach(item => {
                        const cardWrapper = document.createElement('div');
                        cardWrapper.className = 'print-card' + (isRounded ? ' rounded' : '');
                        const img = document.createElement('img');
                        img.src = item.backImg || item.frontImg;
                        cardWrapper.appendChild(img);
                        backPage.appendChild(cardWrapper);
                    });
                }
            });
            
            printContainer.appendChild(backPage);
        }
    }
}

/**
 * PDF exportálás: kártyák képként mentése és A4-re helyezése
 */
window.generatePDF = async function() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');
    const isDoubleSided = document.getElementById('double-sided').checked;
    
    // 1. Kártyák képként generálása
    const cardImages = [];
    for (const item of state.patternQueue) {
        const frontImg = await generateCardImage(item.frontState);
        const backImg = isDoubleSided ? await generateCardImage(item.backState || item.frontState) : null;
        cardImages.push({ frontImg, backImg });
    }

    // 2. A4 oldalakra helyezés (6 kártya/oldal)
    const itemsPerPage = 6;
    const numPages = Math.ceil(cardImages.length / itemsPerPage);

    for (let p = 0; p < numPages; p++) {
        if (p > 0) doc.addPage();
        const pageItems = cardImages.slice(p * itemsPerPage, (p + 1) * itemsPerPage);
        
        // Előlap elrendezése (3x2 grid)
        pageItems.forEach((item, idx) => {
            const x = (idx % 2) * 90 + 15;
            const y = Math.floor(idx / 2) * 64 + 20;
            doc.addImage(item.frontImg, 'PNG', x, y, 90, 64);
        });
    }

    // 3. Hátlapok (ha szükséges)
    if (isDoubleSided) {
        for (let p = 0; p < numPages; p++) {
            doc.addPage();
            const pageItems = cardImages.slice(p * itemsPerPage, (p + 1) * itemsPerPage);
            
            // Hátlapok elrendezése (tükrözve)
            const reversedItems = [...pageItems].reverse();
            reversedItems.forEach((item, idx) => {
                const x = (idx % 2) * 90 + 15;
                const y = Math.floor(idx / 2) * 64 + 20;
                doc.addImage(item.backImg || item.frontImg, 'PNG', x, y, 90, 64);
            });
        }
    }

    doc.save(`Sagrada_${new Date().getTime()}.pdf`);
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
