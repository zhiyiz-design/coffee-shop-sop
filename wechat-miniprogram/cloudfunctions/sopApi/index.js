const cloud = require('wx-server-sdk');
const { DEFAULT_DRINKS } = require('./default-drinks');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const COLLECTION = 'coffee_sop_drinks';
const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 36;
const LINE_HEIGHT = 16;

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

function pdfText(text, x, y, size) {
  return `BT /F1 ${size} Tf 1 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)} Tm <${toUtf16Hex(text)}> Tj ET\n`;
}

function pdfLine(x1, y1, x2, y2) {
  return `0.82 0.82 0.82 RG ${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S\n`;
}

function pdfHeader(pageNumber) {
  let content = '0.14 0.38 0.23 rg 0 796 595.28 45 re f\n';
  content += '1 1 1 rg\n';
  content += pdfText('咖啡店 SOP 标准操作手册', MARGIN, 814, 15);
  content += '0.42 0.42 0.42 rg\n';
  content += pdfText('第 ' + pageNumber + ' 页', PAGE_WIDTH - 82, 814, 9);
  content += '0 0 0 rg\n';
  return content;
}

function buildPdfPages(drinks) {
  const pages = [];
  let pageNumber = 1;
  let content = pdfHeader(pageNumber);
  let y = 768;

  function newPage() {
    pages.push(content);
    pageNumber += 1;
    content = pdfHeader(pageNumber);
    y = 768;
  }

  function ensureSpace(height) {
    if (y - height < MARGIN) newPage();
  }

  function addWrapped(text, x, fontSize, maxWidth, options = {}) {
    const lines = wrapText(text, fontSize, maxWidth);
    const lineHeight = options.lineHeight || fontSize + 4;
    ensureSpace(lines.length * lineHeight + 4);
    lines.forEach(line => {
      content += pdfText(line, x, y, fontSize);
      y -= lineHeight;
    });
  }

  content += pdfText('导出时间：' + new Date().toISOString().slice(0, 10), MARGIN, y, 9);
  y -= 28;

  normalizeData(drinks).forEach((drink, drinkIndex) => {
    ensureSpace(105);
    content += '0.94 0.97 0.94 rg ' + MARGIN + ' ' + (y - 7).toFixed(2) + ' ' + (PAGE_WIDTH - MARGIN * 2) + ' 24 re f\n';
    content += '0.10 0.26 0.16 rg\n';
    content += pdfText((drinkIndex + 1) + '. ' + drink.name + '  ' + drink.price, MARGIN + 8, y, 14);
    content += '0 0 0 rg\n';
    y -= 30;

    content += pdfText('原料配方', MARGIN, y, 11);
    y -= 18;
    (drink.ingredients || []).forEach(ingredient => {
      const amount = ingredient.amount ? '：' + ingredient.amount : '';
      addWrapped('· ' + ingredient.name + amount, MARGIN + 12, 10.5, PAGE_WIDTH - MARGIN * 2 - 12);
    });

    y -= 4;
    content += pdfText('制作步骤', MARGIN, y, 11);
    y -= 18;
    (drink.steps || []).forEach((step, index) => {
      addWrapped((index + 1) + '. ' + step, MARGIN + 12, 10.5, PAGE_WIDTH - MARGIN * 2 - 12);
    });

    if ((drink.notes || []).length) {
      y -= 4;
      content += pdfText('注意事项', MARGIN, y, 11);
      y -= 18;
      (drink.notes || []).forEach(note => {
        addWrapped('! ' + note, MARGIN + 12, 10.5, PAGE_WIDTH - MARGIN * 2 - 12);
      });
    }

    y -= 12;
    content += pdfLine(MARGIN, y, PAGE_WIDTH - MARGIN, y);
    y -= 20;
  });

  pages.push(content);
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
  let nextId = 6;

  objects[catalogId] = pdfObject(catalogId, `<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
  objects[fontId] = pdfObject(fontId, `<< /Type /Font /Subtype /Type0 /BaseFont /STSong-Light /Encoding /UniGB-UCS2-H /DescendantFonts [${cidFontId} 0 R] >>`);
  objects[cidFontId] = pdfObject(cidFontId, `<< /Type /Font /Subtype /CIDFontType0 /BaseFont /STSong-Light /CIDSystemInfo << /Registry (Adobe) /Ordering (GB1) /Supplement 2 >> /FontDescriptor ${descriptorId} 0 R /DW 1000 >>`);
  objects[descriptorId] = pdfObject(descriptorId, '<< /Type /FontDescriptor /FontName /STSong-Light /Flags 6 /FontBBox [-25 -254 1000 880] /ItalicAngle 0 /Ascent 880 /Descent -120 /CapHeight 880 /StemV 80 >>');

  pageContents.forEach(content => {
    const pageId = nextId;
    const streamId = nextId + 1;
    nextId += 2;
    pageRefs.push(`${pageId} 0 R`);
    const streamBuffer = Buffer.from(content, 'utf8');
    objects[pageId] = pdfObject(pageId, `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${streamId} 0 R >>`);
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
