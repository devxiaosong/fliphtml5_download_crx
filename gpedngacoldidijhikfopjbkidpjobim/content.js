const __seenUrl = new Set();
const MIN_IMAGE_WIDTH = 550;

// Funzione per verificare la larghezza dell'immagine
function checkImageWidth(imgElement, src) {
  return new Promise((resolve) => {
    // Se l'immagine è già caricata, controlla subito
    if (imgElement.complete && imgElement.naturalWidth > 0) {
      resolve(imgElement.naturalWidth >= MIN_IMAGE_WIDTH);
      return;
    }
    
    // Altrimenti crea una nuova immagine per verificare
    const testImg = new Image();
    testImg.onload = () => {
      resolve(testImg.naturalWidth >= MIN_IMAGE_WIDTH);
    };
    testImg.onerror = () => {
      // In caso di errore, includi l'immagine (meglio includere che escludere)
      resolve(true);
    };
    testImg.src = src;
    
    // Timeout di sicurezza
    setTimeout(() => resolve(true), 2000);
  });
}

async function scanAllFlipbookPages(scanSpeed = 1000) {
  try { chrome.runtime.sendMessage({ action: 'scanningStatus', text: 'Scanning…' }); } catch(e) {}

  const images = [];
  let pageNumber = 1;
  let maxRepeats = 3;
  let repeatCount = 0;
  let lastImageSet = [];

  const flipbookBaseUrl = window.location.origin + window.location.pathname.replace(/\/[^\/]*$/, '/');

  while (repeatCount < maxRepeats) {
    // Controlla stopScan
    const stopScan = await new Promise(resolve => {
      chrome.storage.local.get('stopScan', data => {
        resolve(data.stopScan);
      });
    });
    if (stopScan) {
      console.log('Scan stopped by user');
      break;
    }

    // Comunica al popup la pagina attuale
    chrome.runtime.sendMessage({ action: "updateScanningStatus", page: pageNumber });

    window.location.hash = `#p=${pageNumber}`;
    console.log(`Navigating to page ${pageNumber}...`);

    // Usa la velocità parametrizzata
    await new Promise(r => setTimeout(r, scanSpeed));

    const pageImgs = document.querySelectorAll('div.side-image img');
    const currentImageSet = [];

    for (const img of pageImgs) {
      let src = img.getAttribute('src') || '';
      if (src.startsWith('./')) {
        src = flipbookBaseUrl + src.replace(/^\.\//, '');
      } else if (src.startsWith('/')) {
        src = window.location.origin + src;
      } else if (!/^https?:/i.test(src)) {
        src = flipbookBaseUrl + src;
      }

      currentImageSet.push(src);

      if (__seenUrl.has(src)) continue;

      // Verifica la larghezza dell'immagine
      const isValidSize = await checkImageWidth(img, src);
      if (!isValidSize) {
        console.log(`Skipping low-res image (< ${MIN_IMAGE_WIDTH}px): ${src}`);
        continue;
      }

      if (!images.includes(src)) {
        images.push(src);
        __seenUrl.add(src);
        try {
          chrome.runtime.sendMessage({
            action: 'pageImage',
            index: images.length - 1,
            dataUrl: src,
            srcUrl: src
          });
        } catch(e) {}
      }
    }

    if (arraysEqual(currentImageSet, lastImageSet)) {
      repeatCount++;
      console.log(`Repeated image set detected (${repeatCount}/${maxRepeats})`);
    } else {
      repeatCount = 0;
    }

    lastImageSet = currentImageSet;
    pageNumber++;
  }

  console.log('Scan finished. Total images:', images.length);
  chrome.runtime.sendMessage({ action: 'scanComplete' });

  // Rimuovi messaggio scanning alla fine
  chrome.runtime.sendMessage({ action: "removeScanningStatus" });

  return images;
}

function arraysEqual(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "scanFlipbook") {
    const scanSpeed = request.scanSpeed || 1000;
    scanAllFlipbookPages(scanSpeed).then(images => {
      sendResponse({ images });
    });
    return true;
  }
});
