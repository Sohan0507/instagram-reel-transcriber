import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';

/**
 * Parses rich HTML content from Tiptap editor and exports it as a formatted .docx file.
 */
export async function exportToDocx(htmlContent: string, fileName: string = 'transcript.docx') {
  if (typeof window === 'undefined') return;

  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = htmlContent;

  const children: Paragraph[] = [];

  // Helper to parse text nodes and extract inline formatting (bold, italic)
  const parseTextNode = (node: Node): TextRun[] => {
    const runs: TextRun[] = [];
    
    const traverse = (child: Node, format: { bold?: boolean; italics?: boolean }) => {
      if (child.nodeType === Node.TEXT_NODE) {
        if (child.textContent) {
          runs.push(new TextRun({
            text: child.textContent,
            bold: format.bold,
            italics: format.italics,
            font: 'Arial',
            size: 24, // 12pt
          }));
        }
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        const el = child as HTMLElement;
        const currentFormat = { ...format };
        
        if (el.tagName === 'STRONG' || el.tagName === 'B') {
          currentFormat.bold = true;
        }
        if (el.tagName === 'EM' || el.tagName === 'I') {
          currentFormat.italics = true;
        }
        
        el.childNodes.forEach(grandChild => traverse(grandChild, currentFormat));
      }
    };
    
    node.childNodes.forEach(child => traverse(child, {}));
    return runs;
  };

  tempDiv.childNodes.forEach((node) => {
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as HTMLElement;

    switch (el.tagName) {
      case 'H1':
        children.push(new Paragraph({
          text: el.textContent || '',
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 240, after: 120 },
        }));
        break;
      case 'H2':
        children.push(new Paragraph({
          text: el.textContent || '',
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 200, after: 100 },
        }));
        break;
      case 'BLOCKQUOTE':
        children.push(new Paragraph({
          children: parseTextNode(el),
          indent: { left: 720 }, // 0.5 inch indent
          spacing: { before: 120, after: 120 },
        }));
        break;
      case 'UL':
        el.querySelectorAll('li').forEach((li) => {
          children.push(new Paragraph({
            children: parseTextNode(li),
            bullet: { level: 0 },
            spacing: { before: 60, after: 60 },
          }));
        });
        break;
      case 'OL':
        // Simulating ordered list numbering since simple bullet is safer but numbering is better
        let index = 1;
        el.querySelectorAll('li').forEach((li) => {
          const prefixRun = new TextRun({
            text: `${index++}.  `,
            bold: true,
            font: 'Arial',
            size: 24,
          });
          children.push(new Paragraph({
            children: [prefixRun, ...parseTextNode(li)],
            spacing: { before: 60, after: 60 },
          }));
        });
        break;
      case 'P':
      default:
        children.push(new Paragraph({
          children: parseTextNode(el),
          spacing: { after: 120 },
        }));
        break;
    }
  });

  // If no elements parsed, fallback to simple paragraph
  if (children.length === 0) {
    children.push(new Paragraph({
      text: tempDiv.textContent || '',
    }));
  }

  const doc = new Document({
    sections: [{
      properties: {},
      children: children,
    }],
  });

  const blob = await Packer.toBlob(doc);
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}

/**
 * Converts HTML from Tiptap editor and downloads it as a plain .txt file.
 */
export function exportToTxt(htmlContent: string, fileName: string = 'transcript.txt') {
  if (typeof window === 'undefined') return;

  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = htmlContent;
  
  // Format headings and blocks nicely with line breaks
  tempDiv.querySelectorAll('h1, h2').forEach((el) => {
    el.innerHTML = `\n\n${el.textContent.toUpperCase()}\n====================\n`;
  });
  tempDiv.querySelectorAll('p').forEach((el) => {
    el.innerHTML = `${el.innerHTML}\n\n`;
  });
  tempDiv.querySelectorAll('li').forEach((el) => {
    el.innerHTML = `• ${el.textContent}\n`;
  });
  
  const text = tempDiv.textContent || '';
  
  const blob = new Blob([text.trim()], { type: 'text/plain;charset=utf-8' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}
