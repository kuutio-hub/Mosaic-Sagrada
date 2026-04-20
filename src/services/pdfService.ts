import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

export async function generatePDF(
  queue: any[], 
  cornerRadius: number = 0,
  printerFriendly: boolean = false,
  printerOpacity: number = 1,
  showCropMarks: boolean = false,
  showBlackFrame: boolean = false,
  isDoubleSided: boolean = false
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

  const finalShowCropMarks = showBlackFrame ? true : showCropMarks;

  for (let i = 0; i < queue.length; i += (isDoubleSided ? 12 : 6)) {
    const batch = queue.slice(i, i + (isDoubleSided ? 12 : 6));
    
    // Front page
    const frontBatch = isDoubleSided ? batch.filter((_, idx) => idx % 2 === 0) : batch;
    if (frontBatch.length > 0) {
      await renderBatchPage(pdf, frontBatch, 'front', container, i > 0, cornerRadius, printerFriendly, printerOpacity, finalShowCropMarks, showBlackFrame);
    }
    
    // Back page
    if (isDoubleSided) {
      const backBatch = batch.filter((_, idx) => idx % 2 === 1);
      if (backBatch.length > 0) {
        await renderBatchPage(pdf, backBatch, 'back', container, true, cornerRadius, printerFriendly, printerOpacity, finalShowCropMarks, showBlackFrame);
      }
    }
  }

  const now = new Date();
  const timestamp = now.getFullYear().toString().slice(-2) + 
                   (now.getMonth() + 1).toString().padStart(2, '0') + 
                   now.getDate().toString().padStart(2, '0') + '_' + 
                   now.getHours().toString().padStart(2, '0') + 
                   now.getMinutes().toString().padStart(2, '0');
  const filename = `Sagrada_${timestamp}.pdf`;
  pdf.save(filename);
  document.body.removeChild(iframe);
}

