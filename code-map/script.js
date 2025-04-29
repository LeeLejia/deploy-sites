// 存储映射数据的数组
let mappings = [];

// 当前代码编辑状态
let currentEditState = {
  index: -1,
  type: '', // 'source' 或 'target'
};

// 是否已加载highlight.js
let isHighlightJsLoaded = false;

// DOM 元素引用
let mappingList, addMappingBtn, previewMdBtn, copyMdBtn, importDataBtn, copyJsonBtn, 
    mappingModal, mappingForm, editIndexInput, mappingKeyInput, isRequiredCheckbox, 
    descriptionInput, sourceLanguageSelect, targetLanguageSelect, sourceCodeInput, 
    targetCodeInput, previewModal, previewContent, copyMdPreviewBtn, importModal, 
    importJsonData, importMdData, confirmImportBtn, codeEditModal, codeEditTitle, 
    sourceEditLanguage, sourceEditContent, targetEditLanguage, targetEditContent, 
    saveCodeEditBtn;

// DOM加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
  // 确保所有资源加载完成后再初始化
  setTimeout(() => {
    initDOMReferences();
    checkHighlightJs();
    init();
    // 不需要在这里调用initDragAndDrop，因为它会在renderMappingList中被调用
  }, 500); // 增加等待时间到500ms
});

// 检查highlight.js是否已加载
function checkHighlightJs() {
  try {
    // 检查highlight.js是否正确加载
    isHighlightJsLoaded = typeof hljs !== 'undefined';
    
    if (isHighlightJsLoaded) {
      console.log('highlight.js已加载，可以进行代码高亮');
    } else {
      console.warn('highlight.js未加载，将使用纯文本显示代码');
      // 尝试加载CDN版本作为备选方案
      loadHighlightJsCDN();
    }
  } catch (e) {
    isHighlightJsLoaded = false;
    console.warn('highlight.js检测失败，将使用纯文本显示代码');
    // 尝试加载CDN版本作为备选方案
    loadHighlightJsCDN();
  }
}

// 尝试从CDN加载highlight.js
function loadHighlightJsCDN() {
  try {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.7.0/highlight.min.js';
    script.onload = function() {
      console.log('已从CDN加载highlight.js');
      isHighlightJsLoaded = true;
      
      // 重新渲染列表以应用高亮
      renderMappingList();
    };
    script.onerror = function() {
      console.warn('从CDN加载highlight.js失败');
    };
    document.head.appendChild(script);
    
    // 添加基本样式
    const style = document.createElement('link');
    style.rel = 'stylesheet';
    style.href = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.7.0/styles/github.min.css';
    document.head.appendChild(style);
  } catch (e) {
    console.error('尝试加载highlight.js CDN失败:', e);
  }
}

// 初始化DOM元素引用
function initDOMReferences() {
  mappingList = document.getElementById('mapping-list');
  addMappingBtn = document.getElementById('add-mapping');
  previewMdBtn = document.getElementById('preview-md');
  copyMdBtn = document.getElementById('copy-md');
  importDataBtn = document.getElementById('import-data');
  copyJsonBtn = document.getElementById('copy-json');
  
  mappingModal = document.getElementById('mapping-modal');
  mappingForm = document.getElementById('mapping-form');
  editIndexInput = document.getElementById('edit-index');
  mappingKeyInput = document.getElementById('mapping-key');
  isRequiredCheckbox = document.getElementById('is-required');
  descriptionInput = document.getElementById('description');
  sourceLanguageSelect = document.getElementById('source-language');
  targetLanguageSelect = document.getElementById('target-language');
  sourceCodeInput = document.getElementById('source-code');
  targetCodeInput = document.getElementById('target-code');
  
  previewModal = document.getElementById('preview-modal');
  previewContent = document.getElementById('preview-content');
  copyMdPreviewBtn = document.getElementById('copy-md-preview');
  
  importModal = document.getElementById('import-modal');
  importJsonData = document.getElementById('import-json-data');
  importMdData = document.getElementById('import-md-data');
  confirmImportBtn = document.getElementById('confirm-import');
  
  // 代码编辑模态框元素
  codeEditModal = document.getElementById('code-edit-modal');
  codeEditTitle = document.getElementById('code-edit-title');
  
  // 编辑模态框中的元素在打开时动态获取，避免初始化时未加载的问题
}

