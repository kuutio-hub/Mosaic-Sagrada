/**
 * Sagrada Pattern Designer Logic
 * Pure Vanilla JS - No Build Steps
 */

const { jsPDF } = window.jspdf;

// Alkalmazás állapota
const state = {
    front: {
        title: "MINTA NÉV",
        difficulty: 3,
        cells: Array(20).fill('.') // 4x5 rács
    },
    back: {
        title: "MINTA NÉV (HÁT)",
        difficulty: 4,
        cells: Array(20).fill('.')
    }
};

// Nyomtatási lista
let patternQueue = [];

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
    await loadPromoCards();

    // Mentett kártyák betöltése
    loadSavedCardsList();

    // Eseménykezelők
    setupEventListeners();
}

/**
 * Rács kirajzolása
 */
function renderGrid(side) {
    const gridContainer = document.getElementById(`grid-${side}`);
    gridContainer.innerHTML = '';

    state[side].cells.forEach((val, index) => {
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.dataset.index = index;
        cell.dataset.side = side;

        updateCellAppearance(cell, val);

        cell.addEventListener('click', (e) => {
            openPicker(e, side, index);
        });

        gridContainer.appendChild(cell);
    });

    renderDifficulty(side);
}

/**
 * Cella kinézetének frissítése
 */
function updateCellAppearance(cell, val) {
    cell.classList.remove('c-r', 'c-g', 'c-b', 'c-y', 'c-p', 'c-w', 'v-x', 'v-num');
    cell.innerHTML = '';

    if (['R', 'G', 'B', 'Y', 'P', 'W'].includes(val)) {
        cell.classList.add(`c-${val.toLowerCase()}`);
        if (val === 'W') {
            cell.style.backgroundColor = '#ffffff';
        } else {
            cell.style.backgroundColor = ''; // Reset if not W
        }
    } else if (val === 'X') {
        cell.classList.add('v-x');
        cell.textContent = 'X';
    } else if (val !== '.' && !isNaN(val)) {
        cell.classList.add('v-num');
        
        // Dice face rendering
        const diceFace = document.createElement('div');
        diceFace.className = 'dice-face';
        diceFace.dataset.val = val;
        
        const numDots = parseInt(val);
        // Always create 6 dots, CSS will hide/show them based on data-val if we use a better approach, 
        // OR just create the exact number. The current CSS uses nth-child, so we must create the exact number.
        for (let i = 0; i < numDots; i++) {
            const dot = document.createElement('div');
            dot.className = 'dice-dot';
            diceFace.appendChild(dot);
        }
        cell.appendChild(diceFace);
    }
}

/**
 * Nehézségi kép kirajzolása
 */
function renderDifficulty(side) {
    const container = document.querySelector(`.difficulty-display[data-side="${side}"]`);
    container.innerHTML = '';

    const diff = state[side].difficulty || 3;
    
    // Sagrada usually has 3-6 dots, but user asked for 1-6
    for (let i = 1; i <= 6; i++) {
        const dot = document.createElement('div');
        dot.className = 'difficulty-dot' + (i <= diff ? ' active' : '');
        
        dot.addEventListener('click', (e) => {
            e.stopPropagation();
            state[side].difficulty = i;
            renderDifficulty(side);
        });
        
        container.appendChild(dot);
    }
}

/**
 * Picker megnyitása
 */
