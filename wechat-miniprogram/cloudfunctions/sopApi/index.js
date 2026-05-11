const cloud = require('wx-server-sdk');
const { DEFAULT_DRINKS } = require('./default-drinks');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const COLLECTION = 'coffee_sop_drinks';
const PAGE_WIDTH = 841.89;
const PAGE_HEIGHT = 595.28;
const MARGIN = 28;

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

function pdfLine(x1, y1, x2, y2, color = '0.55 0.42 0.27', width = 1) {
  return `${color} RG ${width} w ${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S\n`;
}

function pdfRect(x, y, width, height, color) {
  return `${color} rg ${x.toFixed(2)} ${y.toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re f\n`;
}

function pdfStrokeRect(x, y, width, height, color = '0.42 0.27 0.16', lineWidth = 2) {
  return `${color} RG ${lineWidth} w ${x.toFixed(2)} ${y.toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re S\n`;
}

function buildPdfPages(drinks) {
  const pages = [];
  const source = normalizeData(drinks);
  let pageNumber = 0;
  let content = '';

  function startPosterPage() {
    if (content) pages.push(content);
    pageNumber += 1;
    content = '';
    content += pdfRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, '0.72 0.85 0.77');
    content += pdfRect(24, 22, PAGE_WIDTH - 48, PAGE_HEIGHT - 44, '0.98 0.94 0.84');
    content += pdfStrokeRect(24, 22, PAGE_WIDTH - 48, PAGE_HEIGHT - 44, '0.42 0.27 0.16', 3);
  }

  function addIngredientRow(ingredient, rowIndex, x, y, width) {
    const name = ingredient.name || '';
    const amount = ingredient.amount || '';
    const rowHeight = 27;
    if (rowIndex % 2 === 0) {
      content += pdfRect(x, y - 20, width, rowHeight, '0.96 0.90 0.78');
    }
    content += pdfText(name, x + 12, y - 2, 12.5, '0.42 0.27 0.16');
    if (amount) {
      content += pdfText(amount, x + width - 118, y - 2, 13, '0.20 0.38 0.28');
    }
    return y - rowHeight;
  }

  function addStepBlock(step, index, x, y, width) {
    const lines = wrapText(step, 14, width - 64);
    const rowHeight = Math.max(44, lines.length * 18 + 17);
    content += pdfRect(x + 50, y - rowHeight + 8, width - 50, rowHeight, '1 0.96 0.88');
    content += pdfRect(x, y - 30, 34, 34, '0.50 0.36 0.22');
    content += pdfStrokeRect(x, y - 30, 34, 34, '0.42 0.27 0.16', 2);
    content += pdfText(String(index + 1), x + 11, y - 10, 15, '1 1 1');
    lines.forEach((line, lineIndex) => {
      content += pdfText(line, x + 68, y - 11 - lineIndex * 18, 14, '0.42 0.27 0.16');
    });
    return y - rowHeight - 8;
  }

  function addSectionTitle(title, x, y) {
    content += pdfText(title, x, y, 18, '0.42 0.27 0.16');
    content += pdfLine(x, y - 7, x + 190, y - 7, '0.68 0.50 0.31', 1);
  }

  function addNoteBox(note, x, y, width) {
    const lines = wrapText(note, 13, width - 110);
    const boxHeight = Math.max(46, lines.length * 18 + 20);
    content += pdfRect(x, y - boxHeight + 8, width, boxHeight, '1 0.89 0.73');
    content += pdfStrokeRect(x, y - boxHeight + 8, width, boxHeight, '0.83 0.45 0.36', 2);
    content += pdfRect(x + 18, y - 25, 58, 24, '0.83 0.45 0.36');
    content += pdfText('! 注意', x + 29, y - 9, 12, '1 1 1');
    lines.forEach((line, lineIndex) => {
      content += pdfText(line, x + 92, y - 8 - lineIndex * 18, 13, '0.42 0.27 0.16');
    });
  }

  source.forEach((drink, drinkIndex) => {
    startPosterPage();
    const cardX = 52;
    const cardRight = PAGE_WIDTH - 54;
    const topY = 520;

    content += pdfText(drink.name, cardX, topY, 30, '0.42 0.27 0.16');
    content += pdfRect(cardX + 390, topY - 12, 58, 24, '0.83 0.45 0.36');
    content += pdfText(drink.price, cardX + 406, topY + 3, 14, '1 1 1');
    content += pdfText('SOP-' + String(drink.id).padStart(3, '0') + ' · page ' + (drinkIndex + 1) + ' of ' + source.length, cardX, topY - 30, 13, '0.55 0.42 0.27');
    content += pdfLine(cardX, topY - 48, cardRight, topY - 48, '0.50 0.36 0.22', 2);

    const leftX = cardX;
    const imageY = 283;
    content += pdfRect(leftX, imageY, 240, 166, '0.79 0.57 0.39');
    content += pdfStrokeRect(leftX, imageY, 240, 166, '0.50 0.36 0.22', 2);
    content += pdfRect(leftX + 57, imageY + 42, 126, 82, '0.93 0.80 0.58');
    content += pdfText('drink photo', leftX + 80, imageY + 86, 18, '1 1 1');
    content += pdfText(drink.emoji || 'cat', leftX + 105, imageY + 57, 18, '0.42 0.27 0.16');

    content += pdfRect(leftX, 180, 240, 78, '1 0.91 0.77');
    content += pdfStrokeRect(leftX, 180, 240, 78, '0.78 0.61 0.40', 1);
    content += pdfText('key facts:', leftX + 14, 236, 13, '0.55 0.42 0.27');
    content += pdfText('饮品编号', leftX + 14, 212, 13, '0.42 0.27 0.16');
    content += pdfText('SOP-' + String(drink.id).padStart(3, '0'), leftX + 146, 212, 13, '0.42 0.27 0.16');
    content += pdfText('更新时间', leftX + 14, 192, 13, '0.42 0.27 0.16');
    content += pdfText(new Date().toISOString().slice(0, 10), leftX + 146, 192, 13, '0.42 0.27 0.16');

    const rightX = 315;
    const rightW = 470;
    addSectionTitle('Ingredients · 原料配方', rightX + 20, 458);
    content += pdfRect(rightX, 416, rightW, 26, '0.89 0.78 0.58');
    content += pdfStrokeRect(rightX, 416, rightW, 26, '0.68 0.50 0.31', 1);
    content += pdfText('item', rightX + 12, 424, 12, '0.42 0.27 0.16');
    content += pdfText('amount', rightX + rightW - 112, 424, 12, '0.42 0.27 0.16');
    let ingredientY = 391;
    (drink.ingredients || []).slice(0, 8).forEach((ingredient, rowIndex) => {
      ingredientY = addIngredientRow(ingredient, rowIndex, rightX, ingredientY, rightW);
    });

    let stepTitleY = Math.max(ingredientY - 12, 156);
    addSectionTitle('Steps · 制作步骤', rightX + 20, stepTitleY);
    let stepY = stepTitleY - 28;
    (drink.steps || []).slice(0, 4).forEach((step, stepIndex) => {
      stepY = addStepBlock(step, stepIndex, rightX, stepY, rightW);
    });

    const notes = drink.notes || [];
    if (notes.length) {
      addNoteBox(notes[0], cardX, 70, cardRight - cardX);
    }

    content += pdfLine(cardX, 58, cardRight, 58, '0.78 0.61 0.40', 1);
    content += pdfText('prepared by: __________', cardX, 36, 12, '0.55 0.42 0.27');
    content += pdfText('date: __________', cardX + 210, 36, 12, '0.55 0.42 0.27');
    content += pdfText('月白的厨房秘诀 · 咖啡店 SOP 手册', cardRight - 220, 36, 12, '0.55 0.42 0.27');
  });

  if (content) pages.push(content);
  if (!pages.length) {
    startPosterPage();
    content += pdfText('暂无 SOP 数据', 54, 510, 22, '0.42 0.27 0.16');
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
  objects[latinFontId] = pdfObject(latinFontId, '<< /Type /Font /Subtype /Type1 /BaseFont /Times-Roman >>');

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