// 初始化
function init() {
  // 尝试从 localStorage 加载数据
  const savedMappings = localStorage.getItem('code-map-mappings');
  if (savedMappings) {
    try {
      mappings = JSON.parse(savedMappings);
      renderMappingList();
    } catch (e) {
      console.error('加载保存的映射数据失败:', e);
      // 如果加载失败，清除可能损坏的数据并加载示例数据
      localStorage.removeItem('code-map-mappings');
      loadExampleData();
    }
  } else {
    // 如果没有保存的数据，加载示例数据
    loadExampleData();
  }
  
  // 添加事件监听器
  addMappingBtn.addEventListener('click', openAddMappingModal);
  previewMdBtn.addEventListener('click', openPreviewModal);
  copyMdBtn.addEventListener('click', copyMarkdown);
  importDataBtn.addEventListener('click', openImportModal);
  copyJsonBtn.addEventListener('click', copyJson);
  
  mappingForm.addEventListener('submit', handleMappingFormSubmit);
  
  // 为所有关闭模态框按钮添加事件
  document.querySelectorAll('.close-modal').forEach(btn => {
    btn.addEventListener('click', function() {
      mappingModal.style.display = 'none';
      previewModal.style.display = 'none';
      importModal.style.display = 'none';
      codeEditModal.style.display = 'none';
    });
  });
  
  // 标签切换功能
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', function() {
      // 激活点击的标签
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      this.classList.add('active');
      
      // 显示对应内容
      const tabName = this.getAttribute('data-tab');
      document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
      });
      document.getElementById(`${tabName}-tab`).classList.add('active');
      
      // 更新导入模态框标题
      if (tabName === 'json') {
        document.getElementById('import-title').textContent = '导入 JSON';
      } else if (tabName === 'markdown') {
        document.getElementById('import-title').textContent = '导入 Markdown';
      }
    });
  });
  
  copyMdPreviewBtn.addEventListener('click', copyMarkdownFromPreview);
  confirmImportBtn.addEventListener('click', handleImport);
  
  // 添加预览JSON数据按钮事件监听
  const previewJsonBtn = document.getElementById('preview-json');
  if (previewJsonBtn) {
    previewJsonBtn.addEventListener('click', previewImportedJson);
  }
  
  // 保存代码编辑按钮事件监听器
  const saveBtn = document.getElementById('save-code-edit');
  if (saveBtn) {
    saveBtn.addEventListener('click', saveCodeEdit);
  } else {
    console.warn('保存代码编辑按钮未找到，将在编辑时动态绑定事件');
  }
}

// 渲染映射列表
function renderMappingList() {
  mappingList.innerHTML = '';
  
  if (mappings.length === 0) {
    mappingList.innerHTML = '<div class="empty-state">没有映射数据。点击"添加映射"按钮开始。</div>';
    return;
  }
  
  mappings.forEach((mapping, index) => {
    const mappingItem = document.createElement('div');
    mappingItem.className = 'mapping-item';
    mappingItem.dataset.index = index;
    mappingItem.draggable = false; // 默认不可拖拽，只有在拖动手柄被点击时才设置为true
    
    // 创建标题栏（可点击展开/折叠）
    const header = document.createElement('div');
    header.className = 'mapping-header';
    
    // 添加点击事件用于展开/折叠
    header.addEventListener('click', (e) => {
      // 确保不是点击了操作按钮
      if (!e.target.closest('.mapping-actions')) {
        toggleExpand(mappingItem);
      }
    });
    
    // 统一处理键名显示，始终使用key-item样式
    let keyDisplay = '';
    if (mapping.key) {
      // 确保 key 是数组
      const keyArray = Array.isArray(mapping.key) ? mapping.key : 
                      (typeof mapping.key === 'string' && mapping.key ? 
                       (mapping.key.includes(',') ? mapping.key.split(',').map(k => k.trim()).filter(k => k) : [mapping.key.trim()]) 
                       : []);
      
      keyDisplay = keyArray.map(k => `<span class="key-item">${k}</span>`).join('');
    }
    
    // 标题左侧部分（拖动手柄和标题）
    const titleSection = document.createElement('div');
    titleSection.className = 'mapping-title';
    titleSection.innerHTML = `
      <span class="drag-handle" title="拖拽排序">☰</span>
      <span>${mapping.description || '未命名映射'}</span>
      ${mapping.isRequired ? '<span class="required-badge">必需</span>' : ''}
      <span class="mapping-key">${keyDisplay}</span>
    `;
    
    // 标题右侧操作按钮
    const actionsSection = document.createElement('div');
    actionsSection.className = 'mapping-actions';
    actionsSection.innerHTML = `
      <button class="btn btn-primary edit-mapping-btn" data-index="${index}">编辑</button>
      <button class="btn btn-danger delete-mapping-btn" data-index="${index}">删除</button>
    `;
    
    header.appendChild(titleSection);
    header.appendChild(actionsSection);
    
    // 创建内容区域（默认折叠）
    const content = document.createElement('div');
    content.className = 'mapping-content';
    
    // 源代码和目标代码并排显示
    const codeComparison = document.createElement('div');
    codeComparison.className = 'code-comparison';
    
    // 获取语言显示名称
    const sourceLanguageName = getLanguageDisplayName(mapping.sourceLanguage || 'javascript');
    const targetLanguageName = getLanguageDisplayName(mapping.targetLanguage || 'javascript');
    
    // 源代码列
    const sourceColumn = document.createElement('div');
    sourceColumn.className = 'code-column';
    sourceColumn.innerHTML = `
      <div class="code-column-header">
        <strong>源代码 <span class="language-badge">${sourceLanguageName}</span></strong>
      </div>
      <div class="code-column-content">
        <pre><code class="language-${mapping.sourceLanguage || 'javascript'}">${escapeHtml(mapping.sourceCode || '')}</code></pre>
      </div>
    `;
    
    // 目标代码列
    const targetColumn = document.createElement('div');
    targetColumn.className = 'code-column';
    targetColumn.innerHTML = `
      <div class="code-column-header">
        <strong>目标代码 <span class="language-badge">${targetLanguageName}</span></strong>
      </div>
      <div class="code-column-content">
        <pre><code class="language-${mapping.targetLanguage || 'javascript'}">${escapeHtml(mapping.targetCode || '')}</code></pre>
      </div>
    `;
    
    codeComparison.appendChild(sourceColumn);
    codeComparison.appendChild(targetColumn);
    
    content.appendChild(codeComparison);
    
    // 组装映射项
    mappingItem.appendChild(header);
    mappingItem.appendChild(content);
    
    mappingList.appendChild(mappingItem);
    
    // 添加事件监听器到编辑和删除按钮
    const editBtn = mappingItem.querySelector('.edit-mapping-btn');
    const deleteBtn = mappingItem.querySelector('.delete-mapping-btn');
    
    editBtn.addEventListener('click', (e) => {
      e.stopPropagation(); // 防止事件冒泡到header
      editMapping(parseInt(mappingItem.dataset.index));
    });
    
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation(); // 防止事件冒泡到header
      deleteMapping(parseInt(mappingItem.dataset.index));
    });
  });
  
  // 安全地应用语法高亮
  applyCodeHighlight();
  
  // 每次渲染列表后重新初始化拖拽功能
  initDragAndDrop();
}

