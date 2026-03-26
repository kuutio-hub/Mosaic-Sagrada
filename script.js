import { state } from './js/state.js';
import { renderGrid, renderDifficulty, updateQueueUI } from './js/ui.js';
import { addToQueue, removeFromQueue, loadFromQueue, loadPromoCards, loadSavedCardsList, applyCardToState, applySavedCard, deleteSavedCard } from './js/cardManager.js';
import { exportPDF } from './js/utils.js';
import { translations } from './js/i18n.js';

// Aktuálisan szerkesztett cella
let activeCell = null;

// Promo kártyák adatai
let promoCards = [];

// SVG Sablonok
const frameSVG = `
<svg width="750" height="1050" viewBox="0 0 750 1050" fill="none" xmlns="http://www.w3.org/2000/svg">
    <!-- Külső keret -->
    <rect x="15" y="15" width="720" height="1020" rx="25" stroke="#d4af37" stroke-width="12" class="frame-outer"/>
    <rect x="35" y="35" width="680" height="980" rx="15" stroke="#d4af37" stroke-width="4" stroke-dasharray="20 10" class="frame-inner"/>
    
    <!-- Rács keret -->
    <rect x="65" y="75" width="620" height="840" rx="10" stroke="#555" stroke-width="4" class="grid-frame"/>
    
    <!-- Díszítő elemek a sarkokban -->
    <circle cx="50" cy="50" r="15" fill="#d4af37" class="corner-dot"/>
    <circle cx="700" cy="50" r="15" fill="#d4af37" class="corner-dot"/>
    <circle cx="700" cy="1000" r="15" fill="#d4af37" class="corner-dot"/>
    <circle cx="50" cy="1000" r="15" fill="#d4af37" class="corner-dot"/>
    
    <!-- Alsó díszítés -->
    <path d="M200 980 Q 375 1020 550 980" stroke="#d4af37" stroke-width="3" fill="none" class="bottom-decoration"/>
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

    // Theme toggle
    document.getElementById('theme-toggle').addEventListener('click', () => {
        document.body.classList.toggle('light-mode');
    });
}

/**
 * Picker megnyitása
 */
window.openPicker = function(e, side, index) {
    e.stopPropagation();
    activeCell = { side, index };
    
    const picker = document.getElementById('cell-picker');
    picker.classList.remove('picker-hidden');
    
    // Pozicionálás a kurzorhoz
    picker.style.top = `${e.pageY}px`;
    picker.style.left = `${e.pageX}px`;
}

/**
 * Picker bezárása
 */
function closePicker() {
    document.getElementById('cell-picker').classList.add('picker-hidden');
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
        if (e.target.checked) {
            backCard.style.display = 'none'; // Default to front
            toggle.style.display = 'block';
        } else {
            backCard.style.display = 'none';
            document.getElementById('card-front').style.display = 'block';
            toggle.style.display = 'none';
        }
    });

    // Card flip functionality
    const cardContainer = document.getElementById('card-container');
    cardContainer.addEventListener('click', (e) => {
        // Ne forduljon meg, ha inputra vagy difficulty dotra kattintunk
        if (e.target.tagName.toLowerCase() === 'input' || e.target.classList.contains('difficulty-dot')) {
            return;
        }
        
        if (document.getElementById('double-sided').checked) {
            const front = document.getElementById('card-front');
            const back = document.getElementById('card-back');
            const toggle = document.getElementById('side-toggle');
            
            if (front.style.display === 'none') {
                front.style.display = 'block';
                back.style.display = 'none';
                toggle.textContent = translations[document.documentElement.lang || 'hu'].frontSide;
            } else {
                front.style.display = 'none';
                back.style.display = 'block';
                toggle.textContent = translations[document.documentElement.lang || 'hu'].backSide;
            }
        }
    });

    // Picker elemek kattintása
    document.querySelectorAll('.picker-item').forEach(item => {
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
                closePicker();
            }
        });
    });

    // Kattintás bárhova máshova -> picker bezárása
    document.addEventListener('click', (e) => {
        if (!document.getElementById('cell-picker').contains(e.target)) {
            closePicker();
        }
        
        // Print menu bezárása
        const printMenu = document.getElementById('print-menu-content');
        const printBtn = document.getElementById('print-menu-btn');
        if (printMenu.style.display === 'block' && e.target !== printBtn && !printMenu.contains(e.target)) {
            printMenu.style.display = 'none';
        }
    });

    // Címek frissítése
    document.querySelectorAll('.card-title-input').forEach(input => {
        input.addEventListener('input', (e) => {
            const side = e.target.dataset.side;
            state[side].title = e.target.value;
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

    // Export gomb
    document.getElementById('export-pdf').addEventListener('click', (e) => {
        e.stopPropagation();
        document.getElementById('print-menu-content').style.display = 'none';
        exportPDF(state.patternQueue);
    });

    // Nyomtatás gomb
    document.getElementById('print-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        document.getElementById('print-menu-content').style.display = 'none';
        preparePrintLayout();
        window.print();
    });

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
        const side = document.getElementById('card-front').style.display !== 'none' ? 'front' : 'back';
        if (cardTitle) {
            const savedCards = JSON.parse(localStorage.getItem('sagrada_saved_cards') || '[]');
            const card = savedCards.find(c => c.title === cardTitle);
            if (card) {
                state[side] = JSON.parse(JSON.stringify(card));
                renderGrid(side);
                document.querySelector(`.card-title-input[data-side="${side}"]`).value = card.title;
            }
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
    const deleteBtn = document.createElement('button');
    deleteBtn.id = 'delete-saved';
    deleteBtn.className = 'btn-danger';
    deleteBtn.style.width = '100%';
    deleteBtn.style.marginTop = '10px';
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

    // Kártya fordítása kattintásra
    document.getElementById('card-container').addEventListener('click', (e) => {
        // Ne forduljon meg, ha beviteli mezőre kattintunk
        if (e.target.tagName === 'INPUT') return;
        window.toggleSide();
    });

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
 * Print layout előkészítése
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
    
    state.patternQueue.forEach(item => {
        const cardDiv = document.createElement('div');
        cardDiv.className = 'print-card';
        
        const img = document.createElement('img');
        img.src = item.img;
        
        cardDiv.appendChild(img);
        printContainer.appendChild(cardDiv);
    });
}

/**
 * Kártya oldal váltása
 */
window.toggleSide = function() {
    const front = document.getElementById('card-front');
    const back = document.getElementById('card-back');
    const toggle = document.getElementById('side-toggle');
    const lang = document.documentElement.lang || 'hu';
    
    if (front.style.display === 'none') {
        front.style.display = 'block';
        back.style.display = 'none';
        toggle.textContent = translations[lang].frontSide;
    } else {
        front.style.display = 'none';
        back.style.display = 'block';
        toggle.textContent = translations[lang].backSide;
    }
}


// Language switcher
document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const lang = btn.dataset.lang;
        updateLanguage(lang);
        const flag = btn.querySelector('span').textContent;
        document.getElementById('current-lang').textContent = flag;
    });
});

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
            } else {
                el.textContent = t[key];
            }
        }
    });

    // Update side toggle text
    const toggle = document.getElementById('side-toggle');
    if (toggle) {
        if (document.getElementById('card-front').style.display !== 'none') {
            toggle.textContent = t.frontSide;
        } else {
            toggle.textContent = t.backSide;
        }
    }

    // Update queue UI to reflect language change
    updateQueueUI();
}

// Expose functions to window for onclick handlers
window.loadFromQueue = loadFromQueue;
window.removeFromQueue = removeFromQueue;

// Start
window.addEventListener('DOMContentLoaded', async () => {
    try {
        await init();
    } catch (err) {
        console.error("Initialization error:", err);
        document.body.innerHTML = `<div style="color:red; padding:20px;">Hiba történt az alkalmazás betöltésekor: ${err.message}</div>`;
    }

    // Add version to footer
    const footer = document.createElement('footer');
    footer.className = 'no-print';
    footer.style.textAlign = 'center';
    footer.style.padding = '20px';
    footer.style.fontSize = '12px';
    footer.style.color = '#86868b';
    footer.textContent = 'Verzió: 0.1.1 | Sagrada Pattern Designer';
    document.body.appendChild(footer);
});