function openPicker(e, side, index) {
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
            patternQueue = [];
            updateQueueUI();
        }
    });

    // Export gomb
    document.getElementById('export-pdf').addEventListener('click', exportPDF);

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

    // Promo kártya választás
    document.getElementById('promo-select').addEventListener('change', (e) => {
        const cardId = e.target.value;
        const side = document.querySelector('input[name="promo-side"]:checked').value;
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
        
        // Ha már létezik ilyen nevű, frissítjük, különben hozzáadjuk
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
 * Promo kártyák betöltése és parszolása
 */
async function loadPromoCards() {
    try {
        const response = await fetch('https://raw.githubusercontent.com/chardila/sagrada_generator/main/card.txt');
        const text = await response.text();
        const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        
        // 7 soros blokkok
        for (let i = 0; i < lines.length; i += 7) {
            if (i + 6 < lines.length) {
                const card = {
                    title: lines[i],
                    difficulty: parseInt(lines[i+1]),
                    grid: [lines[i+2], lines[i+3], lines[i+4], lines[i+5]],
                    id: lines[i+6]
                };
                promoCards.push(card);
            }
        }
        
        const select = document.getElementById('promo-select');
        promoCards.forEach(card => {
            const opt = document.createElement('option');
            opt.value = card.id;
            opt.textContent = `${card.title} (${card.id})`;
            select.appendChild(opt);
        });
    } catch (err) {
        console.error("Hiba a promo kártyák betöltésekor:", err);
    }
}

/**
 * Mentett kártyák listájának frissítése
 */
function loadSavedCardsList() {
    const select = document.getElementById('saved-select');
    // Töröljük az alapértelmezett utániakat
    while (select.options.length > 1) {
        select.remove(1);
    }
    
    const savedCards = JSON.parse(localStorage.getItem('sagrada_saved_cards') || '[]');
    savedCards.forEach(card => {
        const opt = document.createElement('option');
        opt.value = card.title;
        opt.textContent = card.title;
        select.appendChild(opt);
    });
}

/**
 * Kártya adatok alkalmazása az állapotra
 */
function applyCardToState(card, side) {
    state[side].title = card.title;
    state[side].difficulty = card.difficulty;
    
    const cells = [];
    card.grid.forEach(row => {
        for (let char of row) {
            let val = char.toUpperCase();
            // 'w' is white in the txt, but we want to map it to 'W' for our CSS
            if (val === 'W') val = 'W'; 
            cells.push(val);
        }
    });
    state[side].cells = cells;
}

/**
 * Hozzáadás a nyomtatási listához
 */
async function addToQueue() {
    const btn = document.getElementById('add-to-queue');
    btn.disabled = true;
    btn.textContent = "Hozzáadás...";

    try {
        // Rendereljük a kártyákat canvas-ra, hogy elmentsük a pillanatnyi állapotot
        const frontData = await renderToCanvas('card-front');
        const backData = await renderToCanvas('card-back');

        if (frontData && backData) {
            patternQueue.push({
                title: state.front.title,
                frontImg: frontData,
                backImg: backData
            });
            updateQueueUI();
        }
    } catch (err) {
        console.error("Hiba a hozzáadáskor:", err);
        alert("Hiba történt a kártya mentésekor.");
    } finally {
        btn.disabled = false;
        btn.textContent = "Hozzáadás a listához";
    }
}

/**
 * Lista UI frissítése
 */
function updateQueueUI() {
    const container = document.getElementById('pattern-queue');
    container.innerHTML = '';

    if (patternQueue.length === 0) {
        container.innerHTML = '<p class="empty-msg">A lista üres. Adj hozzá mintákat!</p>';
        return;
    }

    patternQueue.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = 'queue-item';
        div.innerHTML = `
            <input type="checkbox" class="queue-select" data-index="${index}" checked>
            <span>${index + 1}. ${item.title}</span>
            <button class="remove-btn" onclick="removeFromQueue(${index})">&times;</button>
        `;
        container.appendChild(div);
    });
}

/**
 * Elem eltávolítása a listából
 */
window.removeFromQueue = function(index) {
    patternQueue.splice(index, 1);
    updateQueueUI();
};

/**
 * PDF Exportálás (Lista alapján)
 */
