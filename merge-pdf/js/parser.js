if (typeof pdfjsLib !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

const Parser = {
  ocrWorker: null,
  _ocrProgressCb: null,
  _ocrInitializing: false,
  _ocrReady: false,

  async initOCR() {
    if (this._ocrReady && this.ocrWorker) return;
    if (this._ocrInitializing) {
      while (this._ocrInitializing) {
        await new Promise(r => setTimeout(r, 100));
      }
      return;
    }

    this._ocrInitializing = true;
    try {
      this.ocrWorker = await Tesseract.createWorker('chi_sim+eng', 1, {
        logger: (m) => {
          if (this._ocrProgressCb) this._ocrProgressCb(m);
        }
      });
      this._ocrReady = true;
    } finally {
      this._ocrInitializing = false;
    }
  },

  async terminateOCR() {
    if (this.ocrWorker) {
      await this.ocrWorker.terminate();
      this.ocrWorker = null;
      this._ocrReady = false;
    }
  },

  parsePriority(type) {
    return { docx: 0, pdf: 1, image: 2 }[type] ?? 9;
  },

  async parseFast(fileData, onProgress) {
    const { blob, type } = fileData;

    if (type === 'docx') {
      const text = await this.parseDOCX(blob, onProgress);
      return { text, needsOCR: false };
    }

    if (type === 'pdf') {
      return await this.parsePDFTextOnly(blob, onProgress);
    }

    if (type === 'image') {
      if (onProgress) onProgress({ status: '等待 OCR 队列...', progress: 0 });
      return { text: '', needsOCR: true };
    }

    return { text: '', needsOCR: false };
  },

  async parseOCR(fileData, onProgress) {
    const { blob, type } = fileData;

    if (type === 'image') {
      const text = await this.parseImage(blob, onProgress);
      return text;
    }

    if (type === 'pdf') {
      const text = await this.parsePDFOCR(blob, onProgress);
      return text;
    }

    return '';
  },

  async parseDOCX(blob, onProgress) {
    if (onProgress) onProgress({ status: '正在提取 Word 文本...', progress: 0.3 });
    const arrayBuffer = await blob.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    if (onProgress) onProgress({ status: '完成', progress: 1 });
    return result.value || '';
  },

  async parsePDFTextOnly(blob, onProgress) {
    const arrayBuffer = await blob.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
    const numPages = pdf.numPages;
    let fullText = '';
    let charCount = 0;

    for (let i = 1; i <= numPages; i++) {
      if (onProgress) {
        onProgress({
          status: `提取PDF文本 (${i}/${numPages})`,
          progress: i / numPages
        });
      }
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map(item => item.str).join('');
      charCount += pageText.replace(/\s/g, '').length;
      fullText += pageText + '\n';
    }

    const avgCharsPerPage = numPages > 0 ? charCount / numPages : 0;
    const isScanned = avgCharsPerPage < 20;

    return { text: fullText.trim(), needsOCR: isScanned };
  },

  async parsePDFOCR(blob, onProgress) {
    const arrayBuffer = await blob.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
    const numPages = pdf.numPages;
    let fullText = '';

    if (onProgress) {
      onProgress({ status: '初始化 OCR 引擎...', progress: 0 });
    }

    await this.initOCR();

    for (let i = 1; i <= numPages; i++) {
      this._ocrProgressCb = (m) => {
        if (m.status === 'recognizing text' && onProgress) {
          onProgress({
            status: `OCR识别 第${i}/${numPages}页 ${Math.round(m.progress * 100)}%`,
            progress: ((i - 1 + m.progress) / numPages)
          });
        }
      };

      const canvas = await this._renderPdfPage(pdf, i, 2.0);
      const { data: { text } } = await this.ocrWorker.recognize(canvas);
      fullText += text + '\n';
    }

    this._ocrProgressCb = null;
    if (onProgress) onProgress({ status: '完成', progress: 1 });
    return fullText.trim();
  },

  async parseImage(blob, onProgress) {
    if (onProgress) {
      onProgress({ status: '初始化 OCR 引擎...', progress: 0 });
    }

    await this.initOCR();

    this._ocrProgressCb = (m) => {
      if (onProgress) {
        if (m.status === 'loading language traineddata') {
          onProgress({
            status: `加载语言模型 ${Math.round(m.progress * 100)}%`,
            progress: m.progress * 0.3
          });
        } else if (m.status === 'recognizing text') {
          onProgress({
            status: `OCR识别中 ${Math.round(m.progress * 100)}%`,
            progress: 0.3 + m.progress * 0.7
          });
        }
      }
    };

    const { data: { text } } = await this.ocrWorker.recognize(blob);
    this._ocrProgressCb = null;

    if (onProgress) onProgress({ status: '完成', progress: 1 });
    return text || '';
  },

  async _renderPdfPage(pdf, pageNum, scale) {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    await page.render({ canvasContext: ctx, viewport }).promise;
    return canvas;
  },

  async docxToHtml(blob) {
    const arrayBuffer = await blob.arrayBuffer();
    const result = await mammoth.convertToHtml({ arrayBuffer });
    return result.value || '';
  },

  async pdfToImages(blob, scale) {
    scale = scale || 1.5;
    const arrayBuffer = await blob.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
    const images = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const canvas = await this._renderPdfPage(pdf, i, scale);
      images.push(canvas.toDataURL('image/png'));
    }
    return images;
  }
};
