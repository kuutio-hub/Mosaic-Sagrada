import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

export async function generatePDF(queue, cornerRadius = 0) {
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  // Create a hidden container for rendering
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.top = '-10000px';
  container.style.left = '-10000px';
  container.style.width = '210mm';
  container.style.height = '297mm';
  container.style.background = 'white';
  document.body.appendChild(container);

  // Process in batches of 6
  for (let i = 0; i < queue.length; i += 6) {
    const batch = queue.slice(i, i + 6);
    
    // 1. Render Fronts
    await renderBatchPage(pdf, batch, 'front', container, i > 0, cornerRadius);
    
    // 2. Render Backs (if any are double sided)
    const hasBacks = batch.some(item => item.isDoubleSided);
    if (hasBacks) {
      await renderBatchPage(pdf, batch, 'back', container, true, cornerRadius);
    }
  }

  pdf.save('sagrada_cards.pdf');
  document.body.removeChild(container);
}

async function renderBatchPage(
  pdf, 
  batch, 
  side, 
  container,
  addNewPage,
  cornerRadius = 0
) {
  if (addNewPage) {
    pdf.addPage();
  }

  container.innerHTML = '';
  const pageDiv = document.createElement('div');
  pageDiv.className = 'print-page';
  container.appendChild(pageDiv);

  // Positions on A4 (2 columns, 3 rows)
  const startX = 15;
  const startY = 28.5;
  const cardW = 90;
  const cardH = 80;

  for (let idx = 0; idx < batch.length; idx++) {
    const item = batch[idx];
    const cardData = side === 'front' ? item.front : (item.back || item.front);
    
    const cardDiv = document.createElement('div');
    cardDiv.className = 'card-container';
    cardDiv.style.position = 'absolute';
    
    // For two-sided printing, we need to mirror the columns on the back side
    // so they align with the front side when the paper is flipped horizontally.
    const col = side === 'front' ? (idx % 2) : (1 - (idx % 2));
    const row = Math.floor(idx / 2);
    
    cardDiv.style.left = `${startX + col * cardW}mm`;
    cardDiv.style.top = `${startY + row * cardH}mm`;
    cardDiv.style.borderRadius = `${cornerRadius}mm`;
    cardDiv.style.overflow = 'hidden';
    
    // Manual HTML construction to avoid React rendering overhead in service
    cardDiv.innerHTML = `
      <div class="card-grid" style="display: grid; grid-template-columns: repeat(5, 15mm); grid-template-rows: repeat(4, 15mm); gap: 2.5mm; padding: 2.5mm 2.5mm 0 2.5mm; width: fit-content; margin: 0 auto;">
        ${cardData.cells.map(cell => {
          const dotColor = (cell.color === 'W' || cell.color === '.') ? 'black' : 'white';
          const dots = {
            '1': [[50, 50]], '2': [[25, 25], [75, 75]], '3': [[25, 25], [50, 50], [75, 75]],
            '4': [[25, 25], [25, 75], [75, 25], [75, 75]], '5': [[25, 25], [25, 75], [50, 50], [75, 25], [75, 75]],
            '6': [[25, 25], [25, 50], [25, 75], [75, 25], [75, 50], [75, 75]]
          };
          const circles = (dots[cell.value] || []).map(([cx, cy]) => 
            `<circle cx="${cx}" cy="${cy}" r="10" fill="${dotColor}" />`
          ).join('');
          const diceSvg = `data:image/svg+xml;base64,${btoa(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${circles}</svg>`)}`;

          const colorMap = {
            'R': '#ed1c24', 'G': '#00a651', 'B': '#0072bc', 'Y': '#fff200', 'P': '#662d91', 'W': '#ffffff', '.': '#ffffff'
          };
          const bgColor = colorMap[cell.color] || '#ffffff';
          const isX = cell.value === 'X';

          return `
            <div class="card-cell" style="width: 15mm; height: 15mm; display: flex; align-items: center; justify-content: center; position: relative; box-sizing: border-box; background-color: ${isX ? '#f3f4f6' : '#ffffff'}; overflow: hidden;">
              ${cell.color !== '.' ? `
                <div style="position: absolute; inset: 0; background-color: ${bgColor}; opacity: 1; z-index: 2;"></div>
              ` : ''}
              ${cell.value !== '.' ? `
                <div style="font-weight: bold; color: ${dotColor}; display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; z-index: 1;">
                  ${isX ? 
                    `<span style="font-family: 'Uncial Antiqua', serif; font-size: 32pt; color: #9ca3af; opacity: 1; line-height: 1;">X</span>` : 
                    `<img src="/Cells/${cell.value}.png" style="width: 15mm; height: 15mm; object-fit: contain;" onerror="if(!this.src.includes('raw.githubusercontent.com') && !this.src.startsWith('data:image/svg+xml')){this.src='https://raw.githubusercontent.com/chardila/sagrada_generator/main/${cell.value}.png';}else if(!this.src.startsWith('data:image/svg+xml')){this.src='${diceSvg}';}else{this.style.display='none';}" />`
                  }
                </div>
              ` : ''}
            </div>
          `;
        }).join('')}
      </div>
      <div class="card-footer" style="display: flex; justify-content: space-between; align-items: center; height: 12mm; padding: 0 4mm 2mm 4mm; background: black; margin-top: auto;">
        <div class="card-title-container" style="display: flex; align-items: baseline; gap: 2mm; flex: 1; min-width: 0; overflow: hidden; padding-top: 3mm;">
          <span class="card-title" style="font-family: ${cardData.titleFont || "'Uncial Antiqua', serif"}; font-size: ${cardData.titleSize || 14}pt; text-transform: uppercase; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: white;">${cardData.title}</span>
          ${cardData.code ? `<span class="card-code" style="font-size: 10pt; opacity: 0.6; white-space: nowrap; font-family: sans-serif; font-weight: bold; text-transform: lowercase; color: white;">(${cardData.code})</span>` : ''}
        </div>
        <div class="card-difficulty" style="display: flex; gap: 1.5mm; margin-left: 2mm; flex-shrink: 0; align-items: center; padding-top: 3mm;">
          ${Array.from({ length: 6 }).map((_, i) => {
            const isActive = i >= (6 - cardData.difficulty);
            return `<div class="difficulty-dot" style="width: 3.2mm; height: 3.2mm; background-color: ${isActive ? 'white' : '#333333'}; border-radius: 50%; ${isActive ? 'box-shadow: 0 0 4px rgba(255, 255, 255, 0.6);' : ''}"></div>`;
          }).join('')}
        </div>
      </div>
    `;
    
    pageDiv.appendChild(cardDiv);
  }

  // Wait for all images to load
  const images = pageDiv.getElementsByTagName('img');
  await Promise.all(Array.from(images).map(img => {
    if (img.complete) return Promise.resolve();
    return new Promise(resolve => {
      img.onload = resolve;
      img.onerror = resolve;
    });
  }));

  // Capture the entire page at 300 DPI
  // 300 DPI = 11.81 pixels per mm
  // html2canvas scale: 300 / 96 = 3.125
  const canvas = await html2canvas(pageDiv, {
    scale: 3.125,
    useCORS: true,
    backgroundColor: '#ffffff',
    width: 210 * 3.7795, // mm to px approx
    height: 297 * 3.7795
  });

  const imgData = canvas.toDataURL('image/jpeg', 0.95);
  pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297);
}
