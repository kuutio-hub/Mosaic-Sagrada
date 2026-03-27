import { state } from './js/state.js';
import { renderGrid, renderDifficulty, updateQueueUI } from './js/ui.js';
import { addToQueue, removeFromQueue, loadFromQueue, loadPromoCards, loadSavedCardsList, applyCardToState, applySavedCard, deleteSavedCard } from './js/cardManager.js';
import { translations } from './js/i18n.js';

// Service worker eltávolítása, ha van (megoldás a "gura" oldal frissítésre)
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(registrations => {
        for (let registration of registrations) {
            registration.unregister();
        }
    });
}

// Aktuálisan szerkesztett cella
let activeCell = null;

// Promo kártyák adatai
let promoCards = [];

// SVG Sablonok
const frameSVG = `
<svg width="900" height="800" viewBox="0 0 900 800" fill="none" xmlns="http://www.w3.org/2000/svg">
    <!-- Egyszerű fekete keret -->
    <rect x="0" y="0" width="900" height="800" fill="#000"/>
    <rect x="2" y="2" width="896" height="796" stroke="#333" stroke-width="1"/>
    
    <!-- Rács keret -->
    <rect x="15" y="15" width="870" height="670" rx="5" stroke="#222" stroke-width="2" class="grid-frame"/>
</svg>
`;

/**
 * Inicializálás
 */
async function init() {
    // SVG-k behelyezése
    document.getElementById('frame-front-svg').innerHTML = frameSVG;
    document.getElementById('frame-back-svg').innerHTML = frameSVG;

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
}

/**
 * Picker megnyitása
 */
window.openPicker = function(e, side, index) {
    e.stopPropagation();
    
    const picker = document.getElementById('fixed-picker');
    
    // Ha ugyanazt a cellát kattintjuk és nyitva van, zárjuk be
    if (activeCell && activeCell.side === side && activeCell.index === index && picker.classList.contains('show')) {
        closePicker();
        return;
    }

    // Remove active class from all cells
    document.querySelectorAll('.cell').forEach(c => c.classList.remove('active'));
    
    // Add active class to clicked cell
    const cell = e.currentTarget;
    cell.classList.add('active');
    
    activeCell = { side, index };
    
    // Mutassuk a pickert
    picker.classList.add('show');
}

/**
 * Picker bezárása
 */
function closePicker() {
    document.querySelectorAll('.cell').forEach(c => c.classList.remove('active'));
    document.getElementById('fixed-picker').classList.remove('show');
    activeCell = null;
}

/**
 * Eseménykezelők beállítása
 */