async function exportPDF() {
    const selectedIndices = Array.from(document.querySelectorAll('.queue-select:checked'))
        .map(cb => parseInt(cb.dataset.index));

    if (selectedIndices.length === 0) {
        alert("Nincs kiválasztott kártya!");
        return;
    }

    const selectedQueue = selectedIndices.map(idx => patternQueue[idx]);

    const btn = document.getElementById('export-pdf');
    const originalText = btn.textContent;
    btn.textContent = "Generálás...";
    btn.disabled = true;

    try {
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4'
        });

        const doubleSided = document.getElementById('double-sided').checked;
        
        const cardW = 106.3;
        const cardH = 94.5;
        
        const cardsPerPage = 4;
        const totalPages = Math.ceil(selectedQueue.length / cardsPerPage);

        for (let p = 0; p < totalPages; p++) {
            const startIdx = p * cardsPerPage;
            const endIdx = Math.min(startIdx + cardsPerPage, selectedQueue.length);
            const pageItems = selectedQueue.slice(startIdx, endIdx);

            // FRONT OLDAL
            if (p > 0) pdf.addPage();
            
            pageItems.forEach((item, i) => {
                const col = i % 2;
                const row = Math.floor(i / 2);
                
                const marginX = (210 - (2 * cardH)) / 3;
                const marginY = (297 - (2 * cardW)) / 3;
                
                const x = marginX + col * (cardH + marginX);
                const y = marginY + row * (cardW + marginY);

                // Rotate -90 degrees around (x, y + cardW)
                pdf.addImage(item.frontImg, 'PNG', x, y + cardW, cardH, cardW, null, 'FAST', -90);
            });

            // BACK OLDAL (ha kérték)
            if (doubleSided) {
                pdf.addPage();
                pageItems.forEach((item, i) => {
                    const col = i % 2;
                    const row = Math.floor(i / 2);
                    
                    // Tükrözés a hátoldalhoz: a bal oszlop a jobb oldalra kerül a papír túloldalán
                    const targetCol = 1 - col; 
                    
                    const marginX = (210 - (2 * cardH)) / 3;
                    const marginY = (297 - (2 * cardW)) / 3;
                    
                    const x = marginX + targetCol * (cardH + marginX);
                    const y = marginY + row * (cardW + marginY);

                    if (item.backImg) {
                        pdf.addImage(item.backImg, 'PNG', x, y + cardW, cardH, cardW, null, 'FAST', -90);
                    }
                });
            }
        }

        pdf.save('sagrada_patterns.pdf');
    } catch (err) {
        console.error("PDF export error:", err);
        alert("Hiba történt a PDF generálása közben.");
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
    }
}

/**
 * Kártya renderelése Canvas-ra (html2canvas)
 */
async function renderToCanvas(id) {
    const el = document.getElementById(id);
    if (!el) return null;

    // Create a temporary container to render the card at 1:1 scale
    const tempContainer = document.createElement('div');
    tempContainer.style.position = 'fixed';
    tempContainer.style.left = '-5000px';
    tempContainer.style.top = '-5000px';
    tempContainer.style.width = '1063px';
    tempContainer.style.height = '945px';
    tempContainer.style.backgroundColor = 'white';
    document.body.appendChild(tempContainer);

    const clone = el.cloneNode(true);
    clone.style.transform = 'none';
    clone.style.zoom = '1';
    clone.style.position = 'relative';
    clone.style.left = '0';
    clone.style.top = '0';
    clone.style.margin = '0';
    
    // Ensure inputs are correctly rendered as text in the clone
    const originalInput = el.querySelector('.card-title-input');
    const cloneInput = clone.querySelector('.card-title-input');
    if (originalInput && cloneInput) {
        const textSpan = document.createElement('span');
        textSpan.textContent = originalInput.value;
        // Copy essential styles for the text
        const style = window.getComputedStyle(originalInput);
        textSpan.style.fontFamily = style.fontFamily;
        textSpan.style.fontSize = style.fontSize;
        textSpan.style.fontWeight = style.fontWeight;
        textSpan.style.color = style.color;
        textSpan.style.textAlign = 'center';
        textSpan.style.display = 'block';
        textSpan.style.width = '100%';
        textSpan.style.marginTop = '10px';
        cloneInput.parentNode.replaceChild(textSpan, cloneInput);
    }

    tempContainer.appendChild(clone);

    try {
        const canvas = await html2canvas(clone, {
            scale: 2, // High DPI for printing
            useCORS: true,
            backgroundColor: null,
            logging: false,
            width: 1063,
            height: 945
        });
        document.body.removeChild(tempContainer);
        return canvas.toDataURL('image/png');
    } catch (err) {
        console.error("Canvas render error:", err);
        if (tempContainer.parentNode) document.body.removeChild(tempContainer);
        return null;
    }
}

// Start
window.addEventListener('DOMContentLoaded', () => {
    init();
});
