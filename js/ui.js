import { state } from './state.js';
import { translations } from './i18n.js';

export function renderGrid(side) {
    const gridContainer = document.getElementById(`grid-${side}`);
    gridContainer.innerHTML = '';

    state[side].cells.forEach((cellData, index) => {
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.dataset.index = index;
        cell.dataset.side = side;

        updateCellAppearance(cell, cellData);

        cell.addEventListener('click', (e) => {
            // Need to import openPicker here, but it's in script.js.
            // I'll need to move openPicker to a module too.
            window.openPicker(e, side, index);
        });

        gridContainer.appendChild(cell);
    });

    renderDifficulty(side);
}

export function updateCellAppearance(cell, cellData) {
    const { color, value } = cellData;
    
    cell.classList.remove('c-r', 'c-g', 'c-b', 'c-y', 'c-p', 'c-w', 'v-x', 'v-num', 'has-color', 'has-value');
    cell.innerHTML = '';
    cell.style.backgroundColor = '';

    // Handle Color
    if (['R', 'G', 'B', 'Y', 'P', 'W'].includes(color)) {
        cell.classList.add(`c-${color.toLowerCase()}`);
        cell.classList.add('has-color');
        if (color === 'W') {
            cell.style.backgroundColor = '#ffffff';
        }
    }

    // Handle Value
    if (value === 'X') {
        cell.classList.add('v-x');
        cell.classList.add('has-value');
        cell.textContent = 'X';
    } else if (value !== '.' && !isNaN(value)) {
        cell.classList.add('v-num');
        cell.classList.add('has-value');
        
        const diceFace = document.createElement('div');
        diceFace.className = 'dice-face';
        diceFace.dataset.val = value;
        
        // If there's also a color, make the dice face semi-transparent
        if (color !== '.') {
            diceFace.classList.add('overlay');
        }
        
        const numDots = parseInt(value);
        for (let i = 0; i < numDots; i++) {
            const dot = document.createElement('div');
            dot.className = 'dice-dot';
            diceFace.appendChild(dot);
        }
        cell.appendChild(diceFace);
    }
}

export function renderDifficulty(side) {
    const container = document.querySelector(`.difficulty-display[data-side="${side}"]`);
    container.innerHTML = '';

    const diff = state[side].difficulty || 3;
    
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

export function updateQueueUI() {
    const frontSchematic = document.getElementById('schematic-front');
    const backSchematic = document.getElementById('schematic-back');
    
    if (!frontSchematic || !backSchematic) return;

    // Reset schematics
    [frontSchematic, backSchematic].forEach(schematic => {
        const slots = schematic.querySelectorAll('.schematic-card');
        slots.forEach((slot, i) => {
            slot.innerHTML = i + 1;
            slot.classList.remove('filled');
            slot.onclick = null;
        });
    });

    const lang = document.documentElement.lang || 'hu';
    const t = translations[lang] || translations['hu'];

    if (state.patternQueue.length === 0) {
        return;
    }

    // Fill slots
    state.patternQueue.forEach((item, idx) => {
        if (idx >= 9) return; // Only 9 slots on A4

        const frontSlot = frontSchematic.querySelector(`.schematic-card[data-index="${idx}"]`);
        // Back slots are mirrored horizontally for duplex
        // The mapping is already in HTML data-index
        const backSlot = backSchematic.querySelector(`.schematic-card[data-index="${idx}"]`);

        if (frontSlot) {
            frontSlot.classList.add('filled');
            frontSlot.innerHTML = `
                <img src="${item.frontImg}" />
                <div class="remove-mini" onclick="event.stopPropagation(); window.removeFromQueue(${idx})">×</div>
            `;
            frontSlot.onclick = () => window.loadFromQueue(idx);
        }

        if (backSlot && item.backImg) {
            backSlot.classList.add('filled');
            backSlot.innerHTML = `
                <img src="${item.backImg}" />
            `;
            backSlot.onclick = () => window.loadFromQueue(idx);
        }
    });
}

