import { state } from './state.js';
import { renderGrid } from './ui.js';

/**
 * Generál egy véletlenszerű mintát a megadott szabályok szerint.
 * @param {string} side - 'front' vagy 'back'
 * @param {object} config - A generálás paraméterei
 */
export function generateRandomPattern(side, config) {
    const { colorCount, uniqueColorsCount, valueCount, uniqueValuesCount, seed } = config;
    
    // Egyszerű LCG (Linear Congruential Generator) a seed-hez
    let currentSeed = seed ? hashString(seed) : Math.floor(Math.random() * 1000000);
    const random = () => {
        currentSeed = (currentSeed * 1664525 + 1013904223) % 4294967296;
        return currentSeed / 4294967296;
    };

    function hashString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) - hash) + str.charCodeAt(i);
            hash |= 0;
        }
        return Math.abs(hash);
    }

    // Kártya ürítése az adott oldalon
    state[side].cells = Array(20).fill(null).map(() => ({ color: '.', value: '.' }));
    
    const allColors = ['R', 'G', 'B', 'Y', 'P'];
    const allValues = ['1', '2', '3', '4', '5', '6'];
    
    // Csak a kért számú egyedi színt/számot használjuk
    const availableColors = shuffle([...allColors], random).slice(0, Math.min(uniqueColorsCount, 5));
    const availableValues = shuffle([...allValues], random).slice(0, Math.min(uniqueValuesCount, 6));
    
    // Szomszédok lekérése (fel, le, bal, jobb)
    const getNeighbors = (idx) => {
        const neighbors = [];
        const r = Math.floor(idx / 5);
        const c = idx % 5;
        if (r > 0) neighbors.push(idx - 5);
        if (r < 3) neighbors.push(idx + 5);
        if (c > 0) neighbors.push(idx - 1);
        if (c < 4) neighbors.push(idx + 1);
        return neighbors;
    };

    // Szabad helyek listája
    let availableIndices = Array.from({length: 20}, (_, i) => i);
    
    // Véletlenszerű sorrend a helyeknek
    function shuffle(array, rng) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(rng() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    // Színek elhelyezése
    let placedColors = 0;
    let colorIndices = shuffle([...availableIndices], random);
    
    for (let i = 0; i < colorIndices.length && placedColors < colorCount; i++) {
        const idx = colorIndices[i];
        
        // Próbálunk egy érvényes színt találni erre a helyre
        const shuffledColors = shuffle([...availableColors], random);
        
        for (const color of shuffledColors) {
            const neighbors = getNeighbors(idx);
            const isInvalid = neighbors.some(nIdx => state[side].cells[nIdx].color === color);
            
            if (!isInvalid) {
                state[side].cells[idx].color = color;
                placedColors++;
                break;
            }
        }
    }

    // Számok elhelyezése (csak oda, ahol nincs szín)
    let placedValues = 0;
    let valueIndices = shuffle(availableIndices.filter(idx => state[side].cells[idx].color === '.'), random);
    
    for (let i = 0; i < valueIndices.length && placedValues < valueCount; i++) {
        const idx = valueIndices[i];
        
        const shuffledValues = shuffle([...availableValues], random);
        
        for (const val of shuffledValues) {
            const neighbors = getNeighbors(idx);
            const isInvalid = neighbors.some(nIdx => state[side].cells[nIdx].value === val);
            
            if (!isInvalid) {
                state[side].cells[idx].value = val;
                placedValues++;
                break;
            }
        }
    }

    // Egyedi név és nehézség
    const totalConstraints = placedColors + placedValues;
    let difficulty = 3;
    if (totalConstraints > 14) difficulty = 6;
    else if (totalConstraints > 12) difficulty = 5;
    else if (totalConstraints > 10) difficulty = 4;
    
    state[side].difficulty = difficulty;
    state[side].title = `GEN-${currentSeed.toString(16).toUpperCase().slice(0, 4)}-${totalConstraints}`;
    
    // UI frissítése
    const titleInput = document.querySelector(`.card-title-input[data-side="${side}"]`);
    if (titleInput) titleInput.value = state[side].title;
    
    renderGrid(side);
}