function generateCardHTML(
  cardData: any, 
  printerFriendly: boolean, 
  printerOpacity: number,
  showCropMarks: boolean,
  showBlackFrame: boolean
) {
  const title = cardData.title || '';
  
  const footerBg = printerFriendly ? '#ffffff' : '#000000';
  const textColor = printerFriendly ? '#000000' : '#ffffff';
  const dotActiveColor = printerFriendly ? '#000000' : '#ffffff';
  const dotInactiveColor = printerFriendly ? '#e5e7eb' : '#333333';

  // Sizing adjustments to avoid footer overlap
  const gridGap = '2.5mm';
  const gridPadding = '2.5mm'; 

  // Apply opacity to colors/values if printer friendly
  const contentOpacity = printerFriendly ? printerOpacity : 1;

  // Crude font size adjustment for PDF
  const titleLength = title.length + (cardData.code ? cardData.code.length + 1 : 0);
  let fontSize = 11;
  if (titleLength > 20) fontSize = 10;
  if (titleLength > 25) fontSize = 9;
  if (titleLength > 30) fontSize = 8;
  if (titleLength > 35) fontSize = 7;

  return `
    <div style="width: 90mm; height: 80mm; position: relative; background: ${printerFriendly ? '#ffffff' : '#000000'}; color: white; display: flex; flex-direction: column; box-sizing: border-box; overflow: hidden; ${printerFriendly ? 'border: 0.1mm solid #d1d5db;' : ''} ${showBlackFrame ? 'border: 1mm solid #000000;' : ''}">
      <div class="card-grid" style="display: grid; grid-template-columns: repeat(5, 15mm); grid-template-rows: repeat(4, 15mm); gap: ${gridGap}; padding: ${gridPadding}; width: 90mm; margin: 0 auto; box-sizing: border-box; background: transparent;">
        ${cardData.cells.map((cell: any) => {
          const colorMap: Record<string, string> = {
            'R': '#ed1c24', 'G': '#00a651', 'B': '#0072bc', 'Y': '#fff200', 'P': '#662d91', 'W': '#ffffff', '.': '#ffffff'
          };
          const bgColor = colorMap[cell.color] || '#ffffff';
          const isX = cell.value === 'X';
          const hasValue = cell.value !== '.' && cell.value !== 'X';
          
          let valueImgSrc = '';
          let svgFallback = '';
          if (hasValue) {
            const isWhite = (cell.color === 'W' || cell.color === '.');
            const dotColor = isWhite ? '#111827' : '#ffffff';
            const dotSize = 8;
            const dots: Record<string, string> = {
              '1': `<circle cx="50" cy="50" r="${dotSize}" fill="${dotColor}" />`,
              '2': `<circle cx="30" cy="30" r="${dotSize}" fill="${dotColor}" /><circle cx="70" cy="70" r="${dotSize}" fill="${dotColor}" />`,
              '3': `<circle cx="30" cy="30" r="${dotSize}" fill="${dotColor}" /><circle cx="50" cy="50" r="${dotSize}" fill="${dotColor}" /><circle cx="70" cy="70" r="${dotSize}" fill="${dotColor}" />`,
              '4': `<circle cx="30" cy="30" r="${dotSize}" fill="${dotColor}" /><circle cx="70" cy="30" r="${dotSize}" fill="${dotColor}" /><circle cx="30" cy="70" r="${dotSize}" fill="${dotColor}" /><circle cx="70" cy="70" r="${dotSize}" fill="${dotColor}" />`,
              '5': `<circle cx="30" cy="30" r="${dotSize}" fill="${dotColor}" /><circle cx="70" cy="30" r="${dotSize}" fill="${dotColor}" /><circle cx="50" cy="50" r="${dotSize}" fill="${dotColor}" /><circle cx="30" cy="70" r="${dotSize}" fill="${dotColor}" /><circle cx="70" cy="70" r="${dotSize}" fill="${dotColor}" />`,
              '6': `<circle cx="30" cy="30" r="${dotSize}" fill="${dotColor}" /><circle cx="70" cy="30" r="${dotSize}" fill="${dotColor}" /><circle cx="30" cy="50" r="${dotSize}" fill="${dotColor}" /><circle cx="70" cy="50" r="${dotSize}" fill="${dotColor}" /><circle cx="30" cy="70" r="${dotSize}" fill="${dotColor}" /><circle cx="70" cy="70" r="${dotSize}" fill="${dotColor}" />`
            };
            const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect x="10" y="10" width="80" height="80" rx="12" fill="none" />${dots[cell.value] || ''}</svg>`;
            svgFallback = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
            valueImgSrc = `png/${cell.value}.png?v=0.1.4.5`;
          }

          return `
            <div class="card-cell" style="width: 15mm; height: 15mm; display: flex; align-items: center; justify-content: center; position: relative; box-sizing: border-box; background-color: ${isX ? (printerFriendly ? '#f9fafb' : '#1f2937') : '#ffffff'}; overflow: hidden; border: 0.2mm solid ${printerFriendly ? '#d1d5db' : '#374151'};">
              ${cell.color !== '.' && cell.color !== 'W' ? `
                <div style="position: absolute; inset: 0; background-color: ${bgColor}; opacity: ${cell.color === 'W' ? 1 : contentOpacity}; z-index: 2;"></div>
              ` : ''}
              ${cell.value !== '.' ? `
                <div style="display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; z-index: 3; opacity: ${contentOpacity};">
                  ${isX ? 
                    `<span style="font-family: 'Uncial Antiqua', serif; font-size: 32pt; color: ${printerFriendly ? '#9ca3af' : '#4b5563'}; opacity: 1; line-height: 1;">X</span>` : 
                    `<img src="${valueImgSrc}" onerror="this.onerror=null; if(this.src.includes('githubusercontent.com')){this.src='${svgFallback}';}else if(this.src.includes('/svg/')){this.src='https://raw.githubusercontent.com/kuutio-hub/Mosaic-Sagrada/main/public/png/${cell.value}.png';}else{this.src='svg/${cell.value}.svg?v=0.1.4.5';}" style="width: 100%; height: 100%; object-fit: cover;" />`
                  }
                </div>
              ` : ''}
            </div>
          `;
        }).join('')}
        ${printerFriendly && printerOpacity > 0 ? `<div style="position: absolute; inset: 0; background: white; opacity: ${0.8 * printerOpacity}; z-index: 5; pointer-events: none;"></div>` : ''}
      </div>
        <div class="card-footer" style="position: absolute; bottom: 0; left: 0; right: 0; display: flex; justify-content: space-between; align-items: center; height: 9.9mm; padding: 0 4mm 0 2.5mm; background: ${printerFriendly ? 'transparent' : footerBg}; box-sizing: border-box; z-index: 10; ${printerFriendly ? 'border-top: 0.3mm solid transparent;' : ''}; overflow: visible;">
          <div class="card-title-container" style="display: flex; align-items: center; gap: 2mm; flex: 1; min-width: 0; overflow: visible; height: 100%;">
            <span class="card-title" style="font-family: ${cardData.titleFont || "'Uncial Antiqua', serif"}; font-size: ${fontSize}pt; text-transform: uppercase; white-space: nowrap; overflow: visible; color: ${textColor}; flex: 1; min-width: 0; display: flex; align-items: center; justify-content: flex-start; height: 100%;">${title}${cardData.code ? ' ' + cardData.code : ''}</span>
          </div>
          <div class="card-difficulty" style="display: flex; gap: 1.5mm; margin-left: 2mm; flex-shrink: 0; align-items: center; justify-content: flex-end; height: 100%;">
          ${Array.from({ length: 6 }).map((_, i) => {
            const isActive = i >= (6 - cardData.difficulty);
            const isGenerated = cardData.isGenerated;
            let dotColor = isActive ? dotActiveColor : dotInactiveColor;
            let border = 'none';
            let opacity = 1;
            if (isGenerated) {
              if (isActive) { dotColor = printerFriendly ? '#000000' : '#ffffff'; opacity = 1; }
              else { dotColor = 'transparent'; border = `0.2mm solid ${printerFriendly ? '#000000' : '#ffffff'}`; opacity = 0.6; }
            }
            return `<div class="difficulty-dot" style="width: 2.5mm; height: 2.5mm; background-color: ${dotColor}; border-radius: 50%; border: ${border}; opacity: ${opacity};"></div>`;
          }).join('')}
        </div>
      </div>
    </div>
  `;
}

async function renderBatchPage(
  pdf: jsPDF, 
  batch: any[], 
  side: 'front' | 'back', 
  container: HTMLElement,
  addNewPage: boolean,
  cornerRadius: number = 0,
  printerFriendly: boolean = false,
  printerOpacity: number = 1,
  showCropMarks: boolean = false,
  showBlackFrame: boolean = false
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

  // Spacing
  const gapX = showCropMarks ? 10 : 2;
  const gapY = showCropMarks ? 10 : 2;
  const cardW = 90;
  const cardH = 80;
  const startX = (210 - (2 * cardW + gapX)) / 2;
  const startY = (297 - (3 * cardH + 2 * gapY)) / 2;

    for (let idx = 0; idx < batch.length; idx++) {
      const item = batch[idx];
      const cardData = item.card;
      
      const cardDiv = doc.createElement('div');
      cardDiv.className = 'card-wrapper';
      cardDiv.style.position = 'absolute';
      cardDiv.style.width = `90mm`;
      cardDiv.style.height = `80mm`;
      
      // Mirrored columns for duplex alignment
      const col = side === 'front' ? (idx % 2) : (1 - (idx % 2));
      const row = Math.floor(idx / 2);
      
      const cardX = startX + col * (cardW + gapX);
      const cardY = startY + row * (cardH + gapY);

      cardDiv.style.left = `${cardX}mm`;
      cardDiv.style.top = `${cardY}mm`;
      
      if (showCropMarks) {
        const markLen = 5; 
        const markColor = '#000000';
        const markThickness = '0.2mm';
        
        // Lines exactly at the extension of the card boundaries
        const marks = `
          <!-- Top Left -->
          <div style="position: absolute; top: ${-markLen}mm; left: 0; width: ${markThickness}; height: ${markLen}mm; background: ${markColor};"></div>
          <div style="position: absolute; top: 0; left: ${-markLen}mm; width: ${markLen}mm; height: ${markThickness}; background: ${markColor};"></div>
          <!-- Top Right -->
          <div style="position: absolute; top: ${-markLen}mm; left: ${cardW}mm; width: ${markThickness}; height: ${markLen}mm; background: ${markColor};"></div>
          <div style="position: absolute; top: 0; left: ${cardW}mm; width: ${markLen}mm; height: ${markThickness}; background: ${markColor};"></div>
          <!-- Bottom Left -->
          <div style="position: absolute; top: ${cardH}mm; left: 0; width: ${markThickness}; height: ${markLen}mm; background: ${markColor};"></div>
          <div style="position: absolute; top: ${cardH}mm; left: ${-markLen}mm; width: ${markLen}mm; height: ${markThickness}; background: ${markColor};"></div>
          <!-- Bottom Right -->
          <div style="position: absolute; top: ${cardH}mm; left: ${cardW}mm; width: ${markThickness}; height: ${markLen}mm; background: ${markColor};"></div>
          <div style="position: absolute; top: ${cardH}mm; left: ${cardW}mm; width: ${markLen}mm; height: ${markThickness}; background: ${markColor};"></div>
        `;
        cardDiv.innerHTML = marks;
      }
      
      const innerCardContainer = doc.createElement('div');
      innerCardContainer.style.position = 'absolute';
      innerCardContainer.style.top = '0';
      innerCardContainer.style.left = '0';
      innerCardContainer.style.width = '90mm';
      innerCardContainer.style.height = '80mm';
      innerCardContainer.style.overflow = 'hidden';
      innerCardContainer.style.borderRadius = showCropMarks ? '0' : `${cornerRadius}mm`;
      innerCardContainer.innerHTML = generateCardHTML(cardData, printerFriendly, printerOpacity, showCropMarks, showBlackFrame);
      
      cardDiv.appendChild(innerCardContainer);
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
