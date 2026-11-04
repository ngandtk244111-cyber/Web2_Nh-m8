/**
 * Nội dung bài lưu dạng markdown rút gọn mà my-client đọc (pages/news parseContent):
 * dòng "### " là tiêu đề, "- " là gạch đầu dòng, **chữ** là in đậm, dòng trống ngăn đoạn.
 * Trình soạn Quill làm việc với HTML nên đổi qua lại ở đây.
 */

function escape(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function inlineToHtml(text: string): string {
  return text.split('**').map((part, i) => (i % 2 === 1 ? `<strong>${escape(part)}</strong>` : escape(part))).join('');
}

export function markdownToHtml(content: string): string {
  const html: string[] = [];
  let para: string[] = [];
  let list: string[] = [];
  const flushPara = () => {
    if (para.length) html.push(`<p>${inlineToHtml(para.join(' '))}</p>`);
    para = [];
  };
  const flushList = () => {
    if (list.length) html.push(`<ul>${list.map(i => `<li>${inlineToHtml(i)}</li>`).join('')}</ul>`);
    list = [];
  };
  for (const raw of (content || '').split('\n')) {
    const line = raw.trim();
    if (!line) { flushPara(); flushList(); continue; }
    if (line.startsWith('### ')) {
      flushPara(); flushList();
      html.push(`<h3>${inlineToHtml(line.slice(4))}</h3>`);
    } else if (line.startsWith('- ')) {
      flushPara();
      list.push(line.slice(2));
    } else {
      flushList();
      para.push(line);
    }
  }
  flushPara(); flushList();
  return html.join('');
}

function inlineToMarkdown(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return (node.textContent || '').replace(/\s+/g, ' ');
  if (!(node instanceof HTMLElement)) return '';
  if (node.tagName === 'BR') return ' ';
  const inner = Array.from(node.childNodes).map(inlineToMarkdown).join('');
  if ((node.tagName === 'STRONG' || node.tagName === 'B') && inner.trim()) return `**${inner.trim()}**`;
  return inner;
}

export function htmlToMarkdown(html: string): string {
  const doc = new DOMParser().parseFromString(html || '', 'text/html');
  const blocks: string[] = [];
  for (const el of Array.from(doc.body.children)) {
    const tag = el.tagName;
    if (tag === 'UL' || tag === 'OL') {
      const items = Array.from(el.querySelectorAll('li')).map(li => '- ' + inlineToMarkdown(li).trim()).filter(i => i !== '- ');
      if (items.length) blocks.push(items.join('\n'));
      continue;
    }
    const text = inlineToMarkdown(el).trim();
    if (!text) continue;
    blocks.push(/^H[1-6]$/.test(tag) ? '### ' + text.replace(/\*\*/g, '') : text);
  }
  return blocks.join('\n\n');
}