function setupEventListeners() {
    // Double-sided mode toggle
    document.getElementById('double-sided').addEventListener('change', (e) => {
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

    // Card flip functionality removed from here to avoid redundancy
    // It's handled by window.toggleSide and the card-container click listener at the end

    // Picker kapcsoló gomb
    const togglePickerBtn = document.getElementById('toggle-picker-btn');
    if (togglePickerBtn) {
        togglePickerBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const picker = document.getElementById('fixed-picker');
            picker.classList.toggle('show');
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

    // Language switcher
    document.getElementById('current-lang').addEventListener('click', (e) => {
        e.stopPropagation();
        document.querySelector('.lang-content').classList.toggle('show');
    });

    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const lang = btn.dataset.lang;
            updateLanguage(lang);
            document.querySelector('.lang-content').classList.remove('show');
        });
    });

    // Reset card
    document.getElementById('reset-card').addEventListener('click', () => {
        const side = document.getElementById('card-front').style.display !== 'none' ? 'front' : 'back';
        const lang = document.documentElement.lang || 'hu';
        const t = translations[lang] || translations['hu'];
        
        if (confirm(t.confirmDelete || 'Biztosan törlöd?')) {
            state[side].title = side === 'front' ? "MINTA NÉV" : "MINTA NÉV (HÁT)";
            state[side].difficulty = side === 'front' ? 3 : 4;
            state[side].cells = Array(20).fill(null).map(() => ({ color: '.', value: '.' }));
            
            renderGrid(side);
            document.querySelector(`.card-title-input[data-side="${side}"]`).value = state[side].title;
        }
    });

    // Preview Panel toggle
    document.getElementById('open-preview-btn').addEventListener('click', () => {
        document.getElementById('preview-panel').classList.add('open');
    });
    
    document.getElementById('open-preview-tab').addEventListener('click', () => {
        document.getElementById('preview-panel').classList.add('open');
    });

    document.getElementById('close-preview').addEventListener('click', () => {
        document.getElementById('preview-panel').classList.remove('open');
    });

    // Kattintás bárhova máshova -> picker/dropdown bezárása
    document.addEventListener('click', (e) => {
        // Deselect cell if clicking outside card and picker
        const cardContainer = document.getElementById('card-container');
        const fixedPicker = document.getElementById('fixed-picker');
        if (cardContainer && fixedPicker && !cardContainer.contains(e.target) && !fixedPicker.contains(e.target)) {
            closePicker();
        }
        
        // Print menu bezárása
        const printMenu = document.getElementById('print-menu-content');
        const printBtn = document.getElementById('print-menu-btn');
        if (printMenu && printMenu.style.display === 'block' && e.target !== printBtn && !printMenu.contains(e.target)) {
            printMenu.style.display = 'none';
        }

        // Lang menu bezárása
        const langContent = document.querySelector('.lang-content');
        const langBtn = document.getElementById('current-lang');
        if (langContent && langContent.classList.contains('show') && e.target !== langBtn && !langContent.contains(e.target)) {
            langContent.classList.remove('show');
        }

        // Preview panel bezárása ha kívülre kattintunk
        const previewPanel = document.getElementById('preview-panel');
        const openPreviewBtn = document.getElementById('open-preview-btn');
        const openPreviewTab = document.getElementById('open-preview-tab');
        if (previewPanel && previewPanel.classList.contains('open') && 
            !previewPanel.contains(e.target) && e.target !== openPreviewBtn && e.target !== openPreviewTab) {
            previewPanel.classList.remove('open');
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
    document.getElementById('add-to-queue').addEventListener('click', addToQueue);

    // Lista törlése
    document.getElementById('clear-queue').addEventListener('click', () => {
        const lang = document.documentElement.lang || 'hu';
        const t = translations[lang] || translations['hu'];
        if (confirm(t.confirmClear)) {
            state.patternQueue = [];
            updateQueueUI();
        }
    });

    // Print menu toggle
    document.getElementById('print-menu-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        const menu = document.getElementById('print-menu-content');
        menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
    });

    // Nyomtatás gomb a fő panelen
    const printBtnMain = document.getElementById('print-btn-main');
    if (printBtnMain) {
        printBtnMain.addEventListener('click', (e) => {
            e.stopPropagation();
            preparePrintLayout();
            window.print();
        });
    }

    // Export gomb (most már csak nyomtatást hív)
    document.getElementById('export-pdf').addEventListener('click', (e) => {
        e.stopPropagation();
        const menu = document.getElementById('print-menu-content');
        if(menu) menu.style.display = 'none';
        preparePrintLayout();
        window.print();
    });

    // Nyomtatás gomb a menüben
    const printBtnMenu = document.getElementById('print-btn');
    if (printBtnMenu) {
        printBtnMenu.addEventListener('click', (e) => {
            e.stopPropagation();
            const menu = document.getElementById('print-menu-content');
            if(menu) menu.style.display = 'none';
            preparePrintLayout();
            window.print();
        });
    }

    // Printer friendly toggle
    document.getElementById('printer-friendly').addEventListener('change', (e) => {
        const cards = document.querySelectorAll('.sagrada-card');
        cards.forEach(card => {
            if (e.target.checked) {
                card.classList.add('printer-friendly');
            } else {
                card.classList.remove('printer-friendly');
            }
        });
    });

    // Side toggle
    document.getElementById('side-toggle').addEventListener('click', (e) => {
        e.stopPropagation();
        toggleSide();
    });

    // Promo kártya alkalmazása
    document.getElementById('apply-promo').addEventListener('click', () => {
        const cardId = document.getElementById('promo-select').value;
        const side = document.getElementById('card-front').style.display !== 'none' ? 'front' : 'back';
        if (cardId) {
            const card = promoCards.find(c => c.id === cardId);
            if (card) {
                applyCardToState(card, side);
                renderGrid(side);
                document.querySelector(`.card-title-input[data-side="${side}"]`).value = card.title;
            }
        }
    });

    // Saját kártya választás
    document.getElementById('saved-select').addEventListener('change', (e) => {
        const cardTitle = e.target.value;
        if (cardTitle) {
            applySavedCard(cardTitle);
        }
    });

    // Apply saved card
    document.getElementById('apply-saved').addEventListener('click', () => {
        const title = document.getElementById('saved-select').value;
        if (title) {
            applySavedCard(title);
        }
    });

    // Saved kártya törlése
    let deleteBtn = document.getElementById('delete-saved');
    if (!deleteBtn) {
        deleteBtn = document.createElement('button');
        deleteBtn.id = 'delete-saved';
        deleteBtn.className = 'btn-danger';
        deleteBtn.style.width = '100%';
        deleteBtn.style.marginTop = '10px';
        deleteBtn.dataset.i18n = 'delete';
        deleteBtn.textContent = 'Törlés';
        deleteBtn.addEventListener('click', () => {
            const title = document.getElementById('saved-select').value;
            if (title) {
                const lang = document.documentElement.lang || 'hu';
                const t = translations[lang] || translations['hu'];
                if (confirm(t.confirmDelete || 'Biztosan törlöd?')) {
                    deleteSavedCard(title);
                }
            }
        });
        document.getElementById('apply-saved').parentNode.appendChild(deleteBtn);
    }

    // Kártya fordítása kattintásra eltávolítva az user kérésére
    // Csak a gombbal lehessen fordítani

    // Mentés gomb
    document.getElementById('save-card').addEventListener('click', () => {
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
            cardWrapper.className = 'print-card';
            const img = document.createElement('img');
            img.src = item.frontImg;
            cardWrapper.appendChild(img);
            frontPage.appendChild(cardWrapper);
        });
        printContainer.appendChild(frontPage);

        // Back page if double sided
        if (isDoubleSided) {
            const backPage = document.createElement('div');
            backPage.className = 'print-page';
            
            // For back page, we need to mirror the order horizontally
            // Front: 1 2 -> Back: 2 1
            // Front: 3 4 -> Back: 4 3
            // Front: 5 6 -> Back: 6 5
            
            const rows = [
                pageItems.slice(0, 2),
                pageItems.slice(2, 4),
                pageItems.slice(4, 6)
            ];
            
            rows.forEach(row => {
                // Reverse the row for the back page
                const reversedRow = [...row].reverse();
                
                // If the row has only 1 item, we need to add an empty placeholder to keep the grid layout correct
                if (row.length === 1) {
                    const emptyWrapper = document.createElement('div');
                    emptyWrapper.className = 'print-card';
                    backPage.appendChild(emptyWrapper);
                    
                    const cardWrapper = document.createElement('div');
                    cardWrapper.className = 'print-card';
                    const img = document.createElement('img');
                    img.src = reversedRow[0].backImg || reversedRow[0].frontImg;
                    cardWrapper.appendChild(img);
                    backPage.appendChild(cardWrapper);
                } else {
                    reversedRow.forEach(item => {
                        const cardWrapper = document.createElement('div');
                        cardWrapper.className = 'print-card';
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
        toggle.innerHTML = `${t.frontSide}\n<span style="font-size: 10px; font-weight: normal;">Kattints a fordításhoz</span>`;
    } else {
        front.style.display = 'none';
        back.style.display = 'block';
        toggle.innerHTML = `${t.backSide}\n<span style="font-size: 10px; font-weight: normal;">Kattints a fordításhoz</span>`;
    }
}


// Language switcher logic moved to setupEventListeners

function updateLanguage(lang) {
    document.documentElement.lang = lang;
    const t = translations[lang];
    if (!t) return;
    
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.dataset.i18n;
        if (t[key]) {
            if (key === 'print' && el.id === 'print-menu-btn') {
                el.textContent = t[key] + ' ▼';
            } else if (key === 'print' && el.id === 'print-btn') {
                el.textContent = t[key] + ' (Lista)';
            } else if (el.tagName === 'OPTION') {
                el.textContent = t[key];
            } else {
                el.textContent = t[key];
            }
        }
    });

    // Update delete button text if it exists
    const deleteBtn = document.getElementById('delete-saved');
    if (deleteBtn && t.delete) {
        deleteBtn.textContent = t.delete;
    }

    // Update side toggle text
    const toggle = document.getElementById('side-toggle');
    if (toggle) {
        const sideText = document.getElementById('card-front').style.display !== 'none' ? t.frontSide : t.backSide;
        toggle.innerHTML = `${sideText}\n<span style="font-size: 10px; font-weight: normal;">Kattints a fordításhoz</span>`;
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
window.clearQueue = () => {
    const lang = document.documentElement.lang || 'hu';
    const t = translations[lang] || translations['hu'];
    if (confirm(t.confirmClearQueue || 'Biztosan üríted a nyomtatási listát?')) {
        state.patternQueue = [];
        updateQueueUI();
    }
};

// Start
window.addEventListener('DOMContentLoaded', async () => {
    try {
        await init();
        const clearBtn = document.getElementById('clear-queue');
        if (clearBtn) {
            clearBtn.addEventListener('click', window.clearQueue);
        }
    } catch (err) {
        console.error("Initialization error:", err);
        document.body.innerHTML = `<div style="color:red; padding:20px;">Hiba történt az alkalmazás betöltésekor: ${err.message}</div>`;
    }
});
