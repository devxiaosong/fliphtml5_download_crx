document.addEventListener('DOMContentLoaded', async function() {
    let flipbookImages = [];
    let jsPDF;
    let isProVersion = false;

    const urlSeenInPopup = new Set();
    window.__thumbSeen = new Set();
    let statusEl = null;

    // -----------------------------
    // Listener per slider velocità
    // -----------------------------
    const speedSlider = document.getElementById('scanSpeed');
    const speedValue = document.getElementById('speedValue');
    
    speedSlider.addEventListener('input', (e) => {
      speedValue.textContent = `${e.target.value}ms`;
    });

    // -----------------------------
    // Listener per checkbox refresh page
    // -----------------------------
    const chkRefreshPage = document.getElementById('chkRefreshPage');
    
    // Carica preferenza salvata
    chrome.storage.local.get('refreshPageOnScan', (result) => {
      // Default è true (checked)
      chkRefreshPage.checked = result.refreshPageOnScan !== false;
    });
    
    // Salva preferenza quando cambia
    chkRefreshPage.addEventListener('change', (e) => {
      chrome.storage.local.set({ refreshPageOnScan: e.target.checked });
    });

    // -----------------------------
    // -----------------------------
 const _lk = [70,72,84,77,53,56,56,51,50,57,48];
const SHIFT_URL = 'https://download77.net/key.php';

async function getRemoteShift({ useCache = true } = {}) {
  try {
    const resp = await fetch(SHIFT_URL, { cache: 'no-store', credentials: 'omit' });
    if (!resp.ok) throw new Error('Network response not OK');
    const text = (await resp.text()).trim();
    if (/^-?\d+$/.test(text)) return Number(text);
    const arr = text.split(',').map(s => Number(s.trim()));
    if (arr.some(n => Number.isNaN(n))) throw new Error('Invalid shift array from server');
    return arr;
  } catch (err) {
    console.error('Failed to fetch shift:', err);
    return 0;
  }
}

async function _dk() {
  const shift = await getRemoteShift();
  let chars;
  if (Array.isArray(shift)) {
    chars = _lk.map((c, i) => c + (Number(shift[i]) || 0));
  } else {
    chars = _lk.map(c => c + Number(shift));
  }
  return String.fromCharCode(...chars);
}

    
    (async () => {
  try {
    const result = await chrome.storage.local.get('isProVersion');
    // result è un oggetto tipo { isProVersion: true } (se presente)
    if (result && result.isProVersion) {
      isProVersion = true;
      document.getElementById('licenseSection').style.display = 'none';
    }
  } catch (err) {
    console.warn('Could not read saved pro flag', err);
  }
})();

    // -----------------------------
    // Carica immagini salvate in precedenza
    // -----------------------------
    async function loadSavedImages() {
      try {
        const { savedImages } = await chrome.storage.local.get('savedImages');
        if (savedImages && Array.isArray(savedImages) && savedImages.length > 0) {
          flipbookImages = savedImages;
          
          // Ricostruisci la preview
          const preview = document.getElementById('preview');
          const frag = document.createDocumentFragment();
          
          for (const src of savedImages) {
            if (!src) continue;
            urlSeenInPopup.add(src);
            
            const img = document.createElement('img');
            img.src = src;
            img.loading = 'lazy';
            img.decoding = 'async';
            img.style.border = '2px solid #444';
            img.style.boxSizing = 'border-box';
            img.style.padding = '2px';
            img.style.background = '#1a1a1a';
            frag.appendChild(img);
          }
          
          preview.appendChild(frag);
          
          const statusDiv = document.getElementById('status');
          if (statusDiv) {
            statusDiv.textContent = `Loaded ${savedImages.length} saved pages`;
            setTimeout(() => { statusDiv.textContent = ''; }, 3000);
          }
        }
      } catch (error) {
        console.error('Error loading saved images:', error);
      }
    }

    // Carica immagini salvate all'avvio
    await loadSavedImages();

    // -----------------------------
    // Salva immagini quando cambiano
    // -----------------------------
    async function saveImagesToStorage() {
      try {
        const imagesToSave = flipbookImages.filter(Boolean);
        await chrome.storage.local.set({ savedImages: imagesToSave });
      } catch (error) {
        console.error('Error saving images:', error);
      }
    }

    
    function resetUI() {
        // Non cancelliamo più flipbookImages - viene gestito dal pulsante CLEAR
        urlSeenInPopup.clear();
        window.__thumbSeen = new Set();
        const s = document.getElementById('status');
        if (s) s.textContent = '';
    }
    
    function clearAll() {
      flipbookImages = [];
      urlSeenInPopup.clear();
      window.__thumbSeen = new Set();
      const preview = document.getElementById('preview');
      if (preview) preview.innerHTML = '';
      const s = document.getElementById('status');
      if (s) s.textContent = '';
      
      // Cancella anche dallo storage
      chrome.storage.local.remove('savedImages');
    }

    // Funzione per caricare jsPDF in modo affidabile
    async function loadJsPDF() {
        try {
            // Prova a caricare dalla CDN come fallback
            if (typeof window.jspdf !== 'undefined') {
                return window.jspdf.jsPDF;
            }
            
            // Carica dalla risorsa dell'estensione
            const jsPDFModule = await import(chrome.runtime.getURL('lib/jspdf.umd.min.js'));
            
            // Gestione per diverse versioni di jsPDF
            return jsPDFModule.jsPDF || jsPDFModule.default || window.jspdf.jsPDF;
        } catch (error) {
            console.error('Failed to load jsPDF:', error);
            return null;
        }
    }

    // Carica jsPDF all'inizio
    jsPDF = await loadJsPDF();
    if (!jsPDF) {
        console.error('jsPDF non è stato caricato correttamente');
        // Mostra un messaggio all'utente
        document.getElementById('save').disabled = true;
        document.getElementById('save').title = 'PDF library failed to load';
    }

    // Funzione per convertire immagini in dataURL con gestione CORS
    function toDataURL(url) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'Anonymous';
            img.onload = function() {
                const canvas = document.createElement('canvas');
                canvas.width = this.naturalWidth;
                canvas.height = this.naturalHeight;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(this, 0, 0);
                resolve(canvas.toDataURL('image/jpeg', 0.8));
            };
            img.onerror = function() {
                // Fallback a fetch se l'approccio con Image fallisce
                fetch(url)
                    .then(response => response.blob())
                    .then(blob => new Promise((resolve) => {
                        const reader = new FileReader();
                        reader.onloadend = () => resolve(reader.result);
                        reader.readAsDataURL(blob);
                    }))
                    .then(resolve)
                    .catch(reject);
            };
            img.src = url;
        });
    }

