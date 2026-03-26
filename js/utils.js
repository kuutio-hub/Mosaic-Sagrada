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
        
        // Card parameters (Standard Sagrada card size)
        const cardWidth = 63;
        const cardHeight = 88;
        
        // 3x3 grid
        const cols = 3;
        const rows = 3;
        const cardsPerPage = cols * rows;
        
        const totalWidth = cols * cardWidth;
        const totalHeight = rows * cardHeight;
        
        const marginX = (pageWidth - totalWidth) / 2;
        const marginY = (pageHeight - totalHeight) / 2;

        const pages = [];
        const numPages = Math.ceil(patternQueue.length / cardsPerPage);

        for (let p = 0; p < numPages; p++) {
            const startIdx = p * cardsPerPage;
            const pageItems = patternQueue.slice(startIdx, startIdx + cardsPerPage);
            
            const cardPositions = [];
            const duplexCardPositions = [];
            const cropMarks = [];
            const laserTargets = [];

            pageItems.forEach((item, i) => {
                const col = i % cols;
                const row = Math.floor(i / cols);
                
                const x = marginX + col * cardWidth;
                const y = marginY + row * cardHeight;
                
                cardPositions.push({
                    id: item.id || `card-${p}-${i}`,
                    title: item.title,
                    x: parseFloat(x.toFixed(2)),
                    y: parseFloat(y.toFixed(2)),
                    width: cardWidth,
                    height: cardHeight,
                    side: "front"
                });

                // Duplex logic: flip horizontally across the page center
                // The center of the page is pageWidth / 2
                // A card at x has its right edge at x + cardWidth
                // Its distance from left edge is x
                // On the back side, it should be at the same distance from the RIGHT edge
                const duplexX = pageWidth - x - cardWidth;
                
                duplexCardPositions.push({
                    id: item.id || `card-${p}-${i}-back`,
                    title: item.title + " (BACK)",
                    x: parseFloat(duplexX.toFixed(2)),
                    y: parseFloat(y.toFixed(2)),
                    width: cardWidth,
                    height: cardHeight,
                    side: "back"
                });

                // Crop marks (only for outer edges)
                const markSize = 5;
                if (col === 0) { // Left edge
                    cropMarks.push({ x1: x - markSize, y1: y, x2: x, y2: y });
                    cropMarks.push({ x1: x - markSize, y1: y + cardHeight, x2: x, y2: y + cardHeight });
                }
                if (col === cols - 1 || i === pageItems.length - 1) { // Right edge
                    const rightX = x + cardWidth;
                    cropMarks.push({ x1: rightX, y1: y, x2: rightX + markSize, y2: y });
                    cropMarks.push({ x1: rightX, y1: y + cardHeight, x2: rightX + markSize, y2: y + cardHeight });
                }
                if (row === 0) { // Top edge
                    cropMarks.push({ x1: x, y1: y - markSize, x2: x, y2: y });
                    cropMarks.push({ x1: x + cardWidth, y1: y - markSize, x2: x + cardWidth, y2: y });
                }
                if (row === rows - 1 || i >= pageItems.length - cols) { // Bottom edge
                    const bottomY = y + cardHeight;
                    cropMarks.push({ x1: x, y1: bottomY, x2: x, y2: bottomY + markSize });
                    cropMarks.push({ x1: x + cardWidth, y1: bottomY, x2: x + cardWidth, y2: bottomY + markSize });
                }
            });

            // Laser targets (4 corners of the printable area)
            const targetOffset = 10;
            laserTargets.push({ x: marginX - targetOffset, y: marginY - targetOffset });
            laserTargets.push({ x: marginX + totalWidth + targetOffset, y: marginY - targetOffset });
            laserTargets.push({ x: marginX - targetOffset, y: marginY + totalHeight + targetOffset });
            laserTargets.push({ x: marginX + totalWidth + targetOffset, y: marginY + totalHeight + targetOffset });

            pages.push({
                pageNumber: p + 1,
                cardPositions,
                duplexCardPositions,
                cropMarks,
                laserTargets
            });
        }

        const output = {
            pageParameters: {
                unit: "mm",
                format: "A4",
                width: pageWidth,
                height: pageHeight,
                marginX,
                marginY
            },
            mode,
            pages
        };

        // Download JSON
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(output, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", "sagrada_print_layout.json");
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