// 获取语言的显示名称
function getLanguageDisplayName(language) {
  const languageMap = {
    'javascript': 'JavaScript',
    'typescript': 'TypeScript',
    'php': 'PHP',
    'java': 'Java',
    'csharp': 'C#',
    'python': 'Python',
    'go': 'Go',
    // 可以根据需要添加更多语言
  };
  
  return languageMap[language] || language;
}

// 安全地应用代码高亮
function applyCodeHighlight() {
  if (isHighlightJsLoaded) {
    try {
      document.querySelectorAll('pre code').forEach((block) => {
        hljs.highlightElement(block);
      });
    } catch (e) {
      console.warn('应用代码高亮失败:', e);
    }
  } else {
    console.log('highlight.js未加载，跳过代码高亮');
  }
}

// 切换展开/折叠状态
function toggleExpand(mappingItem) {
  mappingItem.classList.toggle('expanded');
}

// 打开添加映射模态框
function openAddMappingModal() {
  document.getElementById('modal-title').textContent = '添加映射';
  editIndexInput.value = '';
  mappingForm.reset();
  sourceLanguageSelect.value = 'php';
  targetLanguageSelect.value = 'typescript';
  mappingModal.style.display = 'flex';
}

// 处理映射表单提交
function handleMappingFormSubmit(e) {
  e.preventDefault();
  
  // 处理键名中的逗号，去除空格后转为数组格式
  let keyValue = mappingKeyInput.value;
  let keyArray = [];
  
  if (keyValue.includes(',')) {
    // 拆分逗号分隔的键名并去除每个键名周围的空格
    keyArray = keyValue.split(',').map(k => k.trim()).filter(k => k);
  } else if (keyValue.trim()) {
    // 单个键名也转为数组
    keyArray = [keyValue.trim()];
  }
  
  const index = editIndexInput.value;
  const newMapping = {
    key: keyArray, // 存储为数组格式
    isRequired: isRequiredCheckbox.checked,
    description: descriptionInput.value,
    sourceLanguage: sourceLanguageSelect.value,
    targetLanguage: targetLanguageSelect.value,
    sourceCode: sourceCodeInput.value,
    targetCode: targetCodeInput.value
  };
  
  if (index === '') {
    // 添加新映射
    mappings.push(newMapping);
  } else {
    // 更新已有映射
    mappings[parseInt(index)] = newMapping;
  }
  
  // 保存到 localStorage
  localStorage.setItem('code-map-mappings', JSON.stringify(mappings));
  
  // 重新渲染列表
  renderMappingList();
  
  // 关闭模态框
  mappingModal.style.display = 'none';
}

// 删除映射
function deleteMapping(index) {
  if (confirm('确定要删除这个映射吗？')) {
    mappings.splice(index, 1);
    localStorage.setItem('code-map-mappings', JSON.stringify(mappings));
    renderMappingList();
  }
}

// 生成 Markdown 内容
function generateMarkdown() {
  let markdown = '';
  
  mappings.forEach(mapping => {
    const requiredTag = mapping.isRequired ? ' [required]' : '';
    
    // 确保 key 是数组
    const keyArray = Array.isArray(mapping.key) ? mapping.key : 
                    (typeof mapping.key === 'string' && mapping.key ? 
                     (mapping.key.includes(',') ? mapping.key.split(',').map(k => k.trim()).filter(k => k) : [mapping.key.trim()]) 
                     : []);
    
    // 将 key 作为标题使用
    markdown += `#${requiredTag} ${keyArray.join(', ')}\n`;
    markdown += `${mapping.description}\n\n`;
    
    // 使用指定的源语言
    const sourceLanguage = mapping.sourceLanguage || 'php';
    markdown += `\`\`\`${sourceLanguage}\n`;
    markdown += `${mapping.sourceCode}\n`;
    markdown += '```\n\n';
    
    // 使用指定的目标语言
    const targetLanguage = mapping.targetLanguage || 'typescript';
    markdown += `\`\`\`${targetLanguage}\n`;
    markdown += `${mapping.targetCode}\n`;
    markdown += '```\n\n';
  });
  
  return markdown;
}

