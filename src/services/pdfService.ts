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

  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.top = '-10000px';
  iframe.style.left = '-10000px';
  iframe.style.width = '210mm';
  iframe.style.height = '297mm';
  document.body.appendChild(iframe);

  const iframeDoc = iframe.contentWindow?.document;
  if (!iframeDoc) {
    document.body.removeChild(iframe);
    throw new Error("Could not create iframe document");
  }

  iframeDoc.open();
  iframeDoc.write('<html><head><style>@import url("https://fonts.googleapis.com/css2?family=Uncial+Antiqua&display=swap");</style></head><body style="margin:0;padding:0;background:#ffffff;color:#000000;"></body></html>');
  iframeDoc.close();

  const container = iframeDoc.createElement('div');
  container.style.width = '210mm';
  container.style.height = '297mm';
  container.style.background = '#ffffff';
  iframeDoc.body.appendChild(container);

  for (let i = 0; i < queue.length; i += 6) {
    const batch = queue.slice(i, i + 6);
    await renderBatchPage(pdf, batch, 'front', container, i > 0, cornerRadius, printerFriendly, printerOpacity, showCropMarks);
    const hasBacks = batch.some(item => item.isDoubleSided);
    if (hasBacks) {
      await renderBatchPage(pdf, batch, 'back', container, true, cornerRadius, printerFriendly, printerOpacity, showCropMarks);
    }
  }

  pdf.save('sagrada_cards.pdf');
  document.body.removeChild(iframe);
}

