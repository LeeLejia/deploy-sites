const App = {
  files: new Map(),
  buffer: [],
  parseQueue: [],
  ocrQueue: [],
  isParsing: false,
  _parseCancelled: false,
  activeFileId: null,
  _editorMode: null,
  _editingFileId: null,

  async init() {
    await DB.init();
    this._createToastContainer();

    const existing = await DB.getAll();
    for (const f of existing) {
      this.files.set(f.id, f);
      if ((f.status === 'done' || f.status === 'ocr_pending') && f.text) {
        SearchEngine.addDocument({
          id: f.id, name: f.name, path: f.path,
          type: f.type, text: f.text
        });
      }
    }

    this._bindEvents();
    this._renderFileTree();
    this._renderBuffer();
    this._updateStats();

    const pending = existing.filter(f =>
      f.status === 'pending' || f.status === 'parsing'
    );
    const ocrPending = existing.filter(f => f.status === 'ocr_pending');

    if (pending.length > 0) {
      pending.forEach(f => this.parseQueue.push(f.id));
    }
    if (ocrPending.length > 0) {
      ocrPending.forEach(f => this.ocrQueue.push(f.id));
    }
    if (this.parseQueue.length > 0 || this.ocrQueue.length > 0) {
      this._processParseQueue();
    }
  },

  _bindEvents() {
    const $ = id => document.getElementById(id);

    $('btnImportDir').addEventListener('click', () => $('dirInput').click());
    $('btnImportFiles').addEventListener('click', () => $('filesInput').click());

    $('dirInput').addEventListener('change', (e) => {
      this._handleImport([...e.target.files]);
      e.target.value = '';
    });
    $('filesInput').addEventListener('change', (e) => {
      this._handleImport([...e.target.files]);
      e.target.value = '';
    });

    $('btnClearAll').addEventListener('click', async () => {
      if (!confirm('确定清空所有导入的数据？此操作不可恢复。')) return;
      this._parseCancelled = true;
      this.parseQueue = [];
      this.ocrQueue = [];
      this.isParsing = false;
      await DB.clear();
      SearchEngine.clear();
      this.files.clear();
      this.buffer = [];
      this._renderFileTree();
      this._renderBuffer();
      this._renderCenterEmpty();
      this._updateStats();
      this._hideProgress();
      this._hideNotice();
      this.toast('已清空所有数据', 'info');
    });

    let searchTimer;
    $('searchInput').addEventListener('input', (e) => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => this._handleSearch(e.target.value), 300);
    });

    $('searchInput').addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.target.value = '';
        this._renderCenterEmpty();
        $('searchCount').textContent = '';
      }
    });

    $('btnClearBuffer').addEventListener('click', () => {
      this.buffer = [];
      this._renderBuffer();
    });

    $('btnMergeEdit').addEventListener('click', () => this._openEditor());
    $('btnExportWord').addEventListener('click', () => Editor.exportWord());
    $('btnExportPdf').addEventListener('click', () => Editor.exportPdf());
    $('btnCloseEditor').addEventListener('click', () => this._closeEditor());

    $('btnSaveFile').addEventListener('click', () => this._saveFileEdit());
    $('btnCancelEdit').addEventListener('click', () => this._closeEditor());

    $('btnClosePreview').addEventListener('click', () => this._closePreviewModal());
  },

  // ===== FILE IMPORT =====

  async _handleImport(fileList) {
    const typeMap = {
      'application/pdf': 'pdf',
      'image/png': 'image',
      'image/jpeg': 'image',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx'
    };

    let docCount = 0;
    let importCount = 0;
    let skipCount = 0;

    for (const file of fileList) {
      if (file.name.startsWith('.')) continue;

      if (file.name.endsWith('.doc') && !file.name.endsWith('.docx')) {
        docCount++;
        continue;
      }

      let type = typeMap[file.type];
      if (!type && file.name.endsWith('.docx')) type = 'docx';
      if (!type && /\.(png|jpg|jpeg)$/i.test(file.name)) type = 'image';
      if (!type && file.name.endsWith('.pdf')) type = 'pdf';
      if (!type) { skipCount++; continue; }

      const existingId = this._findDuplicateFile(file);
      if (existingId) continue;

      const id = 'f_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
      const fileData = {
        id,
        name: file.name,
        path: file.webkitRelativePath || file.name,
        type,
        size: file.size,
        blob: file,
        text: '',
        editedHtml: null,
        status: 'pending',
        addedAt: Date.now()
      };

      this.files.set(id, fileData);
      await DB.save(fileData);
      this.parseQueue.push(id);
      importCount++;
    }

    if (docCount > 0) {
      this.toast(`检测到 ${docCount} 个 .doc 文件，请用 Word/WPS 另存为 .docx 后再导入`, 'warning');
    }
    if (skipCount > 0) {
      this.toast(`已跳过 ${skipCount} 个不支持的文件`, 'info');
    }
    if (importCount > 0) {
      this.toast(`成功导入 ${importCount} 个文件`, 'success');
    }

    this._renderFileTree();
    this._updateStats();

    if (!this.isParsing && this.parseQueue.length > 0) {
      this._processParseQueue();
    }
  },

  _findDuplicateFile(file) {
    for (const [id, f] of this.files) {
      if (f.name === file.name && f.size === file.size &&
          (f.path === (file.webkitRelativePath || file.name))) {
        return id;
      }
    }
    return null;
  },

  // ===== PARSE QUEUE (TWO-PHASE) =====

  async _processParseQueue() {
    if (this.isParsing) return;
    this.isParsing = true;
    this._parseCancelled = false;

    this.parseQueue.sort((a, b) => {
      const fa = this.files.get(a);
      const fb = this.files.get(b);
      return Parser.parsePriority(fa?.type) - Parser.parsePriority(fb?.type);
    });

    const totalFast = this.parseQueue.length;
    let processedFast = 0;

    while (this.parseQueue.length > 0) {
      if (this._parseCancelled) break;

      const id = this.parseQueue.shift();
      const fileData = this.files.get(id);
      if (!fileData) { processedFast++; continue; }

      fileData.status = 'parsing';
      this.files.set(id, fileData);
      this._updateFileTreeStatus(id, 'parsing');

      try {
        const result = await Parser.parseFast(fileData, (p) => {
          this._showProgress({
            phase: 1,
            current: processedFast + 1,
            total: totalFast,
            ocrRemaining: this.ocrQueue.length,
            fileName: fileData.name,
            detail: p.status,
            overallProgress: (processedFast + p.progress) / totalFast
          });
        });

        if (this._parseCancelled) break;

        fileData.text = result.text;

        if (result.needsOCR) {
          fileData.status = 'ocr_pending';
          this.ocrQueue.push(id);
          this._updateFileTreeStatus(id, 'ocr_pending');
        } else {
          fileData.status = 'done';
          this._updateFileTreeStatus(id, 'done');
        }

        this.files.set(id, fileData);
        await DB.save(fileData);

        if (result.text) {
          SearchEngine.addDocument({
            id: fileData.id, name: fileData.name, path: fileData.path,
            type: fileData.type, text: result.text
          });
        }
      } catch (err) {
        if (this._parseCancelled) break;
        console.error('Fast parse error:', fileData.name, err);
        fileData.status = 'error';
        fileData.errorMsg = err.message;
        this.files.set(id, fileData);
        await DB.save(fileData);
        this._updateFileTreeStatus(id, 'error');
      }

      processedFast++;
      this._updateStats();
    }

    if (!this._parseCancelled && this.ocrQueue.length > 0) {
      await this._processOCRQueue();
    }

    this.isParsing = false;
    if (!this._parseCancelled) {
      this._showProgress({
        phase: 0,
        detail: '全部解析完成！',
        overallProgress: 1
      });
      setTimeout(() => this._hideProgress(), 2500);
    }
    this._updateStats();
  },

  async _processOCRQueue() {
    const totalOCR = this.ocrQueue.length;
    let processedOCR = 0;

    while (this.ocrQueue.length > 0) {
      if (this._parseCancelled) break;

      const id = this.ocrQueue.shift();
      const fileData = this.files.get(id);
      if (!fileData) { processedOCR++; continue; }

      fileData.status = 'parsing';
      this.files.set(id, fileData);
      this._updateFileTreeStatus(id, 'parsing');

      try {
        const text = await Parser.parseOCR(fileData, (p) => {
          this._showProgress({
            phase: 2,
            current: processedOCR + 1,
            total: totalOCR,
            fileName: fileData.name,
            detail: p.status,
            overallProgress: (processedOCR + p.progress) / totalOCR
          });
        });

        if (this._parseCancelled) break;

        fileData.text = text || fileData.text;
        fileData.status = 'done';
        this.files.set(id, fileData);
        await DB.save(fileData);

        SearchEngine.addDocument({
          id: fileData.id, name: fileData.name, path: fileData.path,
          type: fileData.type, text: fileData.text
        });

        this._updateFileTreeStatus(id, 'done');
      } catch (err) {
        if (this._parseCancelled) break;
        console.error('OCR parse error:', fileData.name, err);
        fileData.status = 'error';
        fileData.errorMsg = err.message;
        this.files.set(id, fileData);
        await DB.save(fileData);
        this._updateFileTreeStatus(id, 'error');
      }

      processedOCR++;
      this._updateStats();
    }
  },

  // ===== PROGRESS =====

  _showProgress({ phase, current, total, ocrRemaining, fileName, detail, overallProgress }) {
    const panel = document.getElementById('progressPanel');
    panel.classList.remove('collapsed');

    let title = '文件解析中';
    let stats = '';
    if (phase === 1) {
      title = '快速解析';
      stats = `${current} / ${total}`;
      if (ocrRemaining > 0) stats += ` (${ocrRemaining} 个待OCR)`;
    } else if (phase === 2) {
      title = 'OCR 识别';
      stats = `${current} / ${total}`;
    } else {
      stats = '';
    }

    document.getElementById('progressTitle').textContent = title;
    document.getElementById('progressStats').textContent = stats;
    document.getElementById('progressDetail').textContent =
      (fileName ? fileName + ' - ' : '') + (detail || '');
    document.getElementById('progressFill').style.width =
      Math.round((overallProgress || 0) * 100) + '%';
  },

  _hideProgress() {
    document.getElementById('progressPanel').classList.add('collapsed');
  },

  // ===== FILE TREE =====

  _renderFileTree() {
    const container = document.getElementById('fileTree');
    const files = Array.from(this.files.values());

    if (files.length === 0) {
      container.innerHTML = `
        <div class="empty-hint">
          <div class="empty-icon">📂</div>
          <p>点击「导入文件夹」开始使用</p>
          <p class="empty-sub">支持 PDF / DOCX / PNG / JPG</p>
        </div>`;
      return;
    }

    const tree = this._buildTree(files);
    container.innerHTML = '';
    this._renderTreeNodes(tree, container, 0);
  },

  _buildTree(files) {
    const root = {};
    files.forEach(f => {
      const parts = f.path.split('/');
      let current = root;
      for (let i = 0; i < parts.length - 1; i++) {
        if (!current[parts[i]]) current[parts[i]] = { __children: {} };
        current = current[parts[i]].__children;
      }
      current[parts[parts.length - 1]] = { __file: f };
    });
    return root;
  },

  _renderTreeNodes(node, parent, depth) {
    const entries = Object.entries(node).sort(([aKey, aVal], [bKey, bVal]) => {
      const aFolder = !!aVal.__children;
      const bFolder = !!bVal.__children;
      if (aFolder !== bFolder) return aFolder ? -1 : 1;
      return aKey.localeCompare(bKey);
    });

    for (const [key, val] of entries) {
      if (val.__children) {
        const count = this._countFiles(val.__children);
        const folder = document.createElement('div');
        folder.className = 'tree-folder open';
        folder.innerHTML = `
          <div class="tree-folder-label" style="padding-left:${depth * 16 + 8}px">
            <span class="tree-arrow">▶</span>
            <span class="tree-folder-icon">📁</span>
            <span class="tree-folder-name">${this._esc(key)}</span>
            <span class="tree-folder-count">${count}</span>
          </div>
          <div class="tree-folder-children"></div>`;
        folder.querySelector('.tree-folder-label').addEventListener('click', () => {
          folder.classList.toggle('open');
        });
        parent.appendChild(folder);
        this._renderTreeNodes(val.__children, folder.querySelector('.tree-folder-children'), depth + 1);
      } else if (val.__file) {
        const file = val.__file;
        const el = document.createElement('div');
        el.className = 'tree-file' + (file.id === this.activeFileId ? ' active' : '');
        el.dataset.fileId = file.id;
        el.style.paddingLeft = (depth * 16 + 28) + 'px';

        const icon = file.type === 'pdf' ? '📕' : file.type === 'docx' ? '📘' : '🖼️';
        const statusHtml = this._statusIcon(file.status);
        const editedBadge = file.editedHtml ? '<span class="tree-file-edited" title="已编辑（内存中）">✎</span>' : '';

        el.innerHTML = `
          <span class="tree-file-icon">${icon}</span>
          <span class="tree-file-name" title="${this._esc(file.name)}">${this._esc(file.name)}</span>
          ${editedBadge}
          <span class="tree-file-status" data-status-id="${file.id}">${statusHtml}</span>
          <span class="tree-file-actions">
            <button class="tree-file-btn btn-add-buffer" title="添加到已选" data-add-id="${file.id}">+</button>
            <button class="tree-file-btn btn-del-file" title="删除" data-del-id="${file.id}">✕</button>
          </span>`;

        el.addEventListener('click', (e) => {
          if (e.target.closest('.tree-file-btn')) return;
          this._previewFile(file.id);
        });

        el.querySelector('[data-add-id]').addEventListener('click', (e) => {
          e.stopPropagation();
          this.addToBuffer(file.id);
        });

        el.querySelector('[data-del-id]').addEventListener('click', (e) => {
          e.stopPropagation();
          this.deleteFile(file.id);
        });

        parent.appendChild(el);
      }
    }
  },

  _countFiles(node) {
    let count = 0;
    for (const val of Object.values(node)) {
      if (val.__children) count += this._countFiles(val.__children);
      else if (val.__file) count++;
    }
    return count;
  },

  _statusIcon(status) {
    switch (status) {
      case 'done': return '<span class="status-done">✓</span>';
      case 'parsing': return '<span class="status-parsing">◉</span>';
      case 'ocr_pending': return '<span class="status-ocr-pending" title="等待OCR">◔</span>';
      case 'error': return '<span class="status-error">✕</span>';
      default: return '<span class="status-pending">○</span>';
    }
  },

  _updateFileTreeStatus(id, status) {
    const el = document.querySelector(`[data-status-id="${id}"]`);
    if (el) el.innerHTML = this._statusIcon(status);
  },

  _updateStats() {
    const total = this.files.size;
    const done = Array.from(this.files.values()).filter(f => f.status === 'done').length;
    const ocrPending = Array.from(this.files.values()).filter(f => f.status === 'ocr_pending').length;
    let text = String(total);
    if (done < total) {
      text = `${done + ocrPending}/${total}`;
      if (ocrPending > 0) text += ` (${ocrPending} OCR中)`;
    }
    document.getElementById('fileStats').textContent = text;
  },

  // ===== NOTICE =====

  _showNotice() {
    const notice = document.getElementById('editNotice');
    if (notice) notice.classList.remove('hidden');
  },

  _hideNotice() {
    const notice = document.getElementById('editNotice');
    if (notice) notice.classList.add('hidden');
  },

  // ===== SEARCH =====

  _handleSearch(query) {
    const countEl = document.getElementById('searchCount');
    if (!query.trim()) {
      countEl.textContent = '';
      this._renderCenterEmpty();
      return;
    }

    const results = SearchEngine.search(query);
    countEl.textContent = `${results.length} 个结果`;
    this._renderSearchResults(results, query);
  },

  _renderSearchResults(results, query) {
    const content = document.getElementById('centerContent');

    if (results.length === 0) {
      content.innerHTML = `
        <div class="empty-hint">
          <div class="empty-icon">🔍</div>
          <p>未找到匹配的文件</p>
          <p class="empty-sub">尝试更换关键字</p>
        </div>`;
      return;
    }

    let html = '<div class="search-results">';
    for (const r of results) {
      const icon = r.type === 'pdf' ? '📕' : r.type === 'docx' ? '📘' : '🖼️';
      const snippetHtml = SearchEngine.highlightSnippet(r.snippet || '', query);
      const inBuffer = this.buffer.includes(r.id);

      html += `
        <div class="search-result-item" data-file-id="${r.id}">
          <div class="result-icon ${r.type}">${icon}</div>
          <div class="result-info">
            <div class="result-name">${this._esc(r.name)}</div>
            <div class="result-path">${this._esc(r.path)}</div>
            ${snippetHtml ? `<div class="result-snippet">${snippetHtml}</div>` : ''}
          </div>
          <div class="result-actions">
            <button class="btn btn-sm ${inBuffer ? 'btn-secondary' : 'btn-primary'}"
                    data-result-add="${r.id}"
                    ${inBuffer ? 'disabled' : ''}>
              ${inBuffer ? '已添加' : '+ 选择'}
            </button>
          </div>
        </div>`;
    }
    html += '</div>';
    content.innerHTML = html;

    content.querySelectorAll('.search-result-item').forEach(el => {
      el.addEventListener('click', (e) => {
        if (e.target.closest('button')) return;
        this._previewFile(el.dataset.fileId);
      });
    });

    content.querySelectorAll('[data-result-add]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.dataset.resultAdd;
        this.addToBuffer(id);
        btn.textContent = '已添加';
        btn.disabled = true;
        btn.className = 'btn btn-sm btn-secondary';
      });
    });
  },

  _renderCenterEmpty() {
    document.getElementById('centerContent').innerHTML = `
      <div class="empty-hint">
        <div class="empty-icon">🔍</div>
        <p>输入关键字搜索文件内容</p>
        <p class="empty-sub">或点击左侧文件进行预览</p>
      </div>`;
  },

  // ===== PREVIEW =====

  async _previewFile(id) {
    const file = this.files.get(id);
    if (!file) return;

    this.activeFileId = id;
    document.querySelectorAll('.tree-file.active').forEach(el => el.classList.remove('active'));
    const treeEl = document.querySelector(`.tree-file[data-file-id="${id}"]`);
    if (treeEl) treeEl.classList.add('active');

    const content = document.getElementById('centerContent');
    content.innerHTML = '<div class="empty-hint"><div class="spinner"></div><p>加载预览...</p></div>';

    const inBuffer = this.buffer.includes(id);

    try {
      let bodyHtml = '';

      if (file.type === 'image') {
        const url = URL.createObjectURL(file.blob);
        bodyHtml = `<div class="preview-body"><img src="${url}" /></div>`;
      } else if (file.type === 'pdf') {
        const arrayBuffer = await file.blob.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;

        bodyHtml = '<div class="preview-body">';
        const pageCount = Math.min(pdf.numPages, 20);
        for (let i = 1; i <= pageCount; i++) {
          bodyHtml += `<canvas id="prevPage${i}"></canvas>`;
        }
        if (pdf.numPages > 20) {
          bodyHtml += `<p style="text-align:center;color:var(--text-light);padding:12px;">仅显示前 20 页（共 ${pdf.numPages} 页）</p>`;
        }
        bodyHtml += '</div>';

        content.innerHTML = this._previewHeader(file, inBuffer) + bodyHtml + this._previewText(file);

        for (let i = 1; i <= pageCount; i++) {
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: 1.2 });
          const canvas = document.getElementById(`prevPage${i}`);
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
        }

        this._bindPreviewActions(id);
        return;
      } else if (file.type === 'docx') {
        const arrayBuffer = await file.blob.arrayBuffer();
        const result = await mammoth.convertToHtml({ arrayBuffer });
        bodyHtml = `<div class="preview-body docx-preview">${result.value}</div>`;
      }

      content.innerHTML = this._previewHeader(file, inBuffer) + bodyHtml + this._previewText(file);
      this._bindPreviewActions(id);
    } catch (err) {
      content.innerHTML = `
        <div class="preview-header"><h3>${this._esc(file.name)}</h3></div>
        <div class="empty-hint">
          <div class="empty-icon">⚠️</div>
          <p>预览失败: ${this._esc(err.message)}</p>
        </div>`;
    }
  },

  _previewHeader(file, inBuffer) {
    const sizeStr = this._formatSize(file.size);
    const editedTag = file.editedHtml
      ? '<span style="color:var(--warning);font-size:11px;margin-left:6px;">(已编辑·内存中)</span>'
      : '';
    return `
      <div class="preview-header">
        <h3>${this._esc(file.name)} <span style="font-weight:400;color:var(--text-light);font-size:12px;">(${sizeStr})</span>${editedTag}</h3>
        <div class="preview-header-actions">
          <button class="btn btn-sm btn-secondary" id="prevEditFile">编辑</button>
          <button class="btn btn-sm ${inBuffer ? 'btn-secondary' : 'btn-primary'}"
                  id="prevAddBuffer" ${inBuffer ? 'disabled' : ''}>
            ${inBuffer ? '已在列表中' : '+ 添加到已选'}
          </button>
        </div>
      </div>`;
  },

  _previewText(file) {
    if (!file.text) return '';
    return `
      <div class="preview-text-section">
        <h4>提取文本 (${file.status === 'done' ? '已完成' : file.status === 'ocr_pending' ? '待OCR补全' : file.status})</h4>
        <div class="preview-text-content">${this._esc(file.text.substring(0, 2000))}${file.text.length > 2000 ? '\n...(更多内容已省略)' : ''}</div>
      </div>`;
  },

  _bindPreviewActions(id) {
    const addBtn = document.getElementById('prevAddBuffer');
    if (addBtn && !addBtn.disabled) {
      addBtn.addEventListener('click', () => {
        this.addToBuffer(id);
        addBtn.textContent = '已在列表中';
        addBtn.disabled = true;
        addBtn.className = 'btn btn-sm btn-secondary';
      });
    }

    const editBtn = document.getElementById('prevEditFile');
    if (editBtn) {
      editBtn.addEventListener('click', () => this._editFile(id));
    }
  },

  // ===== FILE EDITING (IN MEMORY) =====

  async _editFile(id) {
    const file = this.files.get(id);
    if (!file) return;

    this._setEditorMode('single', id);

    const overlay = document.getElementById('editorOverlay');
    const loading = document.getElementById('editorLoading');
    overlay.classList.remove('hidden');
    loading.classList.remove('hidden');
    loading.querySelector('p').textContent = '正在加载文件内容...';

    try {
      await Editor.init();

      if (file.editedHtml) {
        Editor.setContent(file.editedHtml);
      } else {
        await Editor.loadFiles([file], (msg) => {
          loading.querySelector('p').textContent = msg;
        });
      }

      loading.classList.add('hidden');
    } catch (err) {
      loading.querySelector('p').textContent = '加载失败: ' + err.message;
      console.error('Edit file error:', err);
    }
  },

  _saveFileEdit() {
    const id = this._editingFileId;
    if (!id) return;
    const file = this.files.get(id);
    if (!file) return;

    file.editedHtml = Editor.getContent();
    this.files.set(id, file);

    this._closeEditor();
    this._renderFileTree();
    this._showNotice();
    this.toast('已保存修改（仅在当前会话有效，刷新页面后将丢失）', 'success');

    if (this.activeFileId === id) {
      this._previewFile(id);
    }
  },

  _setEditorMode(mode, fileId) {
    this._editorMode = mode;
    this._editingFileId = fileId || null;

    const mergeActions = document.getElementById('editorMergeActions');
    const singleActions = document.getElementById('editorSingleActions');

    if (mode === 'single') {
      mergeActions.classList.add('hidden');
      singleActions.classList.remove('hidden');
    } else {
      mergeActions.classList.remove('hidden');
      singleActions.classList.add('hidden');
    }
  },

  // ===== BUFFER =====

  async deleteFile(id) {
    const file = this.files.get(id);
    if (!file) return;

    this.files.delete(id);
    await DB.remove(id);
    SearchEngine.removeDocument(id);

    this.buffer = this.buffer.filter(x => x !== id);
    this.parseQueue = this.parseQueue.filter(x => x !== id);
    this.ocrQueue = this.ocrQueue.filter(x => x !== id);

    if (this.activeFileId === id) {
      this.activeFileId = null;
      this._renderCenterEmpty();
    }

    this._renderFileTree();
    this._renderBuffer();
    this._updateStats();
    this.toast(`已删除 ${file.name}`, 'info');
  },

  addToBuffer(id) {
    if (this.buffer.includes(id)) {
      this.toast('文件已在列表中', 'info');
      return;
    }
    this.buffer.push(id);
    this._renderBuffer();
    this.toast('已添加到已选文件', 'success');
  },

  removeFromBuffer(id) {
    this.buffer = this.buffer.filter(x => x !== id);
    this._renderBuffer();
  },

  _renderBuffer() {
    const list = document.getElementById('bufferList');
    const count = document.getElementById('bufferCount');
    const mergeBtn = document.getElementById('btnMergeEdit');
    const clearBtn = document.getElementById('btnClearBuffer');

    count.textContent = this.buffer.length;
    mergeBtn.disabled = this.buffer.length === 0;
    clearBtn.disabled = this.buffer.length === 0;

    if (this.buffer.length === 0) {
      list.innerHTML = `
        <div class="empty-hint">
          <div class="empty-icon">📋</div>
          <p>从搜索结果或文件树中</p>
          <p>选择文件添加到这里</p>
        </div>`;
      return;
    }

    list.innerHTML = '';
    this.buffer.forEach((id, idx) => {
      const file = this.files.get(id);
      if (!file) return;

      const icon = file.type === 'pdf' ? '📕' : file.type === 'docx' ? '📘' : '🖼️';
      const editedMark = file.editedHtml ? ' <span style="color:var(--warning);font-size:10px;">✎</span>' : '';
      const el = document.createElement('div');
      el.className = 'buffer-item';
      el.draggable = true;
      el.dataset.bufferIdx = idx;

      el.innerHTML = `
        <span class="buffer-item-index">${idx + 1}</span>
        <span class="buffer-item-icon">${icon}</span>
        <span class="buffer-item-name" title="${this._esc(file.path)}">${this._esc(file.name)}${editedMark}</span>
        <button class="buffer-item-remove" data-remove-id="${id}" title="移除">✕</button>`;

      el.querySelector('[data-remove-id]').addEventListener('click', (e) => {
        e.stopPropagation();
        this.removeFromBuffer(id);
      });

      el.addEventListener('dragstart', (e) => {
        el.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(idx));
      });
      el.addEventListener('dragend', () => el.classList.remove('dragging'));
      el.addEventListener('dragover', (e) => {
        e.preventDefault();
        el.classList.add('drag-over');
      });
      el.addEventListener('dragleave', () => el.classList.remove('drag-over'));
      el.addEventListener('drop', (e) => {
        e.preventDefault();
        el.classList.remove('drag-over');
        const fromIdx = parseInt(e.dataTransfer.getData('text/plain'));
        const toIdx = idx;
        if (fromIdx === toIdx) return;
        const [moved] = this.buffer.splice(fromIdx, 1);
        this.buffer.splice(toIdx, 0, moved);
        this._renderBuffer();
      });

      list.appendChild(el);
    });
  },

  // ===== EDITOR (MERGE) =====

  async _openEditor() {
    if (this.buffer.length === 0) return;

    this._setEditorMode('merge', null);

    const overlay = document.getElementById('editorOverlay');
    const loading = document.getElementById('editorLoading');
    overlay.classList.remove('hidden');
    loading.classList.remove('hidden');
    loading.querySelector('p').textContent = '正在合并文件内容...';

    try {
      await Editor.init();

      const filesToMerge = this.buffer
        .map(id => this.files.get(id))
        .filter(Boolean);

      await Editor.loadFiles(filesToMerge, (msg) => {
        loading.querySelector('p').textContent = msg;
      });

      loading.classList.add('hidden');
    } catch (err) {
      loading.querySelector('p').textContent = '加载失败: ' + err.message;
      console.error('Editor load error:', err);
    }
  },

  _closeEditor() {
    document.getElementById('editorOverlay').classList.add('hidden');
    Editor.destroy();
    this._editorMode = null;
    this._editingFileId = null;
  },

  // ===== PREVIEW MODAL =====

  _closePreviewModal() {
    document.getElementById('previewModal').classList.add('hidden');
  },

  // ===== TOAST =====

  _createToastContainer() {
    if (document.querySelector('.toast-container')) return;
    const container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  },

  toast(message, type) {
    type = type || 'info';
    const container = document.querySelector('.toast-container');
    if (!container) return;
    const el = document.createElement('div');
    el.className = 'toast toast-' + type;
    el.textContent = message;
    container.appendChild(el);
    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transform = 'translateX(100%)';
      el.style.transition = 'all .3s ease';
      setTimeout(() => el.remove(), 300);
    }, 3000);
  },

  // ===== UTILS =====

  _esc(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  },

  _formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  }
};

document.addEventListener('DOMContentLoaded', () => {
  App.init().catch(err => {
    console.error('App init failed:', err);
    alert('应用初始化失败: ' + err.message);
  });
});
