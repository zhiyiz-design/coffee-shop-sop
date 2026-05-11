const cloud = require('wx-server-sdk');
const { DEFAULT_DRINKS } = require('./default-drinks');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const COLLECTION = 'coffee_sop_drinks';
const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const COLORS = {
  mint: '0.72 0.85 0.77',
  mintDark: '0.62 0.76 0.67',
  paper: '0.98 0.94 0.84',
  card: '1 0.97 0.90',
  cream: '1 0.92 0.78',
  creamLight: '1 0.96 0.88',
  coffee: '0.42 0.27 0.16',
  coffeeLight: '0.55 0.42 0.27',
  stroke: '0.50 0.36 0.22',
  gold: '0.78 0.61 0.40',
  salmon: '0.83 0.45 0.36',
  green: '0.64 0.78 0.67',
  greenText: '0.19 0.36 0.27'
};

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

function cleanPdfText(text) {
  return String(text || '')
    .replace(/[\uD800-\uDFFF]/g, '')
    .replace(/(\d+)\s*[°℃]\s*C?/gi, '$1度')
    .replace(/[·•]/g, ' / ')
    .replace(/[~～]/g, '-')
    .replace(/[✨⭐️]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function textWidth(text, fontSize) {
  return cleanPdfText(text).split('').reduce((total, char) => {
    const code = char.charCodeAt(0);
    if (char === ' ') return total + fontSize * 0.3;
    if (code < 128) return total + fontSize * 0.55;
    return total + fontSize;
  }, 0);
}

function wrapText(text, fontSize, maxWidth) {
  const source = cleanPdfText(text);
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
  const safe = cleanPdfText(text);
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
  return cleanPdfText(text).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function splitTextSegments(text) {
  const segments = [];
  let current = '';
  let latin = null;
  cleanPdfText(text).split('').forEach(char => {
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

function pdfTextCentered(text, centerX, y, size, color = '0 0 0') {
  return pdfText(text, centerX - textWidth(text, size) / 2, y, size, color);
}

function pdfTextRight(text, rightX, y, size, color = '0 0 0') {
  return pdfText(text, rightX - textWidth(text, size), y, size, color);
}

function pdfLine(x1, y1, x2, y2, color = '0.55 0.42 0.27', width = 1) {
  return `${color} RG ${width} w ${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S\n`;
}

function pdfDashedLine(x1, y1, x2, y2, color = COLORS.gold, width = 1) {
  return `${color} RG ${width} w [5 5] 0 d ${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S [] 0 d\n`;
}

function pdfRect(x, y, width, height, color) {
  return `${color} rg ${x.toFixed(2)} ${y.toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re f\n`;
}

function pdfStrokeRect(x, y, width, height, color = '0.42 0.27 0.16', lineWidth = 2) {
  return `${color} RG ${lineWidth} w ${x.toFixed(2)} ${y.toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re S\n`;
}

function pdfCircle(cx, cy, radius, fillColor, strokeColor, lineWidth = 1) {
  const k = 0.5522847498;
  const c = radius * k;
  let content = `${cx.toFixed(2)} ${(cy + radius).toFixed(2)} m `;
  content += `${(cx + c).toFixed(2)} ${(cy + radius).toFixed(2)} ${(cx + radius).toFixed(2)} ${(cy + c).toFixed(2)} ${(cx + radius).toFixed(2)} ${cy.toFixed(2)} c `;
  content += `${(cx + radius).toFixed(2)} ${(cy - c).toFixed(2)} ${(cx + c).toFixed(2)} ${(cy - radius).toFixed(2)} ${cx.toFixed(2)} ${(cy - radius).toFixed(2)} c `;
  content += `${(cx - c).toFixed(2)} ${(cy - radius).toFixed(2)} ${(cx - radius).toFixed(2)} ${(cy - c).toFixed(2)} ${(cx - radius).toFixed(2)} ${cy.toFixed(2)} c `;
  content += `${(cx - radius).toFixed(2)} ${(cy + c).toFixed(2)} ${(cx - c).toFixed(2)} ${(cy + radius).toFixed(2)} ${cx.toFixed(2)} ${(cy + radius).toFixed(2)} c `;
  if (fillColor && strokeColor) return `${fillColor} rg ${strokeColor} RG ${lineWidth} w ${content} B\n`;
  if (fillColor) return `${fillColor} rg ${content} f\n`;
  return `${strokeColor || COLORS.coffee} RG ${lineWidth} w ${content} S\n`;
}

function pdfImage(name, asset, x, y, width, height) {
  if (!name || !asset) return '';
  const scale = Math.max(width / asset.width, height / asset.height);
  const drawWidth = asset.width * scale;
  const drawHeight = asset.height * scale;
  const drawX = x + (width - drawWidth) / 2;
  const drawY = y + (height - drawHeight) / 2;
  return [
    'q',
    `${x.toFixed(2)} ${y.toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re W n`,
    `${drawWidth.toFixed(2)} 0 0 ${drawHeight.toFixed(2)} ${drawX.toFixed(2)} ${drawY.toFixed(2)} cm`,
    `/${name} Do`,
    'Q\n'
  ].join('\n');
}

function priceText(price) {
  return cleanPdfText(price || '¥--').replace(/\s/g, '');
}

function sopId(drink) {
  return 'SOP-' + String(drink.id).padStart(3, '0');
}

function todayText() {
  return new Date().toISOString().slice(0, 10);
}

function drawPhotoBox(drink, imageAsset, x, y, size) {
  let content = '';
  content += pdfRect(x, y, size, size, '0.79 0.57 0.39');
  content += pdfStrokeRect(x, y, size, size, COLORS.stroke, 2);
  if (imageAsset) {
    content += pdfImage(imageAsset.name, imageAsset, x + 7, y + 7, size - 14, size - 14);
    content += pdfStrokeRect(x + 7, y + 7, size - 14, size - 14, '1 0.97 0.90', 2);
    return content;
  }

  const centerX = x + size / 2;
  const centerY = y + size / 2 + 3;
  content += pdfCircle(centerX, centerY, 43, '0.92 0.82 0.65', '1 1 1', 5);
  content += pdfCircle(centerX - 15, centerY + 4, 3.5, COLORS.coffee);
  content += pdfCircle(centerX + 15, centerY + 4, 3.5, COLORS.coffee);
  content += pdfCircle(centerX, centerY - 7, 2.6, COLORS.gold);
  content += pdfLine(centerX - 9, centerY - 16, centerX, centerY - 24, COLORS.coffee, 2);
  content += pdfLine(centerX, centerY - 24, centerX + 9, centerY - 16, COLORS.coffee, 2);
  content += pdfLine(centerX - 39, centerY - 3, centerX - 17, centerY - 6, COLORS.coffee, 1.4);
  content += pdfLine(centerX + 17, centerY - 6, centerX + 39, centerY - 3, COLORS.coffee, 1.4);
  return content;
}

function addImageAsset(assets, drinkId, parsedImage) {
  if (!parsedImage) return;
  const name = 'Im' + (Object.keys(assets).length + 1);
  assets[String(drinkId)] = Object.assign({ name }, parsedImage);
}

function parseJpeg(buffer) {
  if (!buffer || buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;
  let offset = 2;
  while (offset < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = buffer[offset + 1];
    if (marker === 0xd9 || marker === 0xda) break;
    const length = buffer.readUInt16BE(offset + 2);
    if (marker >= 0xc0 && marker <= 0xc3) {
      return {
        data: buffer,
        width: buffer.readUInt16BE(offset + 7),
        height: buffer.readUInt16BE(offset + 5),
        filter: '/DCTDecode',
        colorSpace: '/DeviceRGB',
        bits: 8
      };
    }
    offset += 2 + length;
  }
  return null;
}

function parsePng(buffer) {
  const signature = '89504e470d0a1a0a';
  if (!buffer || buffer.length < 33 || buffer.slice(0, 8).toString('hex') !== signature) return null;
  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idatParts = [];
  while (offset + 8 < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.slice(offset + 4, offset + 8).toString('ascii');
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    if (type === 'IHDR') {
      width = buffer.readUInt32BE(dataStart);
      height = buffer.readUInt32BE(dataStart + 4);
      bitDepth = buffer[dataStart + 8];
      colorType = buffer[dataStart + 9];
    } else if (type === 'IDAT') {
      idatParts.push(buffer.slice(dataStart, dataEnd));
    } else if (type === 'IEND') {
      break;
    }
    offset = dataEnd + 4;
  }

  if (!width || !height || bitDepth !== 8 || !idatParts.length) return null;
  if (colorType !== 0 && colorType !== 2) return null;
  const colors = colorType === 2 ? 3 : 1;
  return {
    data: Buffer.concat(idatParts),
    width,
    height,
    filter: '/FlateDecode',
    colorSpace: colorType === 2 ? '/DeviceRGB' : '/DeviceGray',
    bits: bitDepth,
    decodeParms: `<< /Predictor 15 /Colors ${colors} /BitsPerComponent ${bitDepth} /Columns ${width} >>`
  };
}

function parseImage(buffer) {
  return parseJpeg(buffer) || parsePng(buffer);
}

async function loadImageAssets(drinks) {
  const assets = {};
  await Promise.all(normalizeData(drinks).map(async drink => {
    if (!drink.img || !/^cloud:\/\//.test(drink.img)) return;
    try {
      const result = await cloud.downloadFile({ fileID: drink.img });
      addImageAsset(assets, drink.id, parseImage(result.fileContent));
    } catch (error) {
      console.warn('饮品图片读取失败，PDF 将使用占位图。', drink.name, error);
    }
  }));
  return assets;
}

function buildPdfPages(drinks, imageAssets = {}) {
  const pages = [];
  const source = normalizeData(drinks);
  let current = null;
  let content = '';
  let pageNumber = 0;
  let cursorY = 0;
  const paperX = 32;
  const paperY = 24;
  const paperW = PAGE_WIDTH - paperX * 2;
  const paperH = PAGE_HEIGHT - paperY * 2;
  const contentX = 58;
  const contentW = PAGE_WIDTH - contentX * 2;
  const bottomY = 72;

  function usedXObjectNames() {
    const names = [];
    source.forEach(drink => {
      const asset = imageAssets[String(drink.id)];
      if (asset && asset.name && names.indexOf(asset.name) === -1) names.push(asset.name);
    });
    return names;
  }

  function finishPage() {
    if (!current) return;
    content += pdfDashedLine(contentX, 62, contentX + contentW, 62, COLORS.gold, 1);
    content += pdfText('prepared by: __________', contentX, 39, 11.5, COLORS.coffeeLight);
    content += pdfText('date: __________', contentX + 190, 39, 11.5, COLORS.coffeeLight);
    content += pdfTextRight('月白的厨房秘诀 / 咖啡店 SOP 手册', contentX + contentW, 39, 11.5, COLORS.coffeeLight);
    current.content = content;
    current.xobjects = usedXObjectNames();
    pages.push(current);
    current = null;
    content = '';
  }

  function drawPageShell(drink, drinkIndex, continuation) {
    pageNumber += 1;
    current = { content: '', xobjects: [] };
    content = '';
    content += pdfRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, COLORS.mint);
    for (let y = 96; y < 790; y += 86) {
      content += pdfCircle(15, y, 3, COLORS.mintDark);
      content += pdfCircle(581, y + 34, 3, COLORS.mintDark);
    }
    content += pdfRect(paperX, paperY, paperW, paperH, COLORS.paper);
    content += pdfStrokeRect(paperX, paperY, paperW, paperH, COLORS.coffee, 3);
    content += pdfTextCentered('月白的厨房秘诀', PAGE_WIDTH / 2, 800, 27, COLORS.coffee);
    content += pdfTextCentered('咖啡店 SOP 手册', PAGE_WIDTH / 2, 778, 13, COLORS.coffeeLight);
    content += pdfLine(218, 768, 377, 768, COLORS.gold, 1.4);
    content += pdfDashedLine(paperX + 20, 752, paperX + paperW - 20, 752, COLORS.gold, 1);

    if (continuation) {
      content += pdfText(drink.name + ' / 续页', contentX, 716, 21, COLORS.coffee);
      content += pdfText(sopId(drink) + ' / 第 ' + (drinkIndex + 1) + ' 款 / 总 ' + source.length + ' 款', contentX, 691, 12, COLORS.coffeeLight);
      content += pdfLine(contentX, 674, contentX + contentW, 674, COLORS.stroke, 1.6);
      cursorY = 642;
      return;
    }

    content += pdfStrokeRect(contentX, 570, contentW, 160, COLORS.stroke, 2);
    content += pdfRect(contentX + 2, 572, contentW - 4, 156, COLORS.card);
    drawHero(drink, drinkIndex);
    cursorY = 538;
  }

  function drawHero(drink, drinkIndex) {
    const imageAsset = imageAssets[String(drink.id)];
    content += drawPhotoBox(drink, imageAsset, contentX + 18, 595, 106);
    const nameLines = wrapText(drink.name, 22, 300).slice(0, 2);
    nameLines.forEach((line, index) => {
      content += pdfText(line, contentX + 145, 684 - index * 26, 22, COLORS.coffee);
    });
    const price = priceText(drink.price);
    const priceW = Math.max(54, textWidth(price, 13) + 22);
    content += pdfRect(contentX + 145, 620, priceW, 23, COLORS.salmon);
    content += pdfTextCentered(price, contentX + 145 + priceW / 2, 627, 13, '1 1 1');
    content += pdfText(sopId(drink) + ' / 第 ' + (drinkIndex + 1) + ' 款 / 总 ' + source.length + ' 款', contentX + 145, 596, 11.5, COLORS.coffeeLight);
    content += pdfText('更新：' + todayText(), contentX + 145, 576, 11.5, COLORS.coffeeLight);
  }

  function startDrinkPage(drink, drinkIndex, continuation) {
    finishPage();
    drawPageShell(drink, drinkIndex, continuation);
  }

  function ensureSpace(height, drink, drinkIndex) {
    if (cursorY - height >= bottomY) return;
    startDrinkPage(drink, drinkIndex, true);
  }

  function drawSectionTitle(chinese, english, drink, drinkIndex) {
    ensureSpace(35, drink, drinkIndex);
    content += pdfText(english, contentX, cursorY, 15.5, COLORS.coffee);
    content += pdfText(' / ' + chinese, contentX + textWidth(english, 15.5) + 8, cursorY, 15.5, COLORS.coffee);
    content += pdfLine(contentX, cursorY - 7, contentX + 158, cursorY - 7, COLORS.gold, 1.1);
    cursorY -= 25;
  }

  function drawIngredient(ingredient, rowIndex, drink, drinkIndex) {
    const name = ingredient.name || '';
    const amount = ingredient.amount || '';
    const nameLines = wrapText(name, 13.5, contentW - 145);
    const rowHeight = Math.max(28, nameLines.length * 16 + 10);
    ensureSpace(rowHeight + 4, drink, drinkIndex);
    const rowY = cursorY - rowHeight + 5;
    if (rowIndex % 2 === 0) content += pdfRect(contentX, rowY, contentW, rowHeight, COLORS.creamLight);
    content += pdfCircle(contentX + 12, cursorY - 10, 3.2, COLORS.gold);
    nameLines.forEach((line, index) => {
      content += pdfText(line, contentX + 28, cursorY - 15 - index * 16, 13.5, COLORS.coffee);
    });
    if (amount) {
      const pillW = Math.max(48, textWidth(amount, 12.5) + 18);
      content += pdfRect(contentX + contentW - pillW - 8, cursorY - 23, pillW, 18, COLORS.green);
      content += pdfTextCentered(amount, contentX + contentW - pillW / 2 - 8, cursorY - 18, 12.5, COLORS.greenText);
    }
    cursorY -= rowHeight;
  }

  function drawStep(step, stepIndex, drink, drinkIndex) {
    const lines = wrapText(step, 13.5, contentW - 80);
    const blockHeight = Math.max(42, lines.length * 17 + 18);
    ensureSpace(blockHeight + 6, drink, drinkIndex);
    content += pdfCircle(contentX + 18, cursorY - 20, 15, COLORS.stroke, COLORS.coffee, 2);
    content += pdfTextCentered(String(stepIndex + 1), contentX + 18, cursorY - 25, 13.5, '1 1 1');
    content += pdfRect(contentX + 48, cursorY - blockHeight + 5, contentW - 48, blockHeight, COLORS.creamLight);
    content += pdfLine(contentX + 48, cursorY - blockHeight + 5, contentX + 48, cursorY + 5, COLORS.gold, 3);
    lines.forEach((line, index) => {
      content += pdfText(line, contentX + 64, cursorY - 15 - index * 17, 13.5, COLORS.coffee);
    });
    cursorY -= blockHeight + 6;
  }

  function drawNote(note, drink, drinkIndex) {
    const lines = wrapText(note, 14.5, contentW - 116);
    const boxHeight = Math.max(50, lines.length * 19 + 23);
    ensureSpace(boxHeight + 12, drink, drinkIndex);
    content += pdfRect(contentX, cursorY - boxHeight + 8, contentW, boxHeight, '1 0.89 0.73');
    content += pdfStrokeRect(contentX, cursorY - boxHeight + 8, contentW, boxHeight, COLORS.salmon, 2);
    content += pdfRect(contentX + 18, cursorY - 28, 62, 24, COLORS.salmon);
    content += pdfTextCentered('! 注意', contentX + 49, cursorY - 21, 12.5, '1 1 1');
    lines.forEach((line, index) => {
      content += pdfText(line, contentX + 98, cursorY - 18 - index * 19, 14.5, COLORS.coffee);
    });
    cursorY -= boxHeight + 14;
  }

  source.forEach((drink, drinkIndex) => {
    startDrinkPage(drink, drinkIndex, false);

    drawSectionTitle('原料配方', 'Ingredients', drink, drinkIndex);
    (drink.ingredients || []).forEach((ingredient, rowIndex) => {
      drawIngredient(ingredient, rowIndex, drink, drinkIndex);
    });

    cursorY -= 8;
    drawSectionTitle('制作步骤', 'Steps', drink, drinkIndex);
    (drink.steps || []).forEach((step, stepIndex) => {
      drawStep(step, stepIndex, drink, drinkIndex);
    });

    const notes = drink.notes || [];
    if (notes.length) {
      cursorY -= 2;
      notes.forEach(note => drawNote(note, drink, drinkIndex));
    }
  });

  finishPage();
  if (!pages.length) {
    drawPageShell({ id: 0, name: '暂无 SOP 数据', price: '' }, 0, true);
    content += pdfText('暂无 SOP 数据', 58, 620, 22, COLORS.coffee);
    finishPage();
  }
  return pages;
}

function pdfObject(id, body) {
  return `${id} 0 obj\n${body}\nendobj\n`;
}

function pdfStreamObject(id, dictionary, buffer) {
  return Buffer.concat([
    Buffer.from(`${id} 0 obj\n${dictionary}\nstream\n`, 'utf8'),
    buffer,
    Buffer.from('\nendstream\nendobj\n', 'utf8')
  ]);
}

function createPdfBuffer(drinks, imageAssets = {}) {
  const pageContents = buildPdfPages(drinks, imageAssets);
  const objects = [];
  const pageRefs = [];
  const catalogId = 1;
  const pagesId = 2;
  const fontId = 3;
  const cidFontId = 4;
  const descriptorId = 5;
  const latinFontId = 6;
  let nextId = 7;
  const imageRefs = {};

  objects[catalogId] = pdfObject(catalogId, `<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
  objects[fontId] = pdfObject(fontId, `<< /Type /Font /Subtype /Type0 /BaseFont /STSong-Light /Encoding /UniGB-UCS2-H /DescendantFonts [${cidFontId} 0 R] >>`);
  objects[cidFontId] = pdfObject(cidFontId, `<< /Type /Font /Subtype /CIDFontType0 /BaseFont /STSong-Light /CIDSystemInfo << /Registry (Adobe) /Ordering (GB1) /Supplement 2 >> /FontDescriptor ${descriptorId} 0 R /DW 1000 >>`);
  objects[descriptorId] = pdfObject(descriptorId, '<< /Type /FontDescriptor /FontName /STSong-Light /Flags 6 /FontBBox [-25 -254 1000 880] /ItalicAngle 0 /Ascent 880 /Descent -120 /CapHeight 880 /StemV 80 >>');
  objects[latinFontId] = pdfObject(latinFontId, '<< /Type /Font /Subtype /Type1 /BaseFont /Times-Roman >>');

  Object.keys(imageAssets).forEach(key => {
    const asset = imageAssets[key];
    if (!asset || !asset.name || !asset.data) return;
    const imageId = nextId;
    nextId += 1;
    imageRefs[asset.name] = imageId;
    const decode = asset.decodeParms ? ` /DecodeParms ${asset.decodeParms}` : '';
    const dictionary = `<< /Type /XObject /Subtype /Image /Width ${asset.width} /Height ${asset.height} /ColorSpace ${asset.colorSpace} /BitsPerComponent ${asset.bits} /Filter ${asset.filter}${decode} /Length ${asset.data.length} >>`;
    objects[imageId] = pdfStreamObject(imageId, dictionary, asset.data);
  });

  pageContents.forEach(page => {
    const pageId = nextId;
    const streamId = nextId + 1;
    nextId += 2;
    pageRefs.push(`${pageId} 0 R`);
    const content = page.content || '';
    const streamBuffer = Buffer.from(content, 'utf8');
    const pageImages = (page.xobjects || [])
      .filter(name => imageRefs[name])
      .map(name => `/${name} ${imageRefs[name]} 0 R`)
      .join(' ');
    const xObjects = pageImages ? ` /XObject << ${pageImages} >>` : '';
    objects[pageId] = pdfObject(pageId, `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 ${fontId} 0 R /F2 ${latinFontId} 0 R >>${xObjects} >> /Contents ${streamId} 0 R >>`);
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
    chunks.push(Buffer.isBuffer(object.content) ? object.content : Buffer.from(object.content, 'utf8'));
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
  const imageAssets = await loadImageAssets(source);
  const pdfBuffer = createPdfBuffer(source, imageAssets);
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
