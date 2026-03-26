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

            if (p > 0) pdf.addPage();
            
            pageItems.forEach((item, i) => {
                const col = i % 2;
                const row = Math.floor(i / 2);
                
                const marginX = (210 - (2 * cardH)) / 3;
                const marginY = (297 - (2 * cardW)) / 3;
                
                const x = marginX + col * (cardH + marginX);
                const y = marginY + row * (cardW + marginW);
                
                pdf.addImage(item.frontImg, 'PNG', x, y + cardW, cardH, cardW, null, 'FAST', -90);
            });

            if (doubleSided) {
                pdf.addPage();
                pageItems.forEach((item, i) => {
                    const col = i % 2;
                    const row = Math.floor(i / 2);
                    
                    const targetCol = 1 - col; 
                    
                    const marginX = (210 - (2 * cardH)) / 3;
                    const marginY = (297 - (2 * cardW)) / 3;
                    
                    const x = marginX + targetCol * (cardH + marginX);
                    const y = marginY + row * (cardW + marginW);

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