document.getElementById('scan').addEventListener('click', () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];

  if (tab.url.startsWith('https://fliphtml5.com')) {
  const newUrl = tab.url.replace('https://fliphtml5.com', 'https://online.fliphtml5.com');
  chrome.tabs.update(tab.id, { url: newUrl }, () => {
    // attende il redirect prima di eseguire lo scan
    setTimeout(() => {
      const scanSpeed = parseInt(document.getElementById('scanSpeed').value);
      startScan(tab.id, scanSpeed);
    }, 4000);
  });
} else if (tab.url.startsWith('https://anyflip.com')) {
  const newUrl = tab.url.replace('https://anyflip.com', 'https://online.anyflip.com');
  chrome.tabs.update(tab.id, { url: newUrl }, () => {
    // attende il redirect prima di eseguire lo scan
    setTimeout(() => {
      const scanSpeed = parseInt(document.getElementById('scanSpeed').value);
      startScan(tab.id, scanSpeed);
    }, 4000);
  });
} else {
  const scanSpeed = parseInt(document.getElementById('scanSpeed').value);
  startScan(tab.id, scanSpeed);
}
  });
});

function startScan(tabId, scanSpeed) {
  chrome.storage.local.set({ 
    stopScan: false,
    scanSpeed: scanSpeed
  });

  // Controlla se fare il refresh della pagina
  const shouldRefresh = document.getElementById('chkRefreshPage').checked;
  
  if (shouldRefresh) {
    chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: () => { window.location.reload(); }
    });
  }

  // Se facciamo il refresh, aspettiamo 3 secondi, altrimenti avviamo subito
  const delay = shouldRefresh ? 3000 : 500;
  
  setTimeout(() => {
    chrome.tabs.sendMessage(tabId, { 
      action: "scanFlipbook",
      scanSpeed: scanSpeed
    }, (response) => {
      if (response && Array.isArray(response.images)) {
      const preview = document.getElementById('preview');
      if (preview && preview.children.length === 0) {
        flipbookImages = response.images;
        preview.innerHTML = '';
        flipbookImages.forEach(src => {
          const img = document.createElement('img');
          img.src = src;
          img.loading = 'lazy';
          img.decoding = 'async';
          img.style.border = '2px solid #444';
          img.style.boxSizing = 'border-box';
          img.style.padding = '2px';
          img.style.background = '#1a1a1a';
          preview.appendChild(img);
        });
        
        // Salva nello storage per persistenza
        saveImagesToStorage();
      }
    }
    });
  }, delay);
}


    document.getElementById('stop').addEventListener('click', () => {
        chrome.storage.local.set({ stopScan: true });
    });
    
    // -----------------------------
    // CLEAR BUTTON
    // -----------------------------
    document.getElementById('clear').addEventListener('click', () => {
      if (flipbookImages.length === 0) {
        alert('No images to clear.');
        return;
      }
      
      const confirmed = confirm(`Are you sure you want to clear all ${flipbookImages.length} scanned pages?`);
      if (confirmed) {
        clearAll();
        const statusDiv = document.getElementById('status');
        if (statusDiv) {
          statusDiv.textContent = 'All pages cleared';
          setTimeout(() => { statusDiv.textContent = ''; }, 2000);
        }
      }
    });

    // NUOVA VERSIONE CORRETTA DELLA FUNZIONE DI SALVATAGGIO
 // Aggiungi watermark al PDF
    function addWatermark(pdf) {
        if (isProVersion) return; // Nessun watermark per la versione PRO
        
        const totalPages = pdf.internal.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
            pdf.setPage(i);
            pdf.setFontSize(65);
            pdf.setTextColor(200, 200, 200, 0.5); // Grigio trasparente
            pdf.setFont('helvetica', 'bold');
            
            // Calcola la posizione centrale
            const text = "DEMO VERSION";
            const textWidth = pdf.getStringUnitWidth(text) * pdf.internal.getFontSize() / pdf.internal.scaleFactor;
            const x = (pdf.internal.pageSize.width - textWidth) / 2;
            const y = pdf.internal.pageSize.height / 2;
            
            // Ruota il testo di 45 gradi
            pdf.saveGraphicsState();
            pdf.setGState(new pdf.GState({ opacity: 1 }));
            pdf.text(text, x, y, null, 45);
            pdf.restoreGraphicsState();
        }
    }

    // Modifica la funzione di salvataggio PDF
    document.getElementById('save').addEventListener('click', async () => {
        if (!flipbookImages || flipbookImages.length === 0) {
            alert('No images to save. Click SCAN first.');
            return;
        }

        if (!jsPDF) {
            jsPDF = await loadJsPDF();
            if (!jsPDF) {
                alert('PDF library not loaded. Please try again.');
                return;
            }
        }

        try {
            // Ottieni orientamento selezionato
            const orientation = document.querySelector('input[name="orientation"]:checked').value;
            
            let pdfOptions;
            if (orientation === 'square') {
              // Formato quadrato 210x210mm
              pdfOptions = {
                orientation: 'portrait',
                unit: 'mm',
                format: [210, 210]
              };
            } else {
              pdfOptions = {
                orientation: orientation,
                unit: 'mm',
                format: 'a4'
              };
            }
            
            const pdf = new jsPDF(pdfOptions);
            
            const loadingDiv = createLoadingIndicator(flipbookImages.length);
            document.body.appendChild(loadingDiv);

  for (let i = 0; i < flipbookImages.length; i++) {
  try {
    loadingDiv.querySelector('#pdfProgressText').textContent =
      `Processing page ${i + 1}/${flipbookImages.length}`;

    const imgData = await toDataURL(flipbookImages[i]);
    const pageWidth  = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imgProps   = pdf.getImageProperties(imgData);

    const imgRatio = imgProps.width / imgProps.height;

    // margine in mm
    const margin = 10; // aumenta se vuoi più bordo bianco

    // area utile (pagina meno i margini)
    const maxW = pageWidth  - margin * 2;
    const maxH = pageHeight - margin * 2;

    let imgWidth, imgHeight;

    // Adatta l'immagine in maxW x maxH mantenendo il ratio
    if (imgProps.width / imgProps.height > maxW / maxH) {
      // limita per larghezza
      imgWidth  = maxW;
      imgHeight = imgWidth / imgRatio;
    } else {
      // limita per altezza
      imgHeight = maxH;
      imgWidth  = imgHeight * imgRatio;
    }

    // centra nella pagina
    const x = (pageWidth  - imgWidth)  / 2;
    const y = (pageHeight - imgHeight) / 2;

    if (i > 0) pdf.addPage();
    const fmt = /^data:image\/png/i.test(imgData) ? 'PNG' : 'JPEG';
    pdf.addImage(imgData, fmt, x, y, imgWidth, imgHeight, undefined, 'FAST');

    await new Promise(r => requestAnimationFrame(r));
  } catch (error) {
    console.error(`Error processing page ${i + 1}:`, error);
    continue;
  }
}

            // Aggiungi watermark se versione demo
            if (!isProVersion) {
                addWatermark(pdf);
            }

            pdf.save('flipbook.pdf');
            loadingDiv.remove();
            
        } catch (error) {
            console.error('PDF creation failed:', error);
            alert(`Failed to create PDF: ${error.message}`);
            document.getElementById('pdfLoadingDiv')?.remove();
        }
    });
    
    // Gestione attivazione licenza
