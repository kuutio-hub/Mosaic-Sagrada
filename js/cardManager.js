import { state } from './state.js';
import { updateQueueUI, renderGrid } from './ui.js';
import { renderToCanvas } from './utils.js';
import { translations } from './i18n.js';

export async function addToQueue() {
    const btn = document.getElementById('add-to-queue');
    btn.disabled = true;
    
    const lang = document.documentElement.lang || 'hu';
    const t = translations[lang] || translations['hu'];
    
    // Temporarily change text
    const originalText = btn.textContent;
    btn.textContent = "...";

    const isDoubleSided = document.getElementById('double-sided').checked;
    const frontCard = document.getElementById('card-front');
    const backCard = document.getElementById('card-back');

    // Temporarily reset transform for clean capture
    const originalTransformFront = frontCard.style.transform;
    const originalTransformBack = backCard.style.transform;
    frontCard.style.transform = 'scale(1)';
    backCard.style.transform = 'scale(1)';

    try {
        const frontData = await renderToCanvas('card-front');
        let backData = null;

        if (isDoubleSided) {
            const originalDisplayFront = frontCard.style.display;
            const originalDisplayBack = backCard.style.display;
            
            frontCard.style.display = 'none';
            backCard.style.display = 'block';
            backData = await renderToCanvas('card-back');
            
            frontCard.style.display = originalDisplayFront;
            backCard.style.display = originalDisplayBack;
        }

        if (frontData) {
            state.patternQueue.push({
                title: state.front.title,
                difficulty: state.front.difficulty,
                frontImg: frontData,
                backImg: backData,
                isDoubleSided: isDoubleSided,
                frontState: JSON.parse(JSON.stringify(state.front)),
                backState: isDoubleSided ? JSON.parse(JSON.stringify(state.back)) : null
            });
            updateQueueUI();
        }
    } catch (err) {
        console.error("Hiba a hozzáadáskor:", err);
        alert(t.alertSaveError);
    } finally {
        frontCard.style.transform = originalTransformFront;
        backCard.style.transform = originalTransformBack;
        btn.disabled = false;
        btn.textContent = t.addToQueue;
    }
}

export function removeFromQueue(index) {
    state.patternQueue.splice(index, 1);
    updateQueueUI();
}

export function loadFromQueue(index) {
    const item = state.patternQueue[index];
    
    // Load front
    state.front.title = item.frontState.title;
    state.front.difficulty = item.frontState.difficulty;
    state.front.cells = item.frontState.cells.map(c => ({ ...c }));
    
    // Load back if exists
    if (item.backState) {
        state.back.title = item.backState.title;
        state.back.difficulty = item.backState.difficulty;
        state.back.cells = item.backState.cells.map(c => ({ ...c }));
        document.getElementById('double-sided').checked = true;
    } else {
        document.getElementById('double-sided').checked = false;
    }

    renderGrid('front');
    renderGrid('back');
    
    document.querySelector(`.card-title-input[data-side="front"]`).value = state.front.title;
    document.querySelector(`.card-title-input[data-side="back"]`).value = state.back.title;
}

export async function loadPromoCards() {
    console.log("Loading promo cards...");
    try {
        const response = await fetch('https://raw.githubusercontent.com/chardila/sagrada_generator/main/card.txt');
        console.log("Response status:", response.status);
        const text = await response.text();
        console.log("Response text length:", text.length);
        const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        
        const promoCards = [];
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
        console.log("Promo cards loaded:", promoCards.length);
        return promoCards;
    } catch (err) {
        console.error("Hiba a promo kártyák betöltésekor:", err);
        return [];
    }
}

export function loadSavedCardsList() {
    const select = document.getElementById('saved-select');
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

export function applyCardToState(card, side) {
    state[side].title = card.title;
    state[side].difficulty = card.difficulty;
    
    const cells = [];
    card.grid.forEach(row => {
        for (let char of row) {
            let val = char.toUpperCase();
            if (['R', 'G', 'B', 'Y', 'P', 'W'].includes(val)) {
                cells.push({ color: val, value: '.' });
            } else if (!isNaN(val) && val !== '.') {
                cells.push({ color: '.', value: val });
            } else {
                cells.push({ color: '.', value: val });
            }
        }
    });
    state[side].cells = cells;
}

export function applySavedCard(title) {
    const savedCards = JSON.parse(localStorage.getItem('sagrada_saved_cards') || '[]');
    const card = savedCards.find(c => c.title === title);
    if (card) {
        const side = document.getElementById('card-front').style.display !== 'none' ? 'front' : 'back';
        state[side].title = card.title;
        state[side].difficulty = card.difficulty;
        state[side].cells = card.cells.map(c => ({ ...c }));
        renderGrid(side);
        document.querySelector(`.card-title-input[data-side="${side}"]`).value = card.title;
    }
}

export function deleteSavedCard(title) {
    let savedCards = JSON.parse(localStorage.getItem('sagrada_saved_cards') || '[]');
    savedCards = savedCards.filter(c => c.title !== title);
    localStorage.setItem('sagrada_saved_cards', JSON.stringify(savedCards));
    loadSavedCardsList();
}

