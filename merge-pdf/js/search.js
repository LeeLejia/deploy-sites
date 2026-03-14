const SearchEngine = {
  documents: [],

  addDocument(doc) {
    const idx = this.documents.findIndex(d => d.id === doc.id);
    if (idx >= 0) {
      this.documents[idx] = doc;
    } else {
      this.documents.push(doc);
    }
  },

  removeDocument(id) {
    this.documents = this.documents.filter(d => d.id !== id);
  },

  search(query) {
    if (!query || !query.trim()) return [];
    const q = query.trim().toLowerCase();
    const keywords = q.split(/\s+/).filter(Boolean);

    return this.documents
      .map(doc => {
        const nameL = (doc.name || '').toLowerCase();
        const textL = (doc.text || '').toLowerCase();
        const pathL = (doc.path || '').toLowerCase();

        const matched = keywords.every(kw =>
          nameL.includes(kw) || textL.includes(kw) || pathL.includes(kw)
        );
        if (!matched) return null;

        let score = 0;
        keywords.forEach(kw => {
          if (nameL.includes(kw)) score += 10;
          if (pathL.includes(kw)) score += 3;
          if (textL.includes(kw)) score += 1;
        });

        return {
          ...doc,
          score,
          snippet: this._getSnippet(doc.text, keywords)
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score);
  },

  _getSnippet(text, keywords) {
    if (!text) return '';
    const textL = text.toLowerCase();
    let bestIdx = -1;

    for (const kw of keywords) {
      const idx = textL.indexOf(kw);
      if (idx !== -1) { bestIdx = idx; break; }
    }

    if (bestIdx === -1) return text.substring(0, 120);

    const start = Math.max(0, bestIdx - 50);
    const end = Math.min(text.length, bestIdx + 80);
    let snippet = '';
    if (start > 0) snippet += '...';
    snippet += text.substring(start, end);
    if (end < text.length) snippet += '...';
    return snippet;
  },

  highlightSnippet(snippet, query) {
    if (!snippet || !query) return snippet || '';
    const keywords = query.trim().split(/\s+/).filter(Boolean);
    let result = this._escapeHtml(snippet);

    keywords.forEach(kw => {
      const regex = new RegExp(this._escapeRegex(kw), 'gi');
      result = result.replace(regex, '<mark>$&</mark>');
    });

    return result;
  },

  _escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },

  _escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  },

  clear() {
    this.documents = [];
  }
};
