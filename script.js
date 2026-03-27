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

const APP_VERSION = "0.0.2.1";

// Aktuálisan szerkesztett cella
let activeCell = null;

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
            if (activeCell) {
                const { side, index } = activeCell;
                const type = item.dataset.type;
                const val = item.dataset.val;

                if (type === 'color') {
                    state[side].cells[index].color = val;
                } else if (type === 'value') {
                    state[side].cells[index].value = val;
                } else if (type === 'clear') {
                    state[side].cells[index].color = '.';
                    state[side].cells[index].value = '.';
                }

                renderGrid(side);
                
                // Keep cell active after edit
                const cell = document.querySelector(`.cell[data-side="${side}"][data-index="${index}"]`);
                if(cell) cell.classList.add('active');
            }
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
            
            // PDF generálás
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF('p', 'mm', 'a4');
            const date = new Date().toISOString().slice(2, 10).replace(/-/g, '');
            const time = new Date().toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' }).replace(':', '');
            const fileName = `Sagrada_${date}_${time}.pdf`;

            preparePrintLayout();
            const pages = document.querySelectorAll('.print-page');
            
            for (let i = 0; i < pages.length; i++) {
                if (i > 0) doc.addPage();
                const canvas = await html2canvas(pages[i], { scale: 2 });
                const imgData = canvas.toDataURL('image/png');
                doc.addImage(imgData, 'PNG', 10, 10, 190, 277);
            }
            
            doc.save(fileName);
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

    // Zoom toggle
    const zoomToggle = document.getElementById('zoom-toggle');
    if (zoomToggle) {
        zoomToggle.addEventListener('click', () => {
            const container = document.getElementById('card-container');
            container.classList.toggle('zoomed');
            
            const icon = zoomToggle.querySelector('i') || zoomToggle.querySelector('span');
            if (container.classList.contains('zoomed')) {
                zoomToggle.innerHTML = '🔍 <span data-i18n="zoomOut">Kicsinyítés</span>';
            } else {
                zoomToggle.innerHTML = '🔍 <span data-i18n="zoomIn">Nagyítás</span>';
            }
            // Re-apply translations for the new content
            const lang = document.documentElement.lang || 'hu';
            applyTranslations(lang);
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

    const containerWidth = container.clientWidth - 40;
    const containerHeight = container.clientHeight - 40;
    
    const cardBaseWidth = 900;
    const cardBaseHeight = 800;
    
    const scaleX = containerWidth / cardBaseWidth;
    const scaleY = containerHeight / cardBaseHeight;
    const scale = Math.min(scaleX, scaleY, 1);
    
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
 * Kártyacím méretezése, hogy beleférjen a helyére
 */
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
