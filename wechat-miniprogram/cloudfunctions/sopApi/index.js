const cloud = require('wx-server-sdk');
const { DEFAULT_DRINKS } = require('./default-drinks');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const COLLECTION = 'coffee_sop_drinks';
const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 34;

function normalizeDrink(item, index) {
  const id = Number(item && item.id) || index + 1;
  return {
    id,
    sort: Number(item && item.sort) || id,
    emoji: item && item.emoji ? String(item.emoji) : '☕',
    name: item && item.name ? String(item.name) : `饮品 ${index + 1}`,
    price: item && item.price ? String(item.price) : '¥--',
    img: item && item.img ? String(item.img) : '',
    ingredients: Array.isArray(item && item.ingredients)
      ? item.ingredients.map(ing => ({
        name: String(ing && ing.name || ''),
        amount: String(ing && ing.amount || '')
      }))
      : [{ name: '', amount: '' }],
    steps: Array.isArray(item && item.steps)
      ? item.steps.map(step => String(step || ''))
      : [''],
    notes: Array.isArray(item && item.notes)
      ? item.notes.map(note => String(note || ''))
      : []
  };
}

function normalizeData(source) {
  const list = Array.isArray(source) ? source : [];
  return list
    .map(normalizeDrink)
    .sort((left, right) => {
      if (left.sort === right.sort) return left.id - right.id;
      return left.sort - right.sort;
    });
}

async function listDrinks() {
  const result = await db.collection(COLLECTION).orderBy('sort', 'asc').limit(100).get();
  return normalizeData(result.data || []);
}

async function seedIfEmpty() {
  const countResult = await db.collection(COLLECTION).count();
  if (countResult.total > 0) return;

  const tasks = normalizeData(DEFAULT_DRINKS).map(drink =>
    db.collection(COLLECTION).doc(String(drink.id)).set({ data: drink })
  );
  await Promise.all(tasks);
}

async function saveAll(drinks) {
  const normalized = normalizeData(drinks);
  const incomingIds = new Set(normalized.map(drink => String(drink.id)));
  const current = await db.collection(COLLECTION).limit(100).get();

  const writes = normalized.map(drink =>
    db.collection(COLLECTION).doc(String(drink.id)).set({ data: drink })
  );
  const deletes = (current.data || [])
    .filter(drink => !incomingIds.has(String(drink._id)))
    .map(drink => db.collection(COLLECTION).doc(String(drink._id)).remove());

  await Promise.all([...writes, ...deletes]);
  return normalized;
}

function textWidth(text, fontSize) {
  return String(text || '').split('').reduce((total, char) => {
    const code = char.charCodeAt(0);
    if (char === ' ') return total + fontSize * 0.3;
    if (code < 128) return total + fontSize * 0.55;
    return total + fontSize;
  }, 0);
}

function wrapText(text, fontSize, maxWidth) {
  const source = String(text || '');
  const lines = [];
  let line = '';
  source.split('').forEach(char => {
    const candidate = line + char;
    if (line && textWidth(candidate, fontSize) > maxWidth) {
      lines.push(line);
      line = char;
    } else {
      line = candidate;
    }
  });
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}

function toUtf16Hex(text) {
  const safe = String(text || '').replace(/[\uD800-\uDFFF]/g, '');
  const buffer = Buffer.from(safe, 'utf16le');
  const bytes = [];
  for (let index = 0; index < buffer.length; index += 2) {
    bytes.push(buffer[index + 1], buffer[index]);
  }
  return Buffer.from(bytes).toString('hex').toUpperCase();
}

function isLatinChar(char) {
  return char.charCodeAt(0) < 128;
}

