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
    const container = document.getElementById('pattern-queue');
    container.innerHTML = '';
    
    const lang = document.documentElement.lang || 'hu';
    const t = translations[lang] || translations['hu'];

    if (state.patternQueue.length === 0) {
        container.innerHTML = `<p class="empty-msg">${t.emptyQueue}</p>`;
        return;
    }

    state.patternQueue.forEach((item, idx) => {
        const div = document.createElement('div');
        div.className = 'queue-item';
        div.style.border = "1px solid var(--panel-border)";
        div.style.padding = "5px";
        div.style.marginBottom = "10px";
        
        const sideText = item.side === 'front' ? t.front : t.back;
        
        div.innerHTML = `
            <img src="${item.img}" style="width:50px; height:50px; margin-right:10px; border-radius: 4px; object-fit: cover;" />
            <div style="flex:1; font-size:12px">
                <div style="font-weight: 600;">${item.title} (${sideText})</div>
                <div style="color:#86868b">${t.difficulty}: ${item.difficulty}</div>
            </div>
            <button onclick="window.loadFromQueue(${idx})" class="btn-secondary" style="padding:4px 8px; font-size:11px; margin-right:5px; border-radius: 10px;">${t.edit}</button>
            <button onclick="window.removeFromQueue(${idx})" style="color:#ff3b30; background:none; border:none; cursor:pointer; font-size: 18px; padding: 0 5px;">×</button>
        `;
        container.appendChild(div);
    });
}

