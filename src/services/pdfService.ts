import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { PatternQueueItem } from '../types';

export async function generatePDF(queue: PatternQueueItem[], cornerRadius: number = 0) {
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.top = '-10000px';
  container.style.left = '-10000px';
  container.style.width = '210mm';
  container.style.height = '297mm';
  container.style.background = 'white';
  document.body.appendChild(container);

  for (let i = 0; i < queue.length; i += 6) {
    const batch = queue.slice(i, i + 6);
    await renderBatchPage(pdf, batch, 'front', container, i > 0, cornerRadius);
    const hasBacks = batch.some(item => item.isDoubleSided);
    if (hasBacks) {
      await renderBatchPage(pdf, batch, 'back', container, true, cornerRadius);
    }
  }

  pdf.save('sagrada_cards.pdf');
  document.body.removeChild(container);
}

function generateCardHTML(cardData: any, fontSize: number): string {
  const title = cardData.title || '';
  const dotColor = (color: string) => (color === 'W' || color === '.') ? 'black' : 'white';
  const dots = {
    '1': [[50, 50]], '2': [[25, 25], [75, 75]], '3': [[25, 25], [50, 50], [75, 75]],
    '4': [[25, 25], [25, 75], [75, 25], [75, 75]], '5': [[25, 25], [25, 75], [50, 50], [75, 25], [75, 75]],
    '6': [[25, 25], [25, 50], [25, 75], [75, 25], [75, 50], [75, 75]]
  };

  const cellsHTML = cardData.cells.map((cell: any) => {
    const circles = (dots[cell.value as keyof typeof dots] || []).map(([cx, cy]: number[]) => 
      `<circle cx="${cx}" cy="${cy}" r="10" fill="${dotColor(cell.color)}" />`
    ).join('');
    const diceSvg = `data:image/svg+xml;base64,${btoa(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${circles}</svg>`)}`;

    const colorMap: Record<string, string> = {
      'R': '#ed1c24', 'G': '#00a651', 'B': '#0072bc', 'Y': '#fff200', 'P': '#662d91', 'W': '#ffffff', '.': '#ffffff'
    };
    const bgColor = colorMap[cell.color] || '#ffffff';
    const isX = cell.value === 'X';

    return `
      <div class="card-cell" style="width: 15mm; height: 15mm; display: flex; align-items: center; justify-content: center; position: relative; box-sizing: border-box; background-color: ${isX ? '#f3f4f6' : '#ffffff'}; overflow: hidden; border: 0.2mm solid black;">
        ${cell.color !== '.' ? `
          <div style="position: absolute; inset: 0; background-color: ${bgColor}; opacity: 1; z-index: 2;"></div>
        ` : ''}
        ${cell.value !== '.' ? `
          <div style="font-weight: bold; color: ${dotColor(cell.color)}; display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; z-index: 1;">
            ${isX ? 
              `<span style="font-family: 'Uncial Antiqua', serif; font-size: 32pt; color: #9ca3af; opacity: 1; line-height: 1;">X</span>` : 
              `<img src="/Cells/${cell.value}.png" style="width: 15.5mm; height: 15.5mm; object-fit: cover; margin: -0.25mm;" onerror="if(!this.src.includes('raw.githubusercontent.com') && !this.src.startsWith('data:image/svg+xml')){this.src='https://raw.githubusercontent.com/chardila/sagrada_generator/main/${cell.value}.png';}else if(!this.src.startsWith('data:image/svg+xml')){this.src='${diceSvg}';}else{this.style.display='none';}" />`
            }
          </div>
        ` : ''}
      </div>
    `;
  }).join('');

  return `
    <div class="card-grid" style="display: grid; grid-template-columns: repeat(5, 15mm); grid-template-rows: repeat(4, 15mm); gap: 2.5mm; padding: 2.5mm; width: 90mm; height: 70mm; box-sizing: border-box; background: transparent; justify-content: center; align-content: start;">
      ${cellsHTML}
    </div>
    <div class="card-footer" style="position: absolute; bottom: 0; left: 0; right: 0; display: flex; justify-content: space-between; align-items: center; height: 10mm; padding: 0 5mm; background: black; box-sizing: border-box; z-index: 10;">
      <div class="card-title-container" style="display: flex; align-items: center; gap: 2mm; flex: 1; min-width: 0; overflow: hidden; height: 100%;">
        <span class="card-title" style="font-family: ${cardData.titleFont || "'Uncial Antiqua', serif"}; font-size: ${fontSize}pt; text-transform: uppercase; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: white; line-height: 10mm; flex: 1; min-width: 0; display: block;">${title}</span>
        ${cardData.code ? `<span class="card-code" style="font-size: 9pt; opacity: 0.6; white-space: nowrap; font-family: sans-serif; font-weight: bold; text-transform: lowercase; color: white; flex-shrink: 0; line-height: 10mm;">(${cardData.code})</span>` : ''}
      </div>
      <div class="card-difficulty" style="display: flex; gap: 1.5mm; margin-left: 2mm; flex-shrink: 0; align-items: center; justify-content: center; height: 10mm;">
        ${Array.from({ length: 6 }).map((_, i) => {
          const isActive = i >= (6 - cardData.difficulty);
          return `<div class="difficulty-dot" style="width: 3mm; height: 3mm; background-color: ${isActive ? 'white' : '#333333'}; border-radius: 50%; ${isActive ? 'box-shadow: 0 0 3px rgba(255, 255, 255, 0.5);' : ''}"></div>`;
        }).join('')}
      </div>
    </div>
  `;
}

async function renderBatchPage(
  pdf: jsPDF, 
  batch: PatternQueueItem[], 
  side: 'front' | 'back', 
  container: HTMLElement,
  addNewPage: boolean,
  cornerRadius: number = 0
) {
  if (addNewPage) {
    pdf.addPage();
  }

  container.innerHTML = '';
  const pageDiv = document.createElement('div');
  pageDiv.className = 'print-page';
  pageDiv.style.position = 'relative';
  container.appendChild(pageDiv);

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
    cardDiv.style.display = 'flex';
    cardDiv.style.flexDirection = 'column';
    cardDiv.style.background = 'black';
    
    const col = side === 'front' ? (idx % 2) : (1 - (idx % 2));
    const row = Math.floor(idx / 2);
    
    cardDiv.style.left = `${startX + col * cardW}mm`;
    cardDiv.style.top = `${startY + row * cardH}mm`;
    cardDiv.style.width = '90mm';
    cardDiv.style.height = '80mm';
    cardDiv.style.borderRadius = `${cornerRadius}mm`;
    cardDiv.style.overflow = 'hidden';
    cardDiv.style.boxSizing = 'border-box';
    
    const title = cardData.title || '';
    let fontSize = cardData.titleSize || 14;
    if (title.length > 20) fontSize = 12;
    if (title.length > 25) fontSize = 10;
    
    cardDiv.innerHTML = generateCardHTML(cardData, fontSize);
    
    pageDiv.appendChild(cardDiv);
  }

  const images = pageDiv.getElementsByTagName('img');
  await Promise.all(Array.from(images).map(img => {
    if (img.complete) return Promise.resolve();
    return new Promise(resolve => {
      img.onload = resolve;
      img.onerror = resolve;
    });
  }));

  const canvas = await html2canvas(pageDiv, {
    scale: 3.125,
    useCORS: true,
    backgroundColor: '#ffffff',
    width: 210 * 3.7795,
    height: 297 * 3.7795,
    ignoreElements: (element) => {
      return element.tagName === 'STYLE' && element.innerHTML.includes('oklch');
    }
  });

  const imgData = canvas.toDataURL('image/jpeg', 0.95);
  pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297);
}