function escapePdfLiteral(text) {
  return String(text || '').replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function splitTextSegments(text) {
  const segments = [];
  let current = '';
  let latin = null;
  String(text || '').split('').forEach(char => {
    const nextLatin = isLatinChar(char);
    if (latin === null || nextLatin === latin) {
      current += char;
      latin = nextLatin;
    } else {
      segments.push({ text: current, latin });
      current = char;
      latin = nextLatin;
    }
  });
  if (current) segments.push({ text: current, latin });
  return segments;
}

function pdfText(text, x, y, size, color = '0 0 0') {
  let content = `${color} rg\n`;
  let cursorX = x;
  splitTextSegments(text).forEach(segment => {
    const font = segment.latin ? 'F2' : 'F1';
    const payload = segment.latin
      ? `(${escapePdfLiteral(segment.text)})`
      : `<${toUtf16Hex(segment.text)}>`;
    content += `BT /${font} ${size} Tf 1 0 0 1 ${cursorX.toFixed(2)} ${y.toFixed(2)} Tm ${payload} Tj ET\n`;
    cursorX += textWidth(segment.text, size);
  });
  return content;
}

function pdfLine(x1, y1, x2, y2) {
  return `0.82 0.82 0.82 RG ${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S\n`;
}

function pdfRect(x, y, width, height, color) {
  return `${color} rg ${x.toFixed(2)} ${y.toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re f\n`;
}

function pdfHeader(pageNumber) {
  let content = pdfRect(0, 792, PAGE_WIDTH, 50, '0.14 0.38 0.23');
  content += pdfText('咖啡店 SOP 标准操作手册', MARGIN, 812, 16, '1 1 1');
  content += pdfText('第 ' + pageNumber + ' 页', PAGE_WIDTH - 86, 812, 10, '1 1 1');
  return content;
}

function buildPdfPages(drinks) {
  const pages = [];
  const source = normalizeData(drinks);
  let pageNumber = 0;
  let content = '';
  let y = 0;
  let currentDrink = '';

  function startPage(label) {
    if (content) pages.push(content);
    pageNumber += 1;
    content = pdfHeader(pageNumber);
    y = 758;
    if (label) {
      content += pdfText(label, MARGIN, y, 12, '0.35 0.38 0.35');
      y -= 24;
    }
  }

  function ensureSpace(height) {
    if (y - height < 52) startPage(currentDrink + '（续）');
  }

  function addSectionTitle(title) {
    ensureSpace(34);
    content += pdfText(title, MARGIN, y, 15, '0.14 0.38 0.23');
    y -= 18;
    content += pdfLine(MARGIN, y, PAGE_WIDTH - MARGIN, y);
    y -= 18;
  }

  function addIngredient(ingredient, rowIndex) {
    const name = ingredient.name || '';
    const amount = ingredient.amount || '';
    const rowHeight = 31;
    ensureSpace(rowHeight + 2);
    if (rowIndex % 2 === 0) {
      content += pdfRect(MARGIN, y - 21, PAGE_WIDTH - MARGIN * 2, rowHeight, '0.97 0.98 0.96');
    }
    content += pdfText(name, MARGIN + 12, y - 3, 12.5, '0.12 0.16 0.13');
    if (amount) {
      content += pdfText(amount, PAGE_WIDTH - MARGIN - 118, y - 3, 12.5, '0.14 0.38 0.23');
    }
    y -= rowHeight;
  }

  function addStep(step, index) {
    const lines = wrapText(step, 13, PAGE_WIDTH - MARGIN * 2 - 58);
    const rowHeight = Math.max(46, lines.length * 18 + 16);
    ensureSpace(rowHeight + 4);
    content += pdfRect(MARGIN, y - rowHeight + 8, 34, 34, '0.14 0.38 0.23');
    content += pdfText(String(index + 1), MARGIN + 11, y - 14, 14, '1 1 1');
    lines.forEach((line, lineIndex) => {
      content += pdfText(line, MARGIN + 52, y - 10 - lineIndex * 18, 13, '0.12 0.16 0.13');
    });
    y -= rowHeight;
  }

  function addNote(note) {
    const lines = wrapText(note, 12.5, PAGE_WIDTH - MARGIN * 2 - 30);
    const boxHeight = Math.max(38, lines.length * 18 + 18);
    ensureSpace(boxHeight + 6);
    content += pdfRect(MARGIN, y - boxHeight + 8, PAGE_WIDTH - MARGIN * 2, boxHeight, '1 0.96 0.87');
    content += pdfRect(MARGIN, y - boxHeight + 8, 7, boxHeight, '0.78 0.47 0.12');
    content += pdfText('注意：', MARGIN + 16, y - 14, 12.5, '0.42 0.29 0.08');
    lines.forEach((line, lineIndex) => {
      content += pdfText(line, MARGIN + 58, y - 14 - lineIndex * 18, 12.5, '0.42 0.29 0.08');
    });
    y -= boxHeight + 4;
  }

  source.forEach((drink, drinkIndex) => {
    currentDrink = drink.name;
    startPage('');

    content += pdfText('导出时间：' + new Date().toISOString().slice(0, 10), MARGIN, y, 10.5, '0.42 0.45 0.42');
    y -= 30;
    content += pdfRect(MARGIN, y - 70, PAGE_WIDTH - MARGIN * 2, 76, '0.93 0.97 0.94');
    content += pdfRect(MARGIN, y - 70, 58, 76, '0.14 0.38 0.23');
    content += pdfText(String(drinkIndex + 1).padStart(2, '0'), MARGIN + 14, y - 27, 21, '1 1 1');
    content += pdfText(drink.name, MARGIN + 76, y - 12, 22, '0.08 0.18 0.11');
    content += pdfText(drink.price, MARGIN + 78, y - 43, 16, '0.56 0.35 0.08');
    y -= 104;

    addSectionTitle('原料配方');
    (drink.ingredients || []).forEach(addIngredient);

    y -= 12;
    addSectionTitle('制作步骤');
    (drink.steps || []).forEach(addStep);

    if ((drink.notes || []).length) {
      y -= 12;
      addSectionTitle('注意事项');
      (drink.notes || []).forEach(addNote);
    }
  });

  if (content) pages.push(content);
  if (!pages.length) {
    startPage('');
    content += pdfText('暂无 SOP 数据', MARGIN, y, 18, '0.14 0.38 0.23');
    pages.push(content);
  }
  return pages;
}

function pdfObject(id, body) {
  return `${id} 0 obj\n${body}\nendobj\n`;
}

function createPdfBuffer(drinks) {
  const pageContents = buildPdfPages(drinks);
  const objects = [];
  const pageRefs = [];
  const catalogId = 1;
  const pagesId = 2;
  const fontId = 3;
  const cidFontId = 4;
  const descriptorId = 5;
  const latinFontId = 6;
  let nextId = 7;

  objects[catalogId] = pdfObject(catalogId, `<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
  objects[fontId] = pdfObject(fontId, `<< /Type /Font /Subtype /Type0 /BaseFont /STSong-Light /Encoding /UniGB-UCS2-H /DescendantFonts [${cidFontId} 0 R] >>`);
  objects[cidFontId] = pdfObject(cidFontId, `<< /Type /Font /Subtype /CIDFontType0 /BaseFont /STSong-Light /CIDSystemInfo << /Registry (Adobe) /Ordering (GB1) /Supplement 2 >> /FontDescriptor ${descriptorId} 0 R /DW 1000 >>`);
  objects[descriptorId] = pdfObject(descriptorId, '<< /Type /FontDescriptor /FontName /STSong-Light /Flags 6 /FontBBox [-25 -254 1000 880] /ItalicAngle 0 /Ascent 880 /Descent -120 /CapHeight 880 /StemV 80 >>');
  objects[latinFontId] = pdfObject(latinFontId, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');

  pageContents.forEach(content => {
    const pageId = nextId;
    const streamId = nextId + 1;
    nextId += 2;
    pageRefs.push(`${pageId} 0 R`);
    const streamBuffer = Buffer.from(content, 'utf8');
    objects[pageId] = pdfObject(pageId, `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 ${fontId} 0 R /F2 ${latinFontId} 0 R >> >> /Contents ${streamId} 0 R >>`);
    objects[streamId] = `${streamId} 0 obj\n<< /Length ${streamBuffer.length} >>\nstream\n${content}endstream\nendobj\n`;
  });

  objects[pagesId] = pdfObject(pagesId, `<< /Type /Pages /Kids [${pageRefs.join(' ')}] /Count ${pageRefs.length} >>`);

  const orderedObjects = [];
  for (let id = 1; id < objects.length; id += 1) {
    if (objects[id]) orderedObjects.push({ id, content: objects[id] });
  }

  const chunks = [Buffer.from('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n', 'binary')];
  const offsets = [0];
  orderedObjects.forEach(object => {
    offsets[object.id] = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    chunks.push(Buffer.from(object.content, 'utf8'));
  });

  const xrefOffset = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  let xref = `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id += 1) {
    const offset = offsets[id] || 0;
    xref += `${String(offset).padStart(10, '0')} 00000 n \n`;
  }
  xref += `trailer\n<< /Size ${objects.length} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  chunks.push(Buffer.from(xref, 'utf8'));
  return Buffer.concat(chunks);
}

async function exportPdf(drinks) {
  const source = Array.isArray(drinks) && drinks.length ? normalizeData(drinks) : await listDrinks();
  const pdfBuffer = createPdfBuffer(source);
  const stamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
  const result = await cloud.uploadFile({
    cloudPath: `exports/coffee-sop-${stamp}.pdf`,
    fileContent: pdfBuffer
  });
  return {
    fileID: result.fileID,
    count: source.length
  };
}

exports.main = async event => {
  const action = event && event.action;

  if (action === 'list') {
    await seedIfEmpty();
    return { drinks: await listDrinks() };
  }

  if (action === 'saveAll') {
    const drinks = await saveAll(event.drinks);
    return { ok: true, count: drinks.length };
  }

  if (action === 'exportPdf') {
    return exportPdf(event.drinks);
  }

  return { ok: false, message: 'Unknown action' };
};
