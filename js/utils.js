import { translations } from './i18n.js';

export async function renderToCanvas(id) {
    const el = document.getElementById(id);
    if (!el) return null;

    const tempContainer = document.createElement('div');
    tempContainer.style.position = 'fixed';
    tempContainer.style.left = '-5000px';
    tempContainer.style.top = '-5000px';
    tempContainer.style.width = '1063px';
    tempContainer.style.height = '945px';
    tempContainer.style.backgroundColor = 'white';
    document.body.appendChild(tempContainer);

    const clone = el.cloneNode(true);
    
    // Apply printer friendly if checked
    if (document.getElementById('printer-friendly')?.checked) {
        clone.classList.add('printer-friendly');
    }

    clone.style.transform = 'none';
    clone.style.zoom = '1';
    clone.style.position = 'relative';
    clone.style.left = '0';
    clone.style.top = '0';
    clone.style.margin = '0';
    
    const originalInput = el.querySelector('.card-title-input');
    const cloneInput = clone.querySelector('.card-title-input');
    if (originalInput && cloneInput) {
        const textSpan = document.createElement('span');
        textSpan.textContent = originalInput.value;
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
            scale: 2,
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

export async function exportPDF(patternQueue) {
    const lang = document.documentElement.lang || 'hu';
    const t = translations[lang] || translations['hu'];

    if (patternQueue.length === 0) {
        alert(t.alertQueueEmpty);
        return;
    }

    const btn = document.getElementById('export-pdf');
    const originalText = btn.textContent;
    btn.textContent = "...";
    btn.disabled = true;

    try {
        const isPrinterFriendly = document.getElementById('printer-friendly')?.checked;
        const mode = isPrinterFriendly ? "outline-only" : "full";
        
        // Page parameters (A4)
        const pageWidth = 210;
        const pageHeight = 297;
        const margin = 8;
        
        // Card parameters
        const cardWidth = 63;
        const cardHeight = 88;
        const gap = 2;
        
        // 3x3 grid
        const cols = 3;
        const rows = 3;
        const cardsPerPage = cols * rows;

        // Calculate positions for 9 cards
        const generateCards = (items, isBack = false) => {
            return items.map((item, i) => {
                const frontCol = i % cols;
                const frontRow = Math.floor(i / cols);
                
                let col = frontCol;
                let row = frontRow;
                
                if (isBack) {
                    col = (cols - 1 - frontCol);
                    row = frontRow;
                }
                
                const x = margin + col * (cardWidth + gap);
                const y = margin + row * (cardHeight + gap);
                
                return {
                    x: parseFloat(x.toFixed(2)),
                    y: parseFloat(y.toFixed(2)),
                    width: cardWidth,
                    height: cardHeight,
                    content: {
                        id: item.id,
                        title: item.title,
                        difficulty: item.difficulty,
                        grid: item.grid,
                        side: isBack ? "back" : "front"
                    }
                };
            });
        };

        // Crop marks calculation
        const generateCropMarks = () => {
            const marks = [];
            const markLen = 5;
            
            // Vertical cut lines (X coordinates)
            const xCoords = [];
            for (let c = 0; c <= cols; c++) {
                const x = margin + c * cardWidth + (c > 0 ? (c - 1) * gap : 0);
                xCoords.push(x);
                if (c > 0 && c < cols) {
                    xCoords.push(x + gap);
                }
            }
            // Wait, simpler:
            const simpleX = [];
            for (let c = 0; c < cols; c++) {
                simpleX.push(margin + c * (cardWidth + gap)); // Left
                simpleX.push(margin + c * (cardWidth + gap) + cardWidth); // Right
            }
            
            const simpleY = [];
            for (let r = 0; r < rows; r++) {
                simpleY.push(margin + r * (cardHeight + gap)); // Top
                simpleY.push(margin + r * (cardHeight + gap) + cardHeight); // Bottom
            }

            const gridWidth = cols * cardWidth + (cols - 1) * gap;
            const gridHeight = rows * cardHeight + (rows - 1) * gap;

            simpleX.forEach(x => {
                marks.push({ x1: x, y1: margin - markLen, x2: x, y2: margin });
                marks.push({ x1: x, y1: margin + gridHeight, x2: x, y2: margin + gridHeight + markLen });
            });

            simpleY.forEach(y => {
                marks.push({ x1: margin - markLen, y1: y, x2: margin, y2: y });
                marks.push({ x1: margin + gridWidth, y1: y, x2: margin + gridWidth + markLen, y2: y });
            });

            return marks;
        };

        const pageItems = patternQueue.slice(0, cardsPerPage);
        
        const output = {
            page: {
                size: "A4",
                width: pageWidth,
                height: pageHeight,
                margin: margin,
                unit: "mm"
            },
            mode: mode,
            cards: generateCards(pageItems, false),
            backSide: generateCards(pageItems, true),
            cropMarks: generateCropMarks(),
            laserTargets: [
                { x: 5, y: 5 },
                { x: 205, y: 292 }
            ]
        };

        // Download JSON
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(output, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", `sagrada_print_${mode}.json`);
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();

    } catch (err) {
        console.error("JSON export error:", err);
        alert("Hiba történt a JSON generálása közben.");
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
    }
}