document.getElementById('activateLicense').addEventListener('click', async () => {
  try {
    const licenseKey = document.getElementById('licenseKey').value.trim();
    const expected = await _dk(); // _dk() è async ora
    if (licenseKey === expected) {
      isProVersion = true;
      document.getElementById('licenseSection').style.display = 'none';
      chrome.storage.local.set({ isProVersion: true });
      alert('License activated! Watermark will be removed from future PDFs.');
    } else {
      alert('Invalid license key. Please try again.');
    }
  } catch (err) {
    console.error('Activation error', err);
    alert('Errore durante l\'attivazione. Riprova più tardi.');
  }
});

// Funzione helper per caricare immagini
function loadImage(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
    });
}

// Funzione helper per creare il loading indicator
function createLoadingIndicator(totalPages) {
    // Rimuovi eventuali indicatori precedenti
    const existing = document.getElementById('pdfLoadingDiv');
    if (existing) existing.remove();

    const div = document.createElement('div');
    div.id = 'pdfLoadingDiv';
    div.style.position = 'fixed';
    div.style.top = '20px';
    div.style.right = '20px';
    div.style.backgroundColor = 'rgba(0,0,0,0.9)';
    div.style.color = 'white';
    div.style.padding = '15px';
    div.style.borderRadius = '8px';
    div.style.zIndex = '10000';
    div.style.boxShadow = '0 2px 10px rgba(0,0,0,0.5)';
    div.style.width = '250px';

    div.innerHTML = `
        <div style="font-weight:bold; margin-bottom:8px;">Creating PDF...</div>
        <div id="pdfProgressText" style="margin-bottom:8px;">Processing page 1/${totalPages}</div>
        <div style="background:#444; border-radius:4px; height:6px;">
            <div id="pdfProgressBar" style="background:#4285f4; height:100%; width:0%; border-radius:4px; transition:width 0.3s"></div>
        </div>
    `;

    return div;
}

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    const preview = document.getElementById('preview');

    // crea/inserisce #status se non esiste
    const statusEl = document.getElementById('status') || (function () {
      const d = document.createElement('div');
      d.id = 'status';
      d.className = 'status';
      preview?.parentNode?.insertBefore(d, preview);
      return d;
    })();

    // ---- STATO (fuori dal grid) ----
    if (request.action === 'updateScanningStatus' || request.action === 'scanningStatus') {
      statusEl.textContent = request.page ? `Scanning page ${request.page}…` : (request.text || 'Scanning…');
      return;
    }
    if (request.action === 'removeScanningStatus' || request.action === 'scanComplete') {
      statusEl.textContent = '';
      return;
    }

    // ---- IMMAGINE SINGOLA PROGRESSIVA ----
    if (request.action === 'pageImage' && request.dataUrl) {
      // dedup via URL se disponibile
      if (request.srcUrl) {
        if (urlSeenInPopup.has(request.srcUrl)) return;
        urlSeenInPopup.add(request.srcUrl);
      } else {
        // fallback su dataURL
        if (window.__thumbSeen.has(request.dataUrl)) return;
        window.__thumbSeen.add(request.dataUrl);
      }

      // popola array per il salvataggio
      if (typeof request.index === 'number') {
        flipbookImages[request.index] = request.dataUrl;
      } else {
        flipbookImages.push(request.dataUrl);
      }

      // append thumb
      const img = document.createElement('img');
      img.src = request.dataUrl;
      img.loading = 'lazy';
      img.decoding = 'async';
      if (typeof request.index === 'number') img.dataset.index = String(request.index);
      preview.appendChild(img);
      
      // Salva nello storage per persistenza
      saveImagesToStorage();
      return;
    }

    // ---- RISULTATI PARZIALI (APPEND + riempi array) ----
    if (request.action === 'partialScanResult' && Array.isArray(request.images)) {
      const frag = document.createDocumentFragment();
      for (const src of request.images) {
        if (urlSeenInPopup.has(src)) continue;
        urlSeenInPopup.add(src);
        flipbookImages.push(src);
        const img = document.createElement('img');
        img.src = src;
        img.loading = 'lazy';
        img.decoding = 'async';
        frag.appendChild(img);
      }
      preview.appendChild(frag);
      
      // Salva nello storage per persistenza
      saveImagesToStorage();
      return;
    }
  });
});
