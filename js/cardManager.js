import { state } from './state.js';
import { renderGrid, updateQueueUI } from './ui.js';
import { renderToCanvas } from './utils.js';

export async function addToQueue() {
    const btn = document.getElementById('add-to-queue');
    btn.disabled = true;
    btn.textContent = "Hozzáadás...";

    try {
        const frontData = await renderToCanvas('card-front');
        const backData = await renderToCanvas('card-back');

        if (frontData && backData) {
            state.patternQueue.push({
                title: state.front.title,
                difficulty: state.front.difficulty,
                cells: [...state.front.cells],
                img: frontData,
                side: 'front'
            });
            state.patternQueue.push({
                title: state.back.title,
                difficulty: state.back.difficulty,
                cells: [...state.back.cells],
                img: backData,
                side: 'back'
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

export function removeFromQueue(index) {
    state.patternQueue.splice(index, 1);
    updateQueueUI();
}

export function loadFromQueue(index) {
    const item = state.patternQueue[index];
    state[item.side].title = item.title;
    state[item.side].difficulty = item.difficulty;
    state[item.side].cells = [...item.cells];
    renderGrid(item.side);
    // Also update the UI input
    document.querySelector(`.card-title-input[data-side="${item.side}"]`).value = item.title;
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

export function applySavedCard(title) {
    const savedCards = JSON.parse(localStorage.getItem('sagrada_saved_cards') || '[]');
    const card = savedCards.find(c => c.title === title);
    if (card) {
        // Apply to currently visible side
        const side = document.getElementById('card-front').style.display !== 'none' ? 'front' : 'back';
        state[side].title = card.title;
        state[side].difficulty = card.difficulty;
        state[side].cells = [...card.cells];
        renderGrid(side);
        document.querySelector(`.card-title-input[data-side="${side}"]`).value = card.title;
    }
}