// 打开预览模态框
function openPreviewModal() {
  const markdown = generateMarkdown();
  
  // 添加复制按钮到预览内容中
  previewContent.innerHTML = `
    <div class="preview-text">${escapeHtml(markdown)}</div>
  `;
  
  // 绑定复制按钮点击事件
  const copyBtn = previewContent.querySelector('.copy-content-btn');
  if (copyBtn) {
    copyBtn.addEventListener('click', function() {
      const textContent = previewContent.querySelector('.preview-text').textContent;
      
      copyToClipboard(textContent)
        .then(() => {
          showToast('内容已复制到剪贴板');
          // 更新按钮状态
          copyBtn.innerHTML = '<span class="copy-icon">✓</span> 已复制';
          copyBtn.classList.add('copied');
          
          // 3秒后恢复按钮原状
          setTimeout(() => {
            copyBtn.innerHTML = '<span class="copy-icon">📋</span> 复制内容';
            copyBtn.classList.remove('copied');
          }, 3000);
        })
        .catch(err => {
          console.error('复制失败: ', err);
          showToast('复制失败，请手动复制');
        });
    });
  }
  
  previewModal.style.display = 'flex';
}

// 复制 Markdown 到剪贴板
function copyMarkdown() {
  const markdown = generateMarkdown();
  
  copyToClipboard(markdown)
    .then(() => {
      showToast('Markdown 已复制到剪贴板');
    })
    .catch(err => {
      console.error('复制失败: ', err);
      showToast('复制失败，请手动复制');
    });
}

// 从预览模态框复制 Markdown 到剪贴板
function copyMarkdownFromPreview() {
  const previewText = previewContent.querySelector('.preview-text');
  const markdown = previewText ? previewText.textContent : previewContent.textContent;
  
  copyToClipboard(markdown)
    .then(() => {
      showToast('Markdown 已复制到剪贴板');
    })
    .catch(err => {
      console.error('复制失败: ', err);
      showToast('复制失败，请手动复制');
    });
}

// 打开导入模态框
function openImportModal() {
  document.getElementById('import-title').textContent = '导入数据';
  document.querySelector('.tab[data-tab="json"]').click();
  importJsonData.value = '';
  importMdData.value = '';
  importModal.style.display = 'flex';
}

// 处理导入操作
function handleImport() {
  const activeTab = document.querySelector('.tab.active').getAttribute('data-tab');
  if (activeTab === 'json') {
    importJson();
  } else if (activeTab === 'markdown') {
    importMarkdown();
  }
}

// 导入 JSON 数据
function importJson() {
  try {
    const jsonData = importJsonData.value.trim();
    if (!jsonData) {
      showToast('请输入有效的 JSON 数据');
      return;
    }
    
    const importedMappings = JSON.parse(jsonData);
    
    if (!Array.isArray(importedMappings)) {
      showToast('导入的 JSON 数据必须是数组');
      return;
    }
    
    // 验证每个映射项的结构
    for (let i = 0; i < importedMappings.length; i++) {
      const mapping = importedMappings[i];
      if (!mapping.key || typeof mapping.description !== 'string' || 
          typeof mapping.sourceCode !== 'string' || typeof mapping.targetCode !== 'string') {
        showToast('导入的 JSON 数据格式不正确，请检查');
        return;
      }
      
      // 确保key是数组
      if (!Array.isArray(mapping.key)) {
        // 如果是字符串，则转换为数组
        if (typeof mapping.key === 'string') {
          if (mapping.key.includes(',')) {
            // 如果包含逗号，按逗号分割
            importedMappings[i].key = mapping.key.split(',').map(k => k.trim()).filter(k => k);
          } else {
            // 单个键名
            importedMappings[i].key = [mapping.key.trim()];
          }
        } else {
          // 如果不是字符串也不是数组，设为空数组
          importedMappings[i].key = [];
        }
      }
    }
    
    // 导入成功
    mappings = importedMappings;
    localStorage.setItem('code-map-mappings', JSON.stringify(mappings));
    renderMappingList();
    importModal.style.display = 'none';
    showToast('导入成功');
  } catch (e) {
    showToast('导入失败: ' + e.message);
  }
}

// 导入 Markdown
function importMarkdown() {
  try {
    const markdownData = importMdData.value.trim();
    if (!markdownData) {
      showToast('请输入有效的 Markdown 数据');
      return;
    }
    
    const importedMappings = parseMarkdown(markdownData);
    
    if (importedMappings.length === 0) {
      showToast('未能解析到有效的映射数据');
      return;
    }
    
    // 导入成功
    mappings = importedMappings;
    localStorage.setItem('code-map-mappings', JSON.stringify(mappings));
    renderMappingList();
    importModal.style.display = 'none';
    showToast('导入成功');
  } catch (e) {
    showToast('导入失败: ' + e.message);
  }
}

// 复制 JSON 到剪贴板
function copyJson() {
  try {
    // 确保每个映射的 key 都是数组格式
    const exportMappings = mappings.map(mapping => {
      // 创建一个新对象，避免修改原对象
      const newMapping = {...mapping};
      
      // 确保 key 是数组格式
      if (!Array.isArray(newMapping.key)) {
        if (typeof newMapping.key === 'string') {
          if (newMapping.key.includes(',')) {
            newMapping.key = newMapping.key.split(',').map(k => k.trim()).filter(k => k);
          } else if (newMapping.key.trim()) {
            newMapping.key = [newMapping.key.trim()];
          } else {
            newMapping.key = [];
          }
        } else {
          newMapping.key = [];
        }
      }
      
      return newMapping;
    });
    
    const jsonData = JSON.stringify(exportMappings, null, 2);
    
    copyToClipboard(jsonData)
      .then(() => {
        showToast('JSON 数据已复制到剪贴板');
      })
      .catch(err => {
        console.error('复制失败: ', err);
        showToast('复制失败，请手动复制');
      });
  } catch (e) {
    console.error('生成 JSON 失败: ', e);
    showToast('操作失败，请稍后重试');
  }
}