function generateCardHTML(
  cardData: any, 
  fontSize: number, 
  printerFriendly: boolean, 
  printerOpacity: number,
  showCropMarks: boolean
): string {
  const title = cardData.title || '';
  const dotColor = (color: string) => (color === 'W' || color === '.') ? '#333333' : '#ffffff';
  
  const finalFontSize = fontSize;
  const footerBg = printerFriendly ? '#ffffff' : '#000000';
  const textColor = printerFriendly ? '#000000' : '#ffffff';
  const dotActiveColor = printerFriendly ? '#000000' : '#ffffff';
  const dotInactiveColor = printerFriendly ? '#e5e7eb' : '#333333';
  const dotsWidth = 6 * 2.5 + 5 * 1.5;

  const cellsHTML = `
    <div class="card-grid" style="display: grid; grid-template-columns: repeat(5, 15mm); grid-template-rows: repeat(4, 15mm); gap: 2.5mm; padding: 2.5mm 2.5mm 0 2.5mm; width: fit-content; margin: 0 auto;">
      ${cardData.cells.map((cell: any) => {
        const colorMap: Record<string, string> = {
          'R': '#ed1c24', 'G': '#00a651', 'B': '#0072bc', 'Y': '#fff200', 'P': '#662d91', 'W': '#ffffff', '.': '#ffffff'
        };
        const bgColor = colorMap[cell.color] || '#ffffff';
        const isX = cell.value === 'X';
        const hasValue = cell.value !== '.' && cell.value !== 'X';
        
        let valueImgSrc = '';
        if (hasValue) {
          const dotColor = (cell.color === 'W' || cell.color === '.') ? '#333333' : '#ffffff';
          const dotSize = 12;
          const dots: Record<string, string> = {
            '1': `<circle cx="50" cy="50" r="${dotSize}" fill="${dotColor}" />`,
            '2': `<circle cx="25" cy="25" r="${dotSize}" fill="${dotColor}" /><circle cx="75" cy="75" r="${dotSize}" fill="${dotColor}" />`,
            '3': `<circle cx="25" cy="25" r="${dotSize}" fill="${dotColor}" /><circle cx="50" cy="50" r="${dotSize}" fill="${dotColor}" /><circle cx="75" cy="75" r="${dotSize}" fill="${dotColor}" />`,
            '4': `<circle cx="25" cy="25" r="${dotSize}" fill="${dotColor}" /><circle cx="75" cy="25" r="${dotSize}" fill="${dotColor}" /><circle cx="25" cy="75" r="${dotSize}" fill="${dotColor}" /><circle cx="75" cy="75" r="${dotSize}" fill="${dotColor}" />`,
            '5': `<circle cx="25" cy="25" r="${dotSize}" fill="${dotColor}" /><circle cx="75" cy="25" r="${dotSize}" fill="${dotColor}" /><circle cx="50" cy="50" r="${dotSize}" fill="${dotColor}" /><circle cx="25" cy="75" r="${dotSize}" fill="${dotColor}" /><circle cx="75" cy="75" r="${dotSize}" fill="${dotColor}" />`,
            '6': `<circle cx="25" cy="25" r="${dotSize}" fill="${dotColor}" /><circle cx="75" cy="25" r="${dotSize}" fill="${dotColor}" /><circle cx="25" cy="50" r="${dotSize}" fill="${dotColor}" /><circle cx="75" cy="50" r="${dotSize}" fill="${dotColor}" /><circle cx="25" cy="75" r="${dotSize}" fill="${dotColor}" /><circle cx="75" cy="75" r="${dotSize}" fill="${dotColor}" />`
          };
          valueImgSrc = `data:image/svg+xml;base64,${btoa(`
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
              <rect x="5" y="5" width="90" height="90" rx="15" ry="15" fill="none" stroke="${dotColor}" stroke-width="5" />
              ${dots[cell.value] || ''}
            </svg>
          `)}`;
        }

        return `
          <div class="card-cell" style="width: 15mm; height: 15mm; display: flex; align-items: center; justify-content: center; position: relative; box-sizing: border-box; background-color: ${isX ? '#f3f4f6' : '#ffffff'}; overflow: hidden; border: 0.2mm solid #000000;">
            ${cell.color !== '.' && cell.color !== 'W' ? `
              <div style="position: absolute; inset: 0; background-color: ${bgColor}; opacity: 1; z-index: 2;"></div>
            ` : ''}
            ${cell.value !== '.' ? `
              <div style="font-weight: bold; color: ${dotColor(cell.color)}; display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; z-index: 3;">
                ${isX ? 
                  `<span style="font-family: 'Uncial Antiqua', serif; font-size: 32pt; color: #9ca3af; opacity: 1; line-height: 1;">X</span>` : 
                  `<img src="${valueImgSrc}" style="width: 100%; height: 100%; object-fit: cover;" />`
                }
              </div>
            ` : ''}
          </div>
        `;
      }).join('')}
    </div>
  `;

  return `
    <div style="width: 90mm; height: 80mm; position: relative; background: ${printerFriendly ? '#ffffff' : '#000000'}; color: white; display: flex; flex-direction: column; box-sizing: border-box; overflow: hidden; ${printerFriendly ? 'border: 0.4mm solid #000000;' : ''}">
      ${cellsHTML}
      <div class="card-footer" style="position: absolute; bottom: 0; left: 0; right: 0; display: flex; justify-content: space-between; align-items: center; height: 10.2mm; padding: 0 2.5mm; background: ${footerBg}; box-sizing: border-box; z-index: 10; opacity: ${printerFriendly ? printerOpacity : 1}; border-top: none;">
        <div class="card-title-container" style="display: flex; align-items: center; gap: 2mm; flex: 1; min-width: 0; overflow: hidden; height: 100%; text-align: left; padding-top: 2.5mm;">
          <span class="card-title" style="font-family: ${cardData.titleFont || "'Uncial Antiqua', serif"}; font-size: 12pt; text-transform: uppercase; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: ${textColor}; flex: 1; min-width: 0; display: flex; align-items: center; height: 100%; padding-top: 0.5mm;">${title}${cardData.code ? ' ' + cardData.code : ''}</span>
        </div>
        <div class="card-difficulty" style="display: flex; gap: 1.5mm; margin-left: 2mm; flex-shrink: 0; align-items: center; justify-content: flex-end; width: ${dotsWidth}mm; height: 100%;">
          ${Array.from({ length: 6 }).map((_, i) => {
            const isActive = i >= (6 - cardData.difficulty);
            const isGenerated = cardData.isGenerated;
            
            let dotColor = isActive ? dotActiveColor : dotInactiveColor;
            let border = 'none';
            let opacity = 1;

            if (isGenerated) {
              if (isActive) {
                dotColor = '#ffffff';
                opacity = 1;
              } else {
                dotColor = 'transparent';
                border = '0.2mm solid #ffffff';
                opacity = 0.8;
              }
            }
            
            return `<div class="difficulty-dot" style="width: 2.5mm; height: 2.5mm; background-color: ${dotColor}; border-radius: 50%; border: ${border}; opacity: ${opacity}; ${isActive && !printerFriendly && !isGenerated ? 'box-shadow: 0 0 3px rgba(255, 255, 255, 0.5);' : ''}"></div>`;
          }).join('')}
        </div>
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

  const doc = container.ownerDocument;
  container.innerHTML = '';
  const pageDiv = doc.createElement('div');
  pageDiv.className = 'print-page';
  pageDiv.style.position = 'relative';
  pageDiv.style.backgroundColor = '#ffffff';
  pageDiv.style.width = '210mm';
  pageDiv.style.height = '297mm';
  container.appendChild(pageDiv);

  const gapX = showCropMarks ? 15 : 5;
  const gapY = showCropMarks ? 15 : 5;
  const cardW = 90;
  const cardH = 80;
  const startX = (210 - (2 * cardW + gapX)) / 2;
  const startY = (297 - (3 * cardH + 2 * gapY)) / 2;

  for (let idx = 0; idx < batch.length; idx++) {
    const item = batch[idx];
    const cardData = side === 'front' ? item.front : (item.back || item.front);
    
    const cardDiv = doc.createElement('div');
    cardDiv.className = 'card-container';
    cardDiv.style.position = 'absolute';
    cardDiv.style.display = 'flex';
    cardDiv.style.flexDirection = 'column';
    
    cardDiv.style.background = printerFriendly ? '#ffffff' : '#000000';
    
    const col = side === 'front' ? (idx % 2) : (1 - (idx % 2));
    const row = Math.floor(idx / 2);
    
    cardDiv.style.left = `${startX + col * (cardW + gapX)}mm`;
    cardDiv.style.top = `${startY + row * (cardH + gapY)}mm`;
    cardDiv.style.width = `90mm`;
    cardDiv.style.height = `80mm`;
    cardDiv.style.borderRadius = showCropMarks ? '0' : `${cornerRadius}mm`;
    cardDiv.style.overflow = 'visible'; // Allow crop marks to be seen outside if needed
    cardDiv.style.boxSizing = 'border-box';
    
    // Add crop marks if enabled
    if (showCropMarks) {
      const markLen = 5; // mm
      const markOffset = 1; // mm
      const markThickness = '0.3mm';
      const x = startX + col * cardW;
      const y = startY + row * cardH;
      
      const marks = `
        <!-- Top Left -->
        <div style="position: absolute; top: ${y - markOffset - markLen}mm; left: ${x}mm; width: ${markThickness}; height: ${markLen}mm; background: #000; z-index: 100;"></div>
        <div style="position: absolute; top: ${y}mm; left: ${x - markOffset - markLen}mm; width: ${markLen}mm; height: ${markThickness}; background: #000; z-index: 100;"></div>
        
        <!-- Top Right -->
        <div style="position: absolute; top: ${y - markOffset - markLen}mm; left: ${x + cardW}mm; width: ${markThickness}; height: ${markLen}mm; background: #000; z-index: 100;"></div>
        <div style="position: absolute; top: ${y}mm; left: ${x + cardW + markOffset}mm; width: ${markLen}mm; height: ${markThickness}; background: #000; z-index: 100;"></div>
        
        <!-- Bottom Left -->
        <div style="position: absolute; top: ${y + cardH + markOffset}mm; left: ${x}mm; width: ${markThickness}; height: ${markLen}mm; background: #000; z-index: 100;"></div>
        <div style="position: absolute; top: ${y + cardH}mm; left: ${x - markOffset - markLen}mm; width: ${markLen}mm; height: ${markThickness}; background: #000; z-index: 100;"></div>
        
        <!-- Bottom Right -->
        <div style="position: absolute; top: ${y + cardH + markOffset}mm; left: ${x + cardW}mm; width: ${markThickness}; height: ${markLen}mm; background: #000; z-index: 100;"></div>
        <div style="position: absolute; top: ${y + cardH}mm; left: ${x + cardW + markOffset}mm; width: ${markLen}mm; height: ${markThickness}; background: #000; z-index: 100;"></div>
      `;
      pageDiv.innerHTML += marks;
    }
    
    const innerCard = doc.createElement('div');
    innerCard.style.position = 'absolute';
    innerCard.style.top = '0';
    innerCard.style.left = '0';
    innerCard.style.width = '90mm';
    innerCard.style.height = '80mm';
    innerCard.style.background = printerFriendly ? '#ffffff' : '#000000';
    innerCard.innerHTML = generateCardHTML(cardData, cardData.titleSize || 14, printerFriendly, printerOpacity, showCropMarks);
    
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
    scale: 3,
    useCORS: true,
    backgroundColor: '#ffffff'
  });

  const imgData = canvas.toDataURL('image/jpeg', 0.95);
  pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297);
}
