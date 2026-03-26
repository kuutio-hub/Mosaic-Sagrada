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
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4'
        });

        // A Sagrada card is 63x88mm. The canvas is 1063x945px.
        // Let's print it at actual size: 88mm x 63mm (landscape on the page)
        const cardW = 88;
        const cardH = 63;
        
        // How many cards fit on an A4 page?
        // A4 is 210x297mm.
        // We can fit 2 columns (2 * 88 = 176mm < 210mm)
        // We can fit 4 rows (4 * 63 = 252mm < 297mm)
        // Total 8 cards per page.
        const cols = 2;
        const rows = 4;
        const cardsPerPage = cols * rows;
        
        const marginX = (210 - (cols * cardW)) / (cols + 1);
        const marginY = (297 - (rows * cardH)) / (rows + 1);

        const totalPages = Math.ceil(patternQueue.length / cardsPerPage);

        for (let p = 0; p < totalPages; p++) {
            if (p > 0) pdf.addPage();
            
            const startIdx = p * cardsPerPage;
            const endIdx = Math.min(startIdx + cardsPerPage, patternQueue.length);
            const pageItems = patternQueue.slice(startIdx, endIdx);

            pageItems.forEach((item, i) => {
                const col = i % cols;
                const row = Math.floor(i / cols);
                
                const x = marginX + col * (cardW + marginX);
                const y = marginY + row * (cardH + marginY);
                
                // Add image
                pdf.addImage(item.img, 'PNG', x, y, cardW, cardH);
                
                // Add crop marks
                pdf.setDrawColor(150);
                pdf.setLineWidth(0.2);
                
                const markLen = 3;
                // Top Left
                pdf.line(x, y - markLen, x, y);
                pdf.line(x - markLen, y, x, y);
                // Top Right
                pdf.line(x + cardW, y - markLen, x + cardW, y);
                pdf.line(x + cardW + markLen, y, x + cardW, y);
                // Bottom Left
                pdf.line(x, y + cardH + markLen, x, y + cardH);
                pdf.line(x - markLen, y + cardH, x, y + cardH);
                // Bottom Right
                pdf.line(x + cardW, y + cardH + markLen, x + cardW, y + cardH);
                pdf.line(x + cardW + markLen, y + cardH, x + cardW, y + cardH);
            });
        }

        pdf.save('sagrada_patterns.pdf');
    } catch (err) {
        console.error("PDF export error:", err);
        alert(t.alertPdfError);
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
    }
}
