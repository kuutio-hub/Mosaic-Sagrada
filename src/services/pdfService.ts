import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { PatternQueueItem } from '../types';

export async function generatePDF(
  queue: PatternQueueItem[], 
  cornerRadius: number = 0,
  printerFriendly: boolean = false,
  printerOpacity: number = 1,
  showCropMarks: boolean = false
) {
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
    await renderBatchPage(pdf, batch, 'front', container, i > 0, cornerRadius, printerFriendly, printerOpacity, showCropMarks);
    const hasBacks = batch.some(item => item.isDoubleSided);
    if (hasBacks) {
      await renderBatchPage(pdf, batch, 'back', container, true, cornerRadius, printerFriendly, printerOpacity, showCropMarks);
    }
  }

  pdf.save('sagrada_cards.pdf');
  document.body.removeChild(container);
}

function generateCardHTML(
  cardData: any, 
  fontSize: number, 
  printerFriendly: boolean, 
  printerOpacity: number,
  showCropMarks: boolean
): string {
  const title = cardData.title || '';
  const dotColor = (color: string) => (color === 'W' || color === '.') ? '#000000' : '#ffffff';
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

    // In printer-friendly mode, cells are white, but colors/values remain.
    // If it's a color cell, we can show a subtle border or something, but the user said "mezők, cellák nem válotoznak, azok színesek"
    // Wait, "a kártya többi része fehér. felíratok és mezők, cellák nem válotoznak, azok színesek"
    // So the grid background is white, but the cells themselves keep their colors.
    
    return `
      <div class="card-cell" style="width: 15mm; height: 15mm; display: flex; align-items: center; justify-content: center; position: relative; box-sizing: border-box; background-color: ${isX ? '#f3f4f6' : '#ffffff'}; overflow: hidden; border: 0.2mm solid #000000;">
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

  // Auto-font size logic for title
  let finalFontSize = fontSize;
  const dotsWidth = 30; // approx width of 6 dots in mm
  const padding = 10; // 5mm left + 5mm right
  const availableWidth = 90 - padding - dotsWidth - 5; // 5mm buffer
  
  const estimatedTitleWidth = (title.length * finalFontSize * 0.45);
  if (estimatedTitleWidth > availableWidth) {
    finalFontSize = Math.max(6, Math.floor(availableWidth / (title.length * 0.45)));
  }

  const gridBg = printerFriendly ? '#ffffff' : '#000000';
  const footerBg = printerFriendly ? '#ffffff' : '#000000';
  const textColor = printerFriendly ? '#000000' : '#ffffff';
  const dotInactiveColor = printerFriendly ? '#e5e7eb' : '#333333';
  const dotActiveColor = printerFriendly ? '#000000' : '#ffffff';

  return `
    <div class="card-grid" style="display: grid; grid-template-columns: repeat(5, 15mm); grid-template-rows: repeat(4, 15mm); gap: 2.5mm; padding: 2.5mm; width: 90mm; height: 70mm; box-sizing: border-box; background: ${gridBg}; justify-content: center; align-content: start; opacity: ${printerFriendly ? printerOpacity : 1};">
      ${cellsHTML}
    </div>
    <div class="card-footer" style="position: absolute; bottom: 0; left: 0; right: 0; display: flex; justify-content: space-between; align-items: center; height: 10mm; padding: 0 5mm; background: ${footerBg}; box-sizing: border-box; z-index: 10; opacity: ${printerFriendly ? printerOpacity : 1}; border-top: ${printerFriendly ? '0.2mm solid #000000' : 'none'};">
      <div class="card-title-container" style="display: flex; align-items: center; gap: 2mm; flex: 1; min-width: 0; overflow: hidden; height: 100%; text-align: left;">
        <span class="card-title" style="font-family: ${cardData.titleFont || "'Uncial Antiqua', serif"}; font-size: ${finalFontSize}pt; text-transform: uppercase; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: ${textColor}; flex: 1; min-width: 0; display: flex; align-items: center; height: 100%;">${title}</span>
        ${cardData.code ? `<span class="card-code" style="font-size: 9pt; opacity: 0.6; white-space: nowrap; font-family: sans-serif; font-weight: bold; text-transform: lowercase; color: ${textColor}; flex-shrink: 0; display: flex; align-items: center; height: 100%;">(${cardData.code})</span>` : ''}
      </div>
      <div class="card-difficulty" style="display: flex; gap: 1.5mm; margin-left: 2mm; flex-shrink: 0; align-items: center; justify-content: flex-end; width: ${dotsWidth}mm; height: 100%;">
        ${Array.from({ length: 6 }).map((_, i) => {
          const isActive = i >= (6 - cardData.difficulty);
          const isGenerated = cardData.isGenerated && !isActive;
          let dotColor = isActive ? dotActiveColor : dotInactiveColor;
          if (isGenerated) dotColor = '#ffffff'; // White for generated dots
          
          return `<div class="difficulty-dot" style="width: 3mm; height: 3mm; background-color: ${dotColor}; border-radius: 50%; border: ${isGenerated ? '0.2mm solid #000000' : 'none'}; ${isActive && !printerFriendly ? 'box-shadow: 0 0 3px rgba(255, 255, 255, 0.5);' : ''}"></div>`;
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
  cornerRadius: number = 0,
  printerFriendly: boolean = false,
  printerOpacity: number = 1,
  showCropMarks: boolean = false
) {
  if (addNewPage) {
    pdf.addPage();
  }

  container.innerHTML = '';
  const pageDiv = document.createElement('div');
  pageDiv.className = 'print-page';
  pageDiv.style.position = 'relative';
  pageDiv.style.backgroundColor = '#ffffff';
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
    
    // In printer-friendly mode, the card background is white, but we need a black border.
    cardDiv.style.background = printerFriendly ? '#ffffff' : '#000000';
    if (printerFriendly) {
      cardDiv.style.border = '0.2mm solid #000000';
    }
    
    const col = side === 'front' ? (idx % 2) : (1 - (idx % 2));
    const row = Math.floor(idx / 2);
    
    // If crop marks are enabled, we widen the border slightly (2mm each side)
    const extra = showCropMarks ? 2 : 0;
    
    cardDiv.style.left = `${startX + col * cardW - extra}mm`;
    cardDiv.style.top = `${startY + row * cardH - extra}mm`;
    cardDiv.style.width = `${90 + extra * 2}mm`;
    cardDiv.style.height = `${80 + extra * 2}mm`;
    cardDiv.style.borderRadius = showCropMarks ? '0' : `${cornerRadius}mm`;
    cardDiv.style.overflow = 'hidden';
    cardDiv.style.boxSizing = 'border-box';
    
    // Add crop marks if enabled
    if (showCropMarks) {
      const marks = `
        <div style="position: absolute; top: 0; left: 2mm; right: 2mm; height: 0.1mm; background: #000; z-index: 100;"></div>
        <div style="position: absolute; bottom: 0; left: 2mm; right: 2mm; height: 0.1mm; background: #000; z-index: 100;"></div>
        <div style="position: absolute; top: 2mm; bottom: 2mm; left: 0; width: 0.1mm; background: #000; z-index: 100;"></div>
        <div style="position: absolute; top: 2mm; bottom: 2mm; right: 0; width: 0.1mm; background: #000; z-index: 100;"></div>
      `;
      cardDiv.innerHTML += marks;
    }
    
    const title = cardData.title || '';
    let fontSize = cardData.titleSize || 14;
    
    const innerCard = document.createElement('div');
    innerCard.style.position = 'absolute';
    innerCard.style.top = `${extra}mm`;
    innerCard.style.left = `${extra}mm`;
    innerCard.style.width = '90mm';
    innerCard.style.height = '80mm';
    innerCard.style.background = printerFriendly ? '#ffffff' : '#000000';
    innerCard.innerHTML = generateCardHTML(cardData, fontSize, printerFriendly, printerOpacity, showCropMarks);
    
    cardDiv.appendChild(innerCard);
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
    onclone: (clonedDoc) => {
      // Remove all style tags that might contain oklch
      const styles = clonedDoc.getElementsByTagName('style');
      for (let i = 0; i < styles.length; i++) {
        if (styles[i].innerHTML.includes('oklch')) {
          styles[i].remove();
        }
      }
      // Also check link tags
      const links = clonedDoc.getElementsByTagName('link');
      for (let i = 0; i < links.length; i++) {
        if (links[i].href.includes('tailwind')) {
          links[i].remove();
        }
      }
    }
  });

  const imgData = canvas.toDataURL('image/jpeg', 0.95);
  pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297);
}