// 解析 Markdown 内容为映射数据
function parseMarkdown(markdown) {
  const result = [];
  const sections = markdown.split(/^#\s*/m).filter(Boolean);
  
  for (const section of sections) {
    const lines = section.split('\n');
    const firstLine = lines[0].trim();
    
    const isRequired = firstLine.includes('[required]');
    let keyStr = firstLine.replace('[required]', '').trim();
    
    // 将逗号分隔的字符串转为键名数组
    const keyArray = keyStr.split(',').map(k => k.trim()).filter(k => k);
    
    // 找到描述部分（不在代码块中的第一段文字）
    let description = '';
    let i = 1;
    while (i < lines.length && !lines[i].startsWith('```')) {
      if (lines[i].trim()) {
        if (description) description += '\n';
        description += lines[i].trim();
      }
      i++;
    }
    
    // 代码块变量
    let sourceLanguage = 'php';
    let targetLanguage = 'typescript';
    let sourceCode = '';
    let targetCode = '';
    
    let codeBlocks = [];
    let currentBlock = null;
    
    // 收集所有代码块
    for (let j = i; j < lines.length; j++) {
      const line = lines[j];
      
      if (line.startsWith('```')) {
        if (currentBlock) {
          // 结束一个代码块
          codeBlocks.push(currentBlock);
          currentBlock = null;
        } else {
          // 开始一个新代码块
          const langMatch = line.match(/^```(.+)$/);
          if (langMatch) {
            currentBlock = {
              language: langMatch[1].trim(),
              code: ''
            };
          } else {
            currentBlock = {
              language: '',
              code: ''
            };
          }
        }
      } else if (currentBlock) {
        // 添加代码行
        currentBlock.code += line + '\n';
      }
    }
    
    // 确保最后一个代码块也被添加
    if (currentBlock) {
      codeBlocks.push(currentBlock);
    }
    
    // 分配代码块到源代码和目标代码
    if (codeBlocks.length >= 1) {
      sourceLanguage = codeBlocks[0].language || 'php';
      sourceCode = codeBlocks[0].code.trim();
    }
    
    if (codeBlocks.length >= 2) {
      targetLanguage = codeBlocks[1].language || 'typescript';
      targetCode = codeBlocks[1].code.trim();
    }
    
    result.push({
      key: keyArray, // 存储为数组
      isRequired,
      description,
      sourceLanguage,
      targetLanguage,
      sourceCode,
      targetCode
    });
  }
  
  return result;
}

// 加载示例数据
function loadExampleData() {
  const exampleMarkdown = ``;

  mappings = parseMarkdown(exampleMarkdown);
  localStorage.setItem('code-map-mappings', JSON.stringify(mappings));
  renderMappingList();
}

// 添加拖拽排序功能
function initDragAndDrop() {
  // 在映射项上添加dragstart和dragend事件监听器，而不是在document上
  // 这样可以更精确地控制哪个元素可以拖拽
  document.querySelectorAll('.mapping-item').forEach(item => {
    // 禁用内容的可选择性，避免拖拽时选中文字
    item.querySelectorAll('.mapping-title span:not(.drag-handle)').forEach(span => {
      span.style.userSelect = 'none';
    });
    
    // 找到拖动手柄
    const dragHandle = item.querySelector('.drag-handle');
    if (dragHandle) {
      // 只给拖动手柄添加拖拽事件，而不是整个映射项
      dragHandle.addEventListener('mousedown', function(e) {
        // 确保其他所有项目都不可拖拽
        document.querySelectorAll('.mapping-item').forEach(el => {
          el.setAttribute('draggable', 'false');
        });
        
        // 标记这个映射项为可拖拽
        item.setAttribute('draggable', 'true');
      });
      
      item.addEventListener('dragstart', function(e) {
        // 确保拖拽开始时，只有当前元素有dragging类
        document.querySelectorAll('.mapping-item.dragging').forEach(el => {
          if (el !== item) {
            el.classList.remove('dragging');
            el.style.opacity = '1';
          }
        });
        
        e.dataTransfer.setData('text/plain', this.dataset.index);
        this.classList.add('dragging');
        
        // 添加视觉反馈
        setTimeout(() => {
          this.style.opacity = '0.4';
        }, 0);
        
        // 设置拖拽图像为透明，使用自定义样式显示
        const dragImage = document.createElement('div');
        dragImage.style.position = 'absolute';
        dragImage.style.top = '-9999px';
        document.body.appendChild(dragImage);
        e.dataTransfer.setDragImage(dragImage, 0, 0);
        
        // 拖拽结束后移除临时元素
        setTimeout(() => {
          document.body.removeChild(dragImage);
        }, 0);
      });
      
      item.addEventListener('dragend', function(e) {
        // 拖拽结束后立即设置为不可拖拽
        this.setAttribute('draggable', 'false');
        this.classList.remove('dragging');
        this.style.opacity = '1';
      });
    }
  });
  
  // 全局mouseup事件，确保在任何情况下，如果鼠标释放，就停止所有拖拽状态
  document.addEventListener('mouseup', function() {
    document.querySelectorAll('.mapping-item').forEach(item => {
      item.setAttribute('draggable', 'false');
    });
  });
  
  // 拖拽过程中的处理
  document.addEventListener('dragover', function(e) {
    e.preventDefault();
    const draggedItem = document.querySelector('.mapping-item.dragging');
    if (draggedItem) {
      const container = document.getElementById('mapping-list');
      const items = Array.from(container.querySelectorAll('.mapping-item:not(.dragging)'));
      
      // 添加可见的拖放指示线
      const placeholder = document.getElementById('drag-placeholder');
      if (!placeholder) {
        const newPlaceholder = document.createElement('div');
        newPlaceholder.id = 'drag-placeholder';
        newPlaceholder.className = 'drag-placeholder';
        container.appendChild(newPlaceholder);
      }
      
      // 查找应该放置的位置
      const afterElement = getDragAfterElement(container, e.clientY, items);
      
      // 移动指示线到目标位置
      const currentPlaceholder = document.getElementById('drag-placeholder');
      if (currentPlaceholder) {
        if (afterElement) {
          container.insertBefore(currentPlaceholder, afterElement);
        } else {
          container.appendChild(currentPlaceholder);
        }
      }
    }
  });
  
  // 处理拖放完成
  document.addEventListener('drop', function(e) {
    e.preventDefault();
    const draggedItem = document.querySelector('.mapping-item.dragging');
    const placeholder = document.getElementById('drag-placeholder');
    
    if (draggedItem && placeholder) {
      const container = document.getElementById('mapping-list');
      
      // 移动元素到最终位置
      container.insertBefore(draggedItem, placeholder);
      placeholder.remove();
      
      // 重新排序数据数组
      const newMappings = [];
      document.querySelectorAll('.mapping-item').forEach(item => {
        const index = parseInt(item.dataset.index);
        newMappings.push(mappings[index]);
        item.dataset.index = newMappings.length - 1;
      });
      
      mappings = newMappings;
      localStorage.setItem('code-map-mappings', JSON.stringify(mappings));
      
      // 显示提示
      showToast('列表排序已更新');
    }
    
    // 移除所有拖拽状态和占位符
    document.querySelectorAll('.mapping-item').forEach(item => {
      item.classList.remove('dragging');
      item.style.opacity = '1';
      item.setAttribute('draggable', 'false');
    });
    
    if (placeholder) {
      placeholder.remove();
    }
  });
}

// 辅助函数：获取拖动后应该放置的元素
function getDragAfterElement(container, y, items) {
  // 根据Y坐标找到最近的下一个元素
  return items.reduce((closest, item) => {
    const box = item.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    
    if (offset < 0 && offset > closest.offset) {
      return { offset: offset, element: item };
    } else {
      return closest;
    }
  }, { offset: Number.NEGATIVE_INFINITY }).element;
}

// 渲染代码高亮
function renderCodeHighlight(code, language) {
  // 确保我们有代码需要高亮
  if (!code || typeof code !== 'string') {
    console.warn('没有有效的代码需要高亮');
    const fallbackEl = document.createElement('pre');
    fallbackEl.textContent = code || '';
    return fallbackEl;
  }

  try {
    // 创建一个临时元素来渲染高亮代码
    const tempEl = document.createElement('pre');
    tempEl.className = '';
    
    const codeEl = document.createElement('code');
    codeEl.className = `language-${language}`;
    codeEl.textContent = code;
    
    tempEl.appendChild(codeEl);
    
    // 检查highlight.js是否正确加载
    if (isHighlightJsLoaded) {
      try {
        // 使用highlight.js进行高亮处理
        hljs.highlightElement(codeEl);
      } catch (err) {
        console.error('代码高亮错误，使用纯文本显示:', err);
      }
    } else {
      console.log('highlight.js未加载，使用纯文本显示');
    }
    
    return tempEl;
  } catch (e) {
    console.error('渲染代码高亮错误:', e);
    // 发生错误时返回未高亮的代码
    const fallbackEl = document.createElement('pre');
    fallbackEl.textContent = code;
    return fallbackEl;
  }
}

// 打开代码编辑模态框
function openCodeEditModal(index, type) {
  if (!codeEditModal) {
    console.error('无法找到代码编辑模态框元素');
    return;
  }

  const mapping = mappings[index];
  if (!mapping) {
    console.error('无法找到对应索引的映射数据:', index);
    return;
  }

  currentEditState.index = index;
  currentEditState.type = type || 'both'; // 默认为both类型
  
  // 设置标题，显示键名和描述
  const keyDisplay = Array.isArray(mapping.key) ? mapping.key.join(', ') : 
                  (typeof mapping.key === 'string' ? mapping.key : '');
  const titleDisplay = mapping.description || '未命名映射';
  
  // 更新模态框标题
  if (codeEditTitle) {
    codeEditTitle.textContent = `编辑: ${titleDisplay}`;
  }
  
  // 使用最新的DOM引用
  const sourceEditLanguage = document.getElementById('source-edit-language');
  const sourceEditContent = document.getElementById('source-edit-content');
  const targetEditLanguage = document.getElementById('target-edit-language');
  const targetEditContent = document.getElementById('target-edit-content');
  
  if (!sourceEditLanguage || !sourceEditContent || !targetEditLanguage || !targetEditContent) {
    console.error('无法找到编辑区域元素');
    return;
  }
  
  // 添加更多元数据信息显示及编辑
  const metadataDisplay = document.createElement('div');
  metadataDisplay.className = 'edit-metadata';

  // 处理键名显示并添加编辑字段
  const keyArray = Array.isArray(mapping.key) ? mapping.key : 
                 (keyDisplay.includes(',') ? keyDisplay.split(',').map(k => k.trim()).filter(k => k) : [keyDisplay]);
  
  // 创建映射元数据编辑区域
  metadataDisplay.innerHTML = `
    <div class="edit-metadata-form">
      <div class="form-group">
        <label for="edit-mapping-key">键名（用逗号分隔多个键名）</label>
        <input type="text" id="edit-mapping-key" value="${keyArray.join(', ')}" class="form-control">
      </div>
      
      <div class="form-group">
        <div class="checkbox-wrapper">
          <input type="checkbox" id="edit-is-required" ${mapping.isRequired ? 'checked' : ''}>
          <label for="edit-is-required">标记为必需</label>
        </div>
      </div>
      
      <div class="form-group">
        <label for="edit-description">描述</label>
        <textarea id="edit-description" class="form-control">${mapping.description || ''}</textarea>
      </div>
    </div>
  `;
  
  // 插入到标题下方
  const headerElement = codeEditModal.querySelector('.modal-header');
  const existingMetadata = codeEditModal.querySelector('.edit-metadata');
  
  if (existingMetadata) {
    existingMetadata.remove();
  }
  
  if (headerElement) {
    headerElement.insertAdjacentElement('afterend', metadataDisplay);
  }
  
  // 加载源代码和目标代码
  sourceEditLanguage.value = mapping.sourceLanguage || 'php';
  sourceEditContent.value = mapping.sourceCode || '';
  
  targetEditLanguage.value = mapping.targetLanguage || 'typescript';
  targetEditContent.value = mapping.targetCode || '';
  
  // 根据编辑类型设置显示
  const sourceSection = document.getElementById('source-edit-section');
  const targetSection = document.getElementById('target-edit-section');
  
  if (sourceSection && targetSection) {
    if (type === 'source') {
      sourceSection.style.display = 'block';
      targetSection.style.display = 'none';
      setTimeout(() => sourceEditContent.focus(), 100);
    } else if (type === 'target') {
      sourceSection.style.display = 'none';
      targetSection.style.display = 'block';
      setTimeout(() => targetEditContent.focus(), 100);
    } else {
      // both类型时显示两个区域
      sourceSection.style.display = 'block';
      targetSection.style.display = 'block';
      
      // 先聚焦到描述字段
      const descField = document.getElementById('edit-description');
      if (descField) {
        setTimeout(() => descField.focus(), 100);
      }
    }
  }
  
  // 保存按钮引用，并确保其事件监听器已绑定
  saveCodeEditBtn = document.getElementById('save-code-edit');
  if (saveCodeEditBtn) {
    // 先移除可能已存在的事件监听器，避免重复绑定
    saveCodeEditBtn.removeEventListener('click', saveCodeEdit);
    saveCodeEditBtn.addEventListener('click', saveCodeEdit);
  }
  
  // 显示模态框
  codeEditModal.style.display = 'flex';
}

// 保存代码编辑
function saveCodeEdit() {
  const { index, type } = currentEditState;
  
  // 获取最新的DOM引用
  const sourceEditLanguage = document.getElementById('source-edit-language');
  const sourceEditContent = document.getElementById('source-edit-content');
  const targetEditLanguage = document.getElementById('target-edit-language');
  const targetEditContent = document.getElementById('target-edit-content');
  
  // 获取元数据编辑字段
  const editMappingKey = document.getElementById('edit-mapping-key');
  const editIsRequired = document.getElementById('edit-is-required');
  const editDescription = document.getElementById('edit-description');
  
  // 检查必要元素是否存在
  if (!sourceEditLanguage || !sourceEditContent || !targetEditLanguage || !targetEditContent) {
    console.error('保存失败: 无法找到编辑器元素');
    showToast('保存失败: 系统错误');
    return;
  }
  
  if (index >= 0 && index < mappings.length) {
    const mapping = mappings[index];
    
    // 保存元数据
    if (editMappingKey && editIsRequired && editDescription) {
      // 处理键名，转换为数组格式
      const keyValue = editMappingKey.value;
      let keyArray = [];
      
      if (keyValue.includes(',')) {
        // 拆分逗号分隔的键名并去除每个键名周围的空格
        keyArray = keyValue.split(',').map(k => k.trim()).filter(k => k);
      } else if (keyValue.trim()) {
        // 单个键名也转为数组
        keyArray = [keyValue.trim()];
      }
      
      mapping.key = keyArray;
      mapping.isRequired = editIsRequired.checked;
      mapping.description = editDescription.value;
    }
    
    // 根据当前编辑类型保存相应的代码
    if (type === 'source' || type === 'both') {
      mapping.sourceLanguage = sourceEditLanguage.value;
      mapping.sourceCode = sourceEditContent.value;
    }
    
    if (type === 'target' || type === 'both') {
      mapping.targetLanguage = targetEditLanguage.value;
      mapping.targetCode = targetEditContent.value;
    }
    
    // 保存到 localStorage
    localStorage.setItem('code-map-mappings', JSON.stringify(mappings));
    
    // 关闭模态框
    codeEditModal.style.display = 'none';
    
    // 重新渲染列表
    renderMappingList();
    
    // 如果是从展开项编辑的，保持其展开状态
    const editedItem = document.querySelector(`.mapping-item[data-index="${index}"]`);
    if (editedItem) {
      editedItem.classList.add('expanded');
    }
    
    // 显示成功提示
    showToast('保存成功');
  } else {
    console.error('保存失败: 无效的索引', index);
    showToast('保存失败: 无效的数据索引');
  }
}

// 编辑映射
function editMapping(index) {
  // 调用代码编辑模态框，使用both类型表示编辑两侧代码
  openCodeEditModal(index, 'both');
}

// 辅助函数：转义HTML
function escapeHtml(unsafe) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// 显示提示消息
function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);
  
  // 强制重绘后添加show类
  setTimeout(() => {
    toast.classList.add('show');
  }, 10);
  
  // 3秒后隐藏
  setTimeout(() => {
    toast.classList.remove('show');
    // 隐藏动画结束后移除元素
    setTimeout(() => {
      document.body.removeChild(toast);
    }, 300);
  }, 3000);
}

// 实现一个兼容的复制到剪贴板函数
function copyToClipboard(text) {
  // 首先尝试使用navigator.clipboard API（现代浏览器支持）
  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    return navigator.clipboard.writeText(text)
      .then(() => {
        return Promise.resolve(true);
      })
      .catch((err) => {
        console.warn('Clipboard API失败，尝试备用方法:', err);
        return fallbackCopyToClipboard(text);
      });
  } else {
    // 备用方法
    return fallbackCopyToClipboard(text);
  }
}

// 备用复制方法，通过创建临时DOM元素实现
function fallbackCopyToClipboard(text) {
  return new Promise((resolve, reject) => {
    try {
      // 创建一个临时textarea元素
      const textArea = document.createElement('textarea');
      textArea.value = text;
      
      // 设置样式使元素不可见
      textArea.style.position = 'fixed';
      textArea.style.top = '0';
      textArea.style.left = '0';
      textArea.style.width = '2em';
      textArea.style.height = '2em';
      textArea.style.padding = '0';
      textArea.style.border = 'none';
      textArea.style.outline = 'none';
      textArea.style.boxShadow = 'none';
      textArea.style.background = 'transparent';
      textArea.style.opacity = '0';
      
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      
      // 执行复制命令
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      
      if (successful) {
        resolve(true);
      } else {
        console.warn('document.execCommand("copy")失败');
        reject(new Error('复制失败'));
      }
    } catch (err) {
      console.error('复制到剪贴板失败:', err);
      reject(err);
    }
  });
}

// 预览导入的JSON数据
function previewImportedJson() {
  try {
    const jsonData = importJsonData.value.trim();
    if (!jsonData) {
      showToast('请输入有效的 JSON 数据');
      return;
    }
    
    // 尝试解析JSON数据
    const parsedData = JSON.parse(jsonData);
    
    // 格式化JSON以便更好地显示
    const formattedJson = JSON.stringify(parsedData, null, 2);
    
    // 创建预览模态框
    const previewModal = document.createElement('div');
    previewModal.className = 'modal json-preview-modal';
    previewModal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h2>JSON 数据预览</h2>
          <button class="close-modal">&times;</button>
        </div>
        <div class="preview-container">
          <div class="preview-header">
            <button class="btn btn-sm btn-primary copy-content-btn">
              <span class="copy-icon">📋</span> 复制内容
            </button>
          </div>
          <div class="preview-text">
            <pre>${escapeHtml(formattedJson)}</pre>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-primary confirm-import-json">确认导入</button>
        </div>
      </div>
    `;
    
    // 添加到页面
    document.body.appendChild(previewModal);
    
    // 显示模态框
    previewModal.style.display = 'flex';
    
    // 绑定关闭按钮事件
    const closeBtn = previewModal.querySelector('.close-modal');
    if (closeBtn) {
      closeBtn.addEventListener('click', function() {
        previewModal.style.display = 'none';
        document.body.removeChild(previewModal);
      });
    }
    
    // 绑定复制按钮事件
    const copyBtn = previewModal.querySelector('.copy-content-btn');
    if (copyBtn) {
      copyBtn.addEventListener('click', function() {
        copyToClipboard(formattedJson)
          .then(() => {
            showToast('JSON 数据已复制到剪贴板');
            copyBtn.innerHTML = '<span class="copy-icon">✓</span> 已复制';
            copyBtn.classList.add('copied');
            
            setTimeout(() => {
              copyBtn.innerHTML = '<span class="copy-icon">📋</span> 复制内容';
              copyBtn.classList.remove('copied');
            }, 3000);
          })
          .catch(err => {
            console.error('复制失败: ', err);
            showToast('复制失败，请手动复制');
          });
      });
    }
    
    // 绑定确认导入按钮事件
    const confirmBtn = previewModal.querySelector('.confirm-import-json');
    if (confirmBtn) {
      confirmBtn.addEventListener('click', function() {
        // 关闭预览模态框
        previewModal.style.display = 'none';
        document.body.removeChild(previewModal);
        
        // 执行导入操作
        importJson();
      });
    }
    
  } catch (e) {
    console.error('预览JSON数据失败: ', e);
    showToast('JSON 解析失败: ' + e.message);
  }
} 