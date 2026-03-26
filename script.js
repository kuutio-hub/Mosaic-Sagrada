import { state } from './js/state.js';
import { renderGrid, renderDifficulty, updateQueueUI } from './js/ui.js';
import { addToQueue, removeFromQueue, loadFromQueue, loadPromoCards, loadSavedCardsList, applyCardToState } from './js/cardManager.js';
import { exportPDF } from './js/utils.js';
import { translations } from './js/i18n.js';

// Aktuálisan szerkesztett cella
let activeCell = null;

// Promo kártyák adatai
let promoCards = [];

// SVG Sablonok
const frameSVG = `
<svg width="1063" height="945" viewBox="0 0 1063 945" fill="none" xmlns="http://www.w3.org/2000/svg">
    <!-- Külső keret -->
    <rect x="15" y="15" width="1033" height="915" rx="25" stroke="#d4af37" stroke-width="12" class="frame-outer"/>
    <rect x="35" y="35" width="993" height="875" rx="15" stroke="#d4af37" stroke-width="4" stroke-dasharray="20 10" class="frame-inner"/>
    
    <!-- Rács keret -->
    <rect x="65" y="75" width="933" height="740" rx="10" stroke="#555" stroke-width="4" class="grid-frame"/>
    
    <!-- Díszítő elemek a sarkokban -->
    <circle cx="50" cy="50" r="15" fill="#d4af37" class="corner-dot"/>
    <circle cx="1013" cy="50" r="15" fill="#d4af37" class="corner-dot"/>
    <circle cx="1013" cy="895" r="15" fill="#d4af37" class="corner-dot"/>
    <circle cx="50" cy="895" r="15" fill="#d4af37" class="corner-dot"/>
    
    <!-- Alsó díszítés -->
    <path d="M300 880 Q 531 920 763 880" stroke="#d4af37" stroke-width="3" fill="none" class="bottom-decoration"/>
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
    // Picker elemek kattintása
    document.querySelectorAll('.picker-item').forEach(item => {
        item.addEventListener('click', () => {
            if (activeCell) {
                const { side, index } = activeCell;
                state[side].cells[index] = item.dataset.val;
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
        if (confirm("Biztosan törlöd a teljes listát?")) {
            state.patternQueue = [];
            updateQueueUI();
        }
    });

    // Export gomb
    document.getElementById('export-pdf').addEventListener('click', () => exportPDF(state.patternQueue));

    // Nyomtatás gomb
    document.getElementById('print-btn').addEventListener('click', () => {
        window.print();
    });

    // Nyomtatóbarát toggle
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
    document.getElementById('side-toggle').addEventListener('click', toggleSide);

    // Promo kártya alkalmazása
    document.getElementById('apply-promo').addEventListener('click', () => {
        const cardId = document.getElementById('promo-select').value;
        const side = document.querySelector('input[name="saved-side"]:checked')?.value || 'front';
        if (cardId) {
            const card = promoCards.find(c => c.id === cardId);
            if (card) {
                applyCardToState(card, side);
                renderGrid(side);
                // Frissítsük az inputot is
                document.querySelector(`.card-title-input[data-side="${side}"]`).value = card.title;
            }
        }
    });

    // Saját kártya választás
    document.getElementById('saved-select').addEventListener('change', (e) => {
        const cardTitle = e.target.value;
        const side = document.querySelector('input[name="saved-side"]:checked').value;
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

    // Mentés gomb
    document.getElementById('save-card').addEventListener('click', () => {
        const side = document.querySelector('input[name="saved-side"]:checked').value;
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
        alert("Kártya elmentve a böngésző tárjába!");
    });
}

/**
 * Kártya oldal váltása
 */
window.toggleSide = function() {
    const front = document.getElementById('card-front');
    const back = document.getElementById('card-back');
    const toggle = document.getElementById('side-toggle');
    
    if (front.style.display === 'none') {
        front.style.display = 'block';
        back.style.display = 'none';
        toggle.textContent = "ELŐLAP (Kattints a fordításhoz)";
    } else {
        front.style.display = 'none';
        back.style.display = 'block';
        toggle.textContent = "HÁTLAP (Kattints a fordításhoz)";
    }
}


// ... (existing imports)

// Language switcher
document.getElementById('lang-select').addEventListener('change', (e) => {
    const lang = e.target.value;
    updateLanguage(lang);
});

function updateLanguage(lang) {
    const t = translations[lang];
    document.querySelector('h1').textContent = t.title;
    document.querySelector('label[for="printer-friendly"]').textContent = t.printerFriendly;
    document.querySelector('label[for="double-sided"]').textContent = t.doubleSided;
    document.getElementById('add-to-queue').textContent = t.addToQueue;
    document.getElementById('export-pdf').textContent = t.exportPDF;
    document.getElementById('print-btn').textContent = t.print;
    document.getElementById('save-card').textContent = t.saveCard;
    document.getElementById('clear-queue').textContent = t.clearQueue;
    document.querySelector('h3').textContent = t.queue; // This might need more specific selector
    // ... update all UI elements
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
    footer.style.textAlign = 'center';
    footer.style.padding = '10px';
    footer.style.fontSize = '12px';
    footer.style.color = '#666';
    footer.textContent = 'Verzió: 0.1.0';
    document.body.appendChild(footer);
});
