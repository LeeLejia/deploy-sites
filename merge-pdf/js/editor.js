const Editor = {
  instance: null,
  _initPromise: null,

  async init() {
    if (this.instance) return this.instance;
    if (this._initPromise) return this._initPromise;

    this._initPromise = new Promise((resolve, reject) => {
      if (typeof tinymce === 'undefined') {
        reject(new Error('TinyMCE 未加载'));
        return;
      }
      const editorBody = document.querySelector('.editor-body');
      const editorHeight = editorBody ? editorBody.clientHeight : 600;

      tinymce.init({
        selector: '#editorContent',
        height: editorHeight,
        resize: false,
        branding: false,
        promotion: false,
        plugins: 'lists link image table wordcount pagebreak searchreplace fullscreen',
        toolbar: [
          'undo redo | blocks fontfamily fontsize | bold italic underline strikethrough',
          'alignleft aligncenter alignright alignjustify | bullist numlist | table image pagebreak | searchreplace | fullscreen'
        ].join(' | '),
        menubar: 'file edit view insert format table',
        content_style: `
          body {
            font-family: "SimSun", "Songti SC", "STSong", serif;
            font-size: 14px;
            line-height: 1.8;
            padding: 24px 32px;
            max-width: 800px;
            margin: 0 auto;
            color: #1f2937;
          }
          img { max-width: 100%; height: auto; }
          table { border-collapse: collapse; width: 100%; }
          table td, table th { border: 1px solid #d1d5db; padding: 6px 10px; }
          h1 { font-size: 22px; margin: 24px 0 12px; }
          h2 { font-size: 18px; margin: 20px 0 10px; }
          h3 { font-size: 16px; margin: 16px 0 8px; }
          hr { border: none; border-top: 2px solid #e5e7eb; margin: 24px 0; }
          .file-divider {
            background: #eff6ff;
            border-left: 4px solid #2563eb;
            padding: 8px 14px;
            margin: 24px 0 16px;
            font-size: 14px;
            font-weight: 600;
            color: #1e40af;
          }
        `,
        font_family_formats: '宋体=SimSun,STSong,serif;黑体=SimHei,STHeiti,sans-serif;楷体=KaiTi,STKaiti,serif;仿宋=FangSong,STFangsong,serif;微软雅黑=Microsoft YaHei,sans-serif;Arial=Arial,sans-serif;Times New Roman=Times New Roman,serif',
        font_size_formats: '10px 12px 14px 16px 18px 20px 24px 28px 32px 36px',
        setup: (editor) => {
          editor.on('init', () => {
            this.instance = editor;
            resolve(editor);
          });
        }
      });
    });

    return this._initPromise;
  },

  setContent(html) {
    if (this.instance) {
      this.instance.setContent(html);
    }
  },

  getContent() {
    return this.instance ? this.instance.getContent() : '';
  },

  async loadFiles(files, onProgress) {
    let html = '';
    const total = files.length;

    for (let i = 0; i < total; i++) {
      const file = files[i];
      if (onProgress) onProgress(`正在处理 ${file.name} (${i + 1}/${total})`);

      html += `<div class="file-divider">📄 ${this._escapeHtml(file.name)}</div>`;

      try {
        if (file.type === 'docx') {
          const docxHtml = await Parser.docxToHtml(file.blob);
          html += docxHtml;
        } else if (file.type === 'image') {
          const dataUrl = await this._blobToDataUrl(file.blob);
          html += `<p><img src="${dataUrl}" style="max-width:100%;" /></p>`;
        } else if (file.type === 'pdf') {
          const images = await Parser.pdfToImages(file.blob, 1.5);
          for (const imgSrc of images) {
            html += `<p><img src="${imgSrc}" style="max-width:100%;" /></p>`;
          }
        }
      } catch (err) {
        html += `<p style="color:red;">⚠ 加载失败: ${this._escapeHtml(err.message)}</p>`;
      }

      html += '<hr />';
    }

    this.setContent(html);
  },

  exportWord() {
    const html = this.getContent();
    const fullHtml = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office'
            xmlns:w='urn:schemas-microsoft-com:office:word'
            xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset='utf-8'>
        <style>
          body { font-family: SimSun, serif; font-size: 14px; line-height: 1.8; }
          table { border-collapse: collapse; width: 100%; }
          table td, table th { border: 1px solid #999; padding: 6px 10px; }
          img { max-width: 100%; }
          .file-divider {
            background: #eff6ff;
            border-left: 4px solid #2563eb;
            padding: 8px 14px;
            margin: 24px 0 16px;
            font-size: 14px;
            font-weight: bold;
            color: #1e40af;
          }
        </style>
      </head>
      <body>${html}</body>
      </html>`;

    const blob = new Blob(['\ufeff', fullHtml], { type: 'application/msword' });
    this._download(blob, '合并文档.doc');
  },

  exportPdf() {
    const html = this.getContent();
    const container = document.createElement('div');
    container.innerHTML = html;
    container.style.cssText = 'font-family:SimSun,serif;font-size:14px;line-height:1.8;color:#1f2937;padding:20px;';

    const styleEl = document.createElement('style');
    styleEl.textContent = `
      img { max-width: 100% !important; height: auto !important; }
      table { border-collapse: collapse; width: 100%; page-break-inside: auto; }
      table td, table th { border: 1px solid #999; padding: 6px 10px; }
      .file-divider {
        background: #eff6ff;
        border-left: 4px solid #2563eb;
        padding: 8px 14px;
        margin: 24px 0 16px;
        font-weight: bold;
        color: #1e40af;
      }
    `;
    container.prepend(styleEl);

    html2pdf().set({
      margin: [15, 15, 15, 15],
      filename: '合并文档.pdf',
      image: { type: 'jpeg', quality: 0.92 },
      html2canvas: { scale: 2, useCORS: true, logging: false },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
    }).from(container).save();
  },

  destroy() {
    if (this.instance) {
      tinymce.remove('#editorContent');
      this.instance = null;
      this._initPromise = null;
    }
  },

  _blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  },

  _download(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },

  _escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
};
