const cloud = require('wx-server-sdk');
const path = require('path');
const { DEFAULT_DRINKS } = require('./default-drinks');

let PDFDocument = null;

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const COLLECTION = 'coffee_sop_drinks';
const HISTORY_LIMIT = 12;

// ============================================================
// 数据规范化
// ============================================================

function normalizeIngredient(ing) {
  if (!ing || typeof ing !== 'object') return { name: '', amount: '', note: '' };
  return {
    name: String(ing.name || ''),
    amount: String(ing.amount || ''),
    note: String(ing.note || '')
  };
}

function normalizeDrink(item, index) {
  const id = Number(item && item.id) || index + 1;
  return {
    id,
    sort: Number(item && item.sort) || id,
    emoji: item && item.emoji ? String(item.emoji) : '☕',
    name: item && item.name ? String(item.name) : `饮品 ${index + 1}`,
    nameEn: item && item.nameEn ? String(item.nameEn) : '',
    series: item && item.series ? String(item.series) : '',
    price: item && item.price ? String(item.price) : '¥--',
    img: item && item.img ? String(item.img) : '',
    sopCode: item && item.sopCode ? String(item.sopCode) : '',
    version: item && item.version ? String(item.version) : '',
    volume: item && item.volume ? String(item.volume) : '',
    waterTemp: item && item.waterTemp ? String(item.waterTemp) : '',
    duration: item && item.duration ? String(item.duration) : '',
    cupType: item && item.cupType ? String(item.cupType) : '',
    videoUrl: item && item.videoUrl ? String(item.videoUrl) : '',
    ingredients: Array.isArray(item && item.ingredients)
      ? item.ingredients.map(normalizeIngredient)
      : [{ name: '', amount: '', note: '' }],
    steps: Array.isArray(item && item.steps)
      ? item.steps.map(step => String(step || ''))
      : [''],
    notes: Array.isArray(item && item.notes)
      ? item.notes.map(note => String(note || ''))
      : [],
    history: normalizeHistory(item && item.history)
  };
}

function normalizeHistory(history) {
  return (Array.isArray(history) ? history : [])
    .map(record => ({
      id: String(record && record.id || ''),
      action: String(record && record.action || '修改 SOP'),
      summary: String(record && record.summary || ''),
      nickName: String(record && record.nickName || '未设置昵称'),
      avatarUrl: String(record && record.avatarUrl || ''),
      openid: String(record && record.openid || ''),
      time: String(record && record.time || '')
    }))
    .filter(record => record.time)
    .slice(0, HISTORY_LIMIT);
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

function normalizeProfile(profile, wxContext) {
  return {
    openid: String(wxContext && wxContext.OPENID || ''),
    nickName: String(profile && profile.nickName || '').trim().slice(0, 24) || '未设置昵称',
    avatarUrl: String(profile && profile.avatarUrl || '').trim()
  };
}

function comparableDrink(drink) {
  const normalized = normalizeDrink(drink || {}, 0);
  delete normalized.history;
  return normalized;
}

function sameDrink(left, right) {
  return JSON.stringify(comparableDrink(left)) === JSON.stringify(comparableDrink(right));
}

function changedFields(previous, next) {
  if (!previous) return ['新增饮品'];
  const fields = [];
  if (String(previous.name || '') !== String(next.name || '')) fields.push('名称');
  if (String(previous.price || '') !== String(next.price || '')) fields.push('价格');
  if (String(previous.emoji || '') !== String(next.emoji || '')) fields.push('备用图标');
  if (String(previous.img || '') !== String(next.img || '')) fields.push('饮品照片');
  if (JSON.stringify(previous.ingredients || []) !== JSON.stringify(next.ingredients || [])) fields.push('原料');
  if (JSON.stringify(previous.steps || []) !== JSON.stringify(next.steps || [])) fields.push('步骤');
  if (JSON.stringify(previous.notes || []) !== JSON.stringify(next.notes || [])) fields.push('注意事项');
  return fields.length ? fields : ['SOP'];
}

function createHistoryRecord(previous, next, profile) {
  const fields = changedFields(previous, next);
  const isNew = !previous;
  return {
    id: String(Date.now()) + '-' + String(next.id),
    action: isNew ? '新增饮品' : '修改饮品',
    summary: isNew ? '新增了这款饮品' : '修改了' + fields.join('、'),
    nickName: profile.nickName,
    avatarUrl: profile.avatarUrl,
    openid: profile.openid,
    time: new Date().toISOString()
  };
}

async function saveAll(drinks, profile, wxContext) {
  const normalized = normalizeData(drinks);
  const incomingIds = new Set(normalized.map(drink => String(drink.id)));
  const current = await db.collection(COLLECTION).limit(100).get();
  const currentMap = {};
  (current.data || []).forEach(drink => {
    currentMap[String(drink.id || drink._id)] = normalizeDrink(drink, 0);
  });
  const editor = normalizeProfile(profile, wxContext);

  const savedDrinks = normalized.map(drink => {
    const previous = currentMap[String(drink.id)];
    const nextDrink = Object.assign({}, drink);
    const previousHistory = previous ? previous.history : normalizeHistory(drink.history);
    nextDrink.history = previousHistory;
    if (!previous || !sameDrink(previous, drink)) {
      nextDrink.history = [createHistoryRecord(previous, drink, editor)]
        .concat(previousHistory)
        .slice(0, HISTORY_LIMIT);
    }
    return nextDrink;
  });
  const writes = savedDrinks.map(drink =>
    db.collection(COLLECTION).doc(String(drink.id)).set({ data: drink })
  );
  const deletes = (current.data || [])
    .filter(drink => !incomingIds.has(String(drink._id)))
    .map(drink => db.collection(COLLECTION).doc(String(drink._id)).remove());

  await Promise.all([...writes, ...deletes]);
  return normalizeData(savedDrinks);
}

// ============================================================
// PDF 生成 — 基于 pdfkit
// ============================================================

const PAGE_W = 842;          // A4 横版宽（pt）
const PAGE_H = 595;          // A4 横版高
const MINT_BORDER = 17;      // ≈6mm 薄荷绿外框
const PAPER_PAD = 16;        // 内层米黄底距离外框边距

const COLORS = {
  mint: '#B8DDD0',
  paper: '#FAF1DC',
  brownDark: '#6B4A2A',
  brownMid: '#8B6F47',
  brownLight: '#A88860',
  brownStroke: '#C9A87C',
  rowAlt: '#FBF4E2',
  rowWhite: '#FFFFFF',
  tableHead: '#F0E2C8',
  highlight: '#FAE8C8',
  noteBg: '#FDF0DC',
  noteBorder: '#E0A050',
  noteLabelBg: '#F5C9A0',
  noteLabelText: '#C9784A',
  priceBg: '#E8B888',
  priceText: '#4A2C1A',
  photoBg: '#B89878',
  catFace: '#EBD3B0'
};

const FONT_DIR = path.join(__dirname, 'fonts');
const FONT_FILES = {
  enRegular: 'EBGaramond-Regular.ttf',
  enItalic: 'EBGaramond-Italic.ttf',
  enMedium: 'EBGaramond-Medium.ttf',
  enMediumItalic: 'EBGaramond-MediumItalic.ttf',
  cnRegular: 'NotoSerifSC-Regular.ttf',
  cnBold: 'NotoSerifSC-Bold.ttf'
};

function getPDFDocument() {
  if (!PDFDocument) {
    PDFDocument = require('pdfkit');
  }
  return PDFDocument;
}

// 字符是不是 "拉丁块"（英文/数字/常用 ASCII 标点） — 给段落分字体用
function isLatinChar(ch) {
  if (!ch) return false;
  const c = ch.charCodeAt(0);
  // ASCII 0-127、拉丁补充 0080-024F、广义标点 2000-206F、上下标 2070-209F、货币 20A0-20CF、字母符号 2100-214F、数字形式 2150-218F、箭头 2190-21FF、数学 2200-22FF、几何 25A0-25FF、其他符号 2600-26FF、装饰 2700-27BF
  if (c < 0x2E80) return true;
  return false;
}

// 把混合中英文文本切成连续段；同字体段连在一起，避免来回切换
function splitRuns(text) {
  const out = [];
  const str = String(text == null ? '' : text);
  let buf = '';
  let kind = null;
  for (const ch of str) {
    const k = isLatinChar(ch) ? 'en' : 'cn';
    if (kind === null || k === kind) {
      buf += ch;
      kind = k;
    } else {
      out.push({ text: buf, kind });
      buf = ch;
      kind = k;
    }
  }
  if (buf) out.push({ text: buf, kind });
  return out;
}

// 按 style 解析字体名
function fontNameFor(kind, style) {
  if (kind === 'en') {
    if (style === 'italic') return 'enItalic';
    if (style === 'bold') return 'enMedium';
    if (style === 'bold-italic') return 'enMediumItalic';
    return 'enRegular';
  }
  // 中文：italic 不存在，回落 regular；bold 用 bold
  if (style === 'bold' || style === 'bold-italic') return 'cnBold';
  return 'cnRegular';
}

function applyFont(doc, kind, style, size, color) {
  doc.font(fontNameFor(kind, style)).fontSize(size).fillColor(color);
}

// 测一段文本宽度（自动按 run 切换字体）
function measureMixed(doc, text, style, size) {
  let total = 0;
  splitRuns(text).forEach(run => {
    applyFont(doc, run.kind, style, size, '#000');
    total += doc.widthOfString(run.text);
  });
  return total;
}

// 在 (x, y) 单行渲染混合文本，不换行；返回最终绘制宽度
function drawLine(doc, text, x, y, opts) {
  const { style = 'normal', size = 12, color = COLORS.brownDark } = opts || {};
  let cursor = x;
  splitRuns(text).forEach(run => {
    applyFont(doc, run.kind, style, size, color);
    doc.text(run.text, cursor, y, { lineBreak: false, baseline: 'top' });
    cursor += doc.widthOfString(run.text);
  });
  return cursor - x;
}

// 把混合文本按 maxWidth 自行换行（按字符切，中文逐字、英文按词）
function wrapMixed(doc, text, maxWidth, style, size) {
  const lines = [];
  // 先按显式换行符切
  const blocks = String(text == null ? '' : text).split(/\r?\n/);
  blocks.forEach(block => {
    let line = '';
    let lineWidth = 0;
    const tokens = tokenize(block);
    tokens.forEach(tok => {
      const w = measureMixed(doc, tok, style, size);
      if (lineWidth + w > maxWidth && line) {
        lines.push(line);
        line = tok.replace(/^\s+/, '');
        lineWidth = measureMixed(doc, line, style, size);
      } else {
        line += tok;
        lineWidth += w;
      }
    });
    lines.push(line);
  });
  return lines;
}

// 拆 token：英文字母数字和 ASCII 标点连在一起算一个词；中文每个字独立；空格独立
function tokenize(text) {
  const out = [];
  let buf = '';
  let mode = null; // 'word' | 'cjk' | 'space'
  for (const ch of text) {
    let m;
    if (/\s/.test(ch)) m = 'space';
    else if (isLatinChar(ch)) m = 'word';
    else m = 'cjk';
    if (mode === null) { mode = m; buf = ch; continue; }
    if (m === 'cjk' || mode === 'cjk' || m !== mode) {
      if (buf) out.push(buf);
      buf = ch;
      mode = m;
    } else {
      buf += ch;
    }
  }
  if (buf) out.push(buf);
  return out;
}

// 画圆角矩形
function roundedRect(doc, x, y, w, h, r) {
  doc.roundedRect(x, y, w, h, r);
  return doc;
}

// 画圆
function circle(doc, cx, cy, r) {
  doc.circle(cx, cy, r);
  return doc;
}

// ----- 高亮 token 识别（步骤里的 150g / 65°C / 6g 等）-----
const HIGHLIGHT_PATTERN = /(\d+(?:\.\d+)?\s*(?:g|ml|°C|℃|度|min|秒|shot|盎司|颗|杯|分钟))/gi;

function splitHighlightSegments(text) {
  const segments = [];
  let lastIndex = 0;
  const src = String(text == null ? '' : text);
  let m;
  HIGHLIGHT_PATTERN.lastIndex = 0;
  while ((m = HIGHLIGHT_PATTERN.exec(src)) !== null) {
    if (m.index > lastIndex) {
      segments.push({ text: src.slice(lastIndex, m.index), highlight: false });
    }
    segments.push({ text: m[0], highlight: true });
    lastIndex = m.index + m[0].length;
  }
  if (lastIndex < src.length) {
    segments.push({ text: src.slice(lastIndex), highlight: false });
  }
  return segments.length ? segments : [{ text: src, highlight: false }];
}

// ----- 步骤尾部的 "（XX）" / "(XX)" 抽出来当 → 完成XX -----
function splitStepResult(step) {
  const m = String(step == null ? '' : step).match(/^([\s\S]*?)\s*[（(]([^（）()]{1,12})[）)]\s*$/);
  if (m && m[2]) {
    return { body: m[1].trim(), result: m[2].trim() };
  }
  return { body: String(step == null ? '' : step), result: '' };
}

// ----- 工具：饮品 SOP 编号 -----
function sopId(drink) {
  if (drink.sopCode) return drink.sopCode;
  return 'SOP-' + String(drink.id).padStart(3, '0');
}

function lastUpdatedText(drink) {
  if (drink.history && drink.history.length && drink.history[0].time) {
    const t = drink.history[0].time.slice(0, 10).replace(/-/g, '.');
    return t + ' updated';
  }
  return new Date().toISOString().slice(0, 10).replace(/-/g, '.') + ' updated';
}

function priceText(price) {
  return String(price || '¥--').replace(/\s/g, '');
}

// ============================================================
// 图片资源处理（保留原 JPEG/PNG 解析能力，pdfkit 直接吃 buffer）
// ============================================================

async function loadImageBuffers(drinks) {
  const map = {};
  await Promise.all(normalizeData(drinks).map(async drink => {
    if (!drink.img || !/^cloud:\/\//.test(drink.img)) return;
    try {
      const result = await cloud.downloadFile({ fileID: drink.img });
      // pdfkit 自己能解 JPEG/PNG，直接存 buffer
      map[String(drink.id)] = result.fileContent;
    } catch (error) {
      console.warn('饮品图片读取失败，PDF 将使用占位图。', drink.name, error);
    }
  }));
  return map;
}

// ============================================================
// 单页绘制
// ============================================================

function drawPageShell(doc) {
  // 1) 全页薄荷绿底（外框效果）
  doc.rect(0, 0, PAGE_W, PAGE_H).fill(COLORS.mint);

  // 1.5) 外框上的小圆点装饰（左上 + 右下，参考 P1）
  for (let y = 8; y < PAGE_H; y += 22) {
    doc.circle(8, y, 1.5).fill('#9FCDB8');
    doc.circle(PAGE_W - 8, y, 1.5).fill('#9FCDB8');
  }

  // 2) 内层米黄纸
  const px = MINT_BORDER;
  const py = MINT_BORDER;
  const pw = PAGE_W - MINT_BORDER * 2;
  const ph = PAGE_H - MINT_BORDER * 2;
  doc.rect(px, py, pw, ph).fill(COLORS.paper);

  // 3) 内层细棕描边
  doc.lineWidth(0.6).strokeColor(COLORS.brownStroke);
  doc.rect(px + 2, py + 2, pw - 4, ph - 4).stroke();

  return { px, py, pw, ph };
}

// 顶部标题区（占全宽）
function drawHeader(doc, drink, indexInList, total) {
  const px = MINT_BORDER;
  const py = MINT_BORDER;
  const innerX = px + PAPER_PAD;
  const innerW = PAGE_W - (px + PAPER_PAD) * 2;
  const top = py + PAPER_PAD;

  // 第一行：H1。如有英文名 → EB Garamond italic 32pt；否则中文名 28pt 思源宋体常规
  let row1Width = 0;
  let row1H = 32;
  if (drink.nameEn) {
    applyFont(doc, 'en', 'italic', 32, COLORS.brownDark);
    doc.text(drink.nameEn, innerX, top, { lineBreak: false, baseline: 'top' });
    row1Width = doc.widthOfString(drink.nameEn);
  } else {
    row1H = 28;
    row1Width = drawLine(doc, drink.name, innerX, top, {
      style: 'normal', size: 28, color: COLORS.brownDark
    });
  }

  // 紧跟价格胶囊
  const price = priceText(drink.price);
  applyFont(doc, 'en', 'bold', 13, COLORS.priceText);
  const priceW = Math.max(54, doc.widthOfString(price) + 22);
  const priceH = 22;
  const priceX = innerX + row1Width + 16;
  const priceY = top + (row1H - priceH) / 2 + 2;
  roundedRect(doc, priceX, priceY, priceW, priceH, 11).fill(COLORS.priceBg);
  applyFont(doc, 'en', 'bold', 13, COLORS.priceText);
  doc.text(price, priceX, priceY + 5, { width: priceW, align: 'center', lineBreak: false });

  // 第二行：中文名 · 系列名 + meta（只有有英文名才显示中文名，否则中文名已经是 H1 了）
  const row2Y = top + row1H + 10;
  let cursor = innerX;
  if (drink.nameEn) {
    cursor += drawLine(doc, drink.name, cursor, row2Y, {
      style: 'normal', size: 18, color: COLORS.brownDark
    });
    if (drink.series) {
      cursor += drawLine(doc, ' · ' + drink.series, cursor, row2Y + 2, {
        style: 'normal', size: 16, color: COLORS.brownLight
      });
    }
  } else if (drink.series) {
    cursor += drawLine(doc, drink.series, cursor, row2Y + 2, {
      style: 'normal', size: 16, color: COLORS.brownLight
    });
  }
  // meta：小灰字
  const metaParts = [];
  metaParts.push(sopId(drink));
  if (drink.version) metaParts.push(drink.version);
  metaParts.push(lastUpdatedText(drink));
  const meta = (cursor > innerX ? '   ·   ' : '') + metaParts.join(' · ');
  drawLine(doc, meta, cursor + 6, row2Y + 5, { style: 'italic', size: 12, color: COLORS.brownLight });

  // 右上角小猫头像
  drawCatHead(doc, PAGE_W - px - PAPER_PAD - 22, top + 22, 20);

  // 底部分隔线
  const lineY = top + row1H + 38;
  doc.lineWidth(1.5).strokeColor(COLORS.brownStroke);
  doc.moveTo(innerX, lineY).lineTo(innerX + innerW, lineY).stroke();

  return { innerX, innerW, contentTopY: lineY + 12 };
}

// 简笔小猫头矢量
function drawCatHead(doc, cx, cy, r) {
  // 脸
  doc.circle(cx, cy, r).fill(COLORS.catFace);
  doc.lineWidth(0.8).strokeColor(COLORS.brownDark);
  doc.circle(cx, cy, r).stroke();
  // 耳朵（两个三角）
  doc.fillColor(COLORS.brownLight);
  doc.moveTo(cx - r * 0.7, cy - r * 0.4)
     .lineTo(cx - r * 0.45, cy - r * 1.1)
     .lineTo(cx - r * 0.15, cy - r * 0.6)
     .closePath().fill();
  doc.moveTo(cx + r * 0.7, cy - r * 0.4)
     .lineTo(cx + r * 0.45, cy - r * 1.1)
     .lineTo(cx + r * 0.15, cy - r * 0.6)
     .closePath().fill();
  // 眼睛
  doc.circle(cx - r * 0.32, cy - r * 0.05, r * 0.08).fill(COLORS.brownDark);
  doc.circle(cx + r * 0.32, cy - r * 0.05, r * 0.08).fill(COLORS.brownDark);
  // 鼻子（小三角）
  doc.fillColor(COLORS.noteLabelText);
  doc.moveTo(cx - r * 0.12, cy + r * 0.12)
     .lineTo(cx + r * 0.12, cy + r * 0.12)
     .lineTo(cx, cy + r * 0.28)
     .closePath().fill();
  // 胡须
  doc.lineWidth(0.6).strokeColor(COLORS.brownMid);
  doc.moveTo(cx - r * 0.45, cy + r * 0.18).lineTo(cx - r * 0.85, cy + r * 0.05).stroke();
  doc.moveTo(cx - r * 0.45, cy + r * 0.30).lineTo(cx - r * 0.85, cy + r * 0.30).stroke();
  doc.moveTo(cx + r * 0.45, cy + r * 0.18).lineTo(cx + r * 0.85, cy + r * 0.05).stroke();
  doc.moveTo(cx + r * 0.45, cy + r * 0.30).lineTo(cx + r * 0.85, cy + r * 0.30).stroke();
}

// 左列：照片 + key facts（+ 可选二维码）
function drawLeftColumn(doc, drink, imageBuffer, leftX, topY, colW) {
  const photoSize = colW; // 正方形
  drawPhotoBox(doc, drink, imageBuffer, leftX, topY, photoSize);

  // key facts 卡片
  const facts = [];
  if (drink.volume) facts.push(['出杯量', drink.volume]);
  if (drink.waterTemp) facts.push(['水温', drink.waterTemp]);
  if (drink.duration) facts.push(['耗时', drink.duration]);
  if (drink.cupType) facts.push(['杯型', drink.cupType]);

  let nextY = topY + photoSize + 12;
  if (facts.length) {
    const factsH = 32 + facts.length * 18;
    roundedRect(doc, leftX, nextY, colW, factsH, 6).fill(COLORS.rowAlt);
    doc.lineWidth(0.5).strokeColor(COLORS.brownStroke);
    roundedRect(doc, leftX, nextY, colW, factsH, 6).stroke();
    drawLine(doc, 'key facts:', leftX + 12, nextY + 10, {
      style: 'italic', size: 12, color: COLORS.brownMid
    });
    facts.forEach(([label, value], i) => {
      const lineY = nextY + 30 + i * 18;
      drawLine(doc, label, leftX + 12, lineY, {
        style: 'normal', size: 13, color: COLORS.brownMid
      });
      // 右对齐 value
      const valueW = measureMixed(doc, value, 'normal', 13);
      drawLine(doc, value, leftX + colW - 12 - valueW, lineY, {
        style: 'normal', size: 13, color: COLORS.brownDark
      });
    });
    nextY += factsH + 12;
  }

  // 二维码（仅当 videoUrl 有值）
  if (drink.videoUrl) {
    drawQRPlaceholder(doc, leftX, nextY, 56);
    drawLine(doc, 'scan to watch', leftX + 64, nextY + 10, {
      style: 'italic', size: 11, color: COLORS.brownMid
    });
    drawLine(doc, '制作视频教学', leftX + 64, nextY + 28, {
      style: 'normal', size: 11, color: COLORS.brownMid
    });
  }
}

// 照片框：有图就嵌图，没图就画占位猫脸
function drawPhotoBox(doc, drink, imageBuffer, x, y, size) {
  // 棕色背景
  roundedRect(doc, x, y, size, size, 12).fill(COLORS.photoBg);
  doc.lineWidth(1.2).strokeColor(COLORS.brownStroke);
  roundedRect(doc, x, y, size, size, 12).stroke();

  if (imageBuffer && imageBuffer.length) {
    try {
      const inset = 6;
      // 用裁切区域确保图片不溢出圆角矩形
      doc.save();
      roundedRect(doc, x + inset, y + inset, size - inset * 2, size - inset * 2, 8).clip();
      doc.image(imageBuffer, x + inset, y + inset, {
        fit: [size - inset * 2, size - inset * 2],
        align: 'center',
        valign: 'center'
      });
      doc.restore();
      return;
    } catch (e) {
      console.warn('图片嵌入失败，回退占位猫脸', e && e.message);
    }
  }

  // 占位：白色椭圆 + 猫脸特征
  const cx = x + size / 2;
  const cy = y + size / 2;
  doc.save();
  // 白色椭圆碟
  doc.ellipse(cx, cy, size * 0.34, size * 0.28).fill('#FFFFFF');
  doc.lineWidth(1).strokeColor(COLORS.brownStroke);
  doc.ellipse(cx, cy, size * 0.34, size * 0.28).stroke();
  // 中央猫脸（颜色用 catFace 米色）
  const faceR = size * 0.22;
  doc.circle(cx, cy, faceR).fill(COLORS.catFace);
  // 耳朵
  doc.fillColor(COLORS.brownDark);
  doc.moveTo(cx - faceR * 0.55, cy - faceR * 0.6)
     .lineTo(cx - faceR * 0.30, cy - faceR * 1.15)
     .lineTo(cx - faceR * 0.05, cy - faceR * 0.65)
     .closePath().fill();
  doc.moveTo(cx + faceR * 0.55, cy - faceR * 0.6)
     .lineTo(cx + faceR * 0.30, cy - faceR * 1.15)
     .lineTo(cx + faceR * 0.05, cy - faceR * 0.65)
     .closePath().fill();
  // 眼睛 + 鼻子 + 胡须
  doc.circle(cx - faceR * 0.35, cy - faceR * 0.05, faceR * 0.08).fill(COLORS.brownDark);
  doc.circle(cx + faceR * 0.35, cy - faceR * 0.05, faceR * 0.08).fill(COLORS.brownDark);
  doc.fillColor(COLORS.noteLabelText);
  doc.moveTo(cx - faceR * 0.13, cy + faceR * 0.10)
     .lineTo(cx + faceR * 0.13, cy + faceR * 0.10)
     .lineTo(cx, cy + faceR * 0.30)
     .closePath().fill();
  doc.lineWidth(0.6).strokeColor(COLORS.brownDark);
  doc.moveTo(cx - faceR * 0.45, cy + faceR * 0.20).lineTo(cx - faceR, cy + faceR * 0.05).stroke();
  doc.moveTo(cx - faceR * 0.45, cy + faceR * 0.32).lineTo(cx - faceR, cy + faceR * 0.32).stroke();
  doc.moveTo(cx + faceR * 0.45, cy + faceR * 0.20).lineTo(cx + faceR, cy + faceR * 0.05).stroke();
  doc.moveTo(cx + faceR * 0.45, cy + faceR * 0.32).lineTo(cx + faceR, cy + faceR * 0.32).stroke();
  doc.restore();
}

// 二维码占位（实际项目可以换成 qrcode 库的真实 QR）
function drawQRPlaceholder(doc, x, y, size) {
  doc.rect(x, y, size, size).fill('#FFFFFF');
  doc.lineWidth(0.6).strokeColor(COLORS.brownDark);
  doc.rect(x, y, size, size).stroke();
  // 一些随机黑块模拟 QR
  const cell = size / 14;
  doc.fillColor('#000');
  const pattern = [
    [1,1,1,0,1,0,0,1,0,1,0,1,1,1],
    [1,0,1,1,0,1,1,0,1,0,1,0,0,1],
    [1,1,1,0,1,0,0,1,1,1,0,1,1,1],
    [0,0,0,1,0,1,0,0,0,1,1,0,0,0],
    [1,0,1,0,1,0,1,1,0,0,1,0,1,1],
    [0,1,1,1,0,1,0,1,1,0,0,1,0,0],
    [1,0,0,0,1,0,1,0,1,1,1,0,1,1],
    [1,1,0,1,0,1,1,1,0,0,0,1,0,1],
    [0,0,1,0,1,0,0,0,1,1,0,1,1,0],
    [1,1,1,0,0,1,1,0,0,0,1,0,1,1],
    [0,0,0,1,1,0,0,1,1,0,1,1,0,0],
    [1,0,1,0,1,1,0,0,1,1,0,1,1,1],
    [1,1,0,1,0,0,1,1,0,1,1,0,0,1],
    [1,0,1,1,1,1,0,1,1,0,1,0,1,1]
  ];
  for (let r = 0; r < 14; r++) {
    for (let c = 0; c < 14; c++) {
      if (pattern[r][c]) {
        doc.rect(x + c * cell, y + r * cell, cell, cell).fill('#000');
      }
    }
  }
  // 三个定位角
  doc.fillColor('#000');
  [[0,0],[size-cell*4,0],[0,size-cell*4]].forEach(([ox,oy]) => {
    doc.rect(x+ox, y+oy, cell*4, cell*4).fill('#000');
    doc.rect(x+ox+cell*0.6, y+oy+cell*0.6, cell*2.8, cell*2.8).fill('#FFFFFF');
    doc.rect(x+ox+cell*1.4, y+oy+cell*1.4, cell*1.2, cell*1.2).fill('#000');
  });
}

// 右列：板块标题（英 italic + 中粗 + 装饰横线）
function drawSectionTitle(doc, x, y, w, en, zh) {
  applyFont(doc, 'en', 'italic', 20, COLORS.brownDark);
  doc.text(en, x, y, { lineBreak: false, baseline: 'top' });
  const enW = doc.widthOfString(en);
  applyFont(doc, 'cn', 'bold', 15, COLORS.brownDark);
  doc.text(' · ' + zh, x + enW + 4, y + 4, { lineBreak: false, baseline: 'top' });
  // 装饰横线
  doc.lineWidth(0.8).strokeColor(COLORS.brownStroke);
  const decorY = y + 27;
  doc.moveTo(x, decorY).lineTo(x + Math.min(160, w * 0.45), decorY).stroke();
  return decorY + 6;
}

// 三列原料表 item / amount / note
function drawIngredientTable(doc, ingredients, x, y, w) {
  const colItem = Math.round(w * 0.50);
  const colAmount = Math.round(w * 0.22);
  const colNote = w - colItem - colAmount;
  const headH = 20;

  // 表头
  doc.rect(x, y, w, headH).fill(COLORS.tableHead);
  doc.lineWidth(0.5).strokeColor(COLORS.brownStroke);
  doc.rect(x, y, w, headH).stroke();
  doc.moveTo(x + colItem, y).lineTo(x + colItem, y + headH).stroke();
  doc.moveTo(x + colItem + colAmount, y).lineTo(x + colItem + colAmount, y + headH).stroke();
  applyFont(doc, 'en', 'italic', 11, COLORS.brownMid);
  doc.text('item', x + 10, y + 5, { lineBreak: false });
  doc.text('amount', x + colItem + colAmount - doc.widthOfString('amount') - 10, y + 5, { lineBreak: false });
  doc.text('note', x + colItem + colAmount + 10, y + 5, { lineBreak: false });

  let cursorY = y + headH;
  ingredients.forEach((ing, i) => {
    // 行高动态：测 name 和 note 哪个更高
    const nameLines = wrapMixed(doc, ing.name, colItem - 20, 'normal', 13);
    const noteLines = wrapMixed(doc, ing.note, colNote - 20, 'italic', 12);
    const lines = Math.max(1, nameLines.length, noteLines.length);
    const rowH = Math.max(21, lines * 15 + 6);

    // 斑马底
    doc.rect(x, cursorY, w, rowH).fill(i % 2 === 0 ? COLORS.rowWhite : COLORS.rowAlt);
    doc.lineWidth(0.4).strokeColor(COLORS.brownStroke);
    doc.rect(x, cursorY, w, rowH).stroke();
    // 列分隔线
    doc.moveTo(x + colItem, cursorY).lineTo(x + colItem, cursorY + rowH).stroke();
    doc.moveTo(x + colItem + colAmount, cursorY).lineTo(x + colItem + colAmount, cursorY + rowH).stroke();

    // item（左对齐）
    nameLines.forEach((line, li) => {
      drawLine(doc, line, x + 10, cursorY + 5 + li * 15, {
        style: 'normal', size: 13, color: COLORS.brownDark
      });
    });
    // amount（右对齐 + bold）
    if (ing.amount) {
      const amountW = measureMixed(doc, ing.amount, 'bold', 13);
      drawLine(doc, ing.amount, x + colItem + colAmount - 10 - amountW, cursorY + (rowH - 15) / 2, {
        style: 'bold', size: 13, color: COLORS.brownDark
      });
    }
    // note（italic 浅棕色）
    noteLines.forEach((line, li) => {
      drawLine(doc, line, x + colItem + colAmount + 10, cursorY + 5 + li * 15, {
        style: 'italic', size: 12, color: COLORS.brownLight
      });
    });

    cursorY += rowH;
  });
  return cursorY;
}

// 步骤块（圆形序号 + 高亮参数 + 末尾结果尾巴）
function drawStep(doc, step, idx, x, y, w) {
  const num = String(idx + 1);
  const numR = 10;
  const numCx = x + numR;
  const numCy = y + numR + 4;
  doc.circle(numCx, numCy, numR).fill(COLORS.brownDark);
  applyFont(doc, 'en', 'bold', 12, '#FFFFFF');
  const nw = doc.widthOfString(num);
  doc.text(num, numCx - nw / 2, numCy - 5.5, { lineBreak: false });

  // 拆出结果尾巴
  const { body, result } = splitStepResult(step);
  const bodyX = x + numR * 2 + 12;
  const bodyW = w - (numR * 2 + 12);

  // 行布局：把 body 按高亮分段，再按 token 包装
  const bodyTokens = buildHighlightedTokens(doc, body, 13);
  const lines = wrapHighlightedTokens(doc, bodyTokens, bodyW);

  let cursorY = y + 4;
  lines.forEach(line => {
    let cx = bodyX;
    line.forEach(seg => {
      // 高亮背景
      if (seg.highlight) {
        const padX = 4, padY = 2;
        const segW = seg.width;
        roundedRect(doc, cx - padX, cursorY - padY + 1, segW + padX * 2, 16 + padY * 2 - 2, 4).fill(COLORS.highlight);
      }
      drawLine(doc, seg.text, cx, cursorY, {
        style: seg.highlight ? 'bold' : 'normal',
        size: 13,
        color: COLORS.brownDark
      });
      cx += seg.width;
    });
    cursorY += 18;
  });

  // 结果尾巴：→ 完成XX
  if (result) {
    drawLine(doc, '→ 完成' + result, bodyX, cursorY, {
      style: 'italic', size: 11, color: COLORS.brownLight
    });
    cursorY += 15;
  }

  // 步骤之间虚线分隔
  doc.lineWidth(0.4).strokeColor(COLORS.brownStroke).dash(2, { space: 3 });
  doc.moveTo(bodyX, cursorY + 2).lineTo(x + w, cursorY + 2).stroke();
  doc.undash();
  return cursorY + 6;
}

// 把 body 切成 [{text, highlight, width}]
function buildHighlightedTokens(doc, body, size) {
  const segs = splitHighlightSegments(body);
  const result = [];
  segs.forEach(seg => {
    if (seg.highlight) {
      const w = measureMixed(doc, seg.text, 'bold', size);
      result.push({ text: seg.text, highlight: true, width: w, atomic: true });
    } else {
      // 进一步按 token 切，便于换行
      const toks = tokenize(seg.text);
      toks.forEach(t => {
        const w = measureMixed(doc, t, 'normal', size);
        result.push({ text: t, highlight: false, width: w, atomic: false });
      });
    }
  });
  return result;
}

function wrapHighlightedTokens(doc, tokens, maxWidth) {
  const lines = [];
  let line = [];
  let lineW = 0;
  tokens.forEach(tok => {
    if (lineW + tok.width > maxWidth && line.length) {
      lines.push(line);
      line = [];
      lineW = 0;
      // 行首去掉前导空白 token
      if (/^\s+$/.test(tok.text)) return;
    }
    line.push(tok);
    lineW += tok.width;
  });
  if (line.length) lines.push(line);
  return lines;
}

// 注意框（全宽）
function measureNoteBox(doc, notes, w) {
  if (!notes.length) return { height: 0, lines: [] };
  // 多条注意：合并为一个 box 内多行；P1 只展示一条，但保持兼容
  const labelW = 56;
  const padding = 12;
  const innerW = w - labelW - padding * 3;

  const lines = [];
  notes.forEach(note => {
    wrapMixed(doc, note + ' — meow~', innerW, 'normal', 13).forEach(l => lines.push(l));
  });
  const boxH = Math.max(50, lines.length * 18 + 22);
  return { height: boxH, lines };
}

function drawNoteBox(doc, notes, x, y, w) {
  if (!notes.length) return y;
  const labelW = 56;
  const { height: boxH, lines } = measureNoteBox(doc, notes, w);

  // 背景
  roundedRect(doc, x, y, w, boxH, 6).fill(COLORS.noteBg);
  // 左侧 3mm 边框
  doc.rect(x, y, 8, boxH).fill(COLORS.noteBorder);
  // 整体描边
  doc.lineWidth(0.5).strokeColor(COLORS.brownStroke);
  roundedRect(doc, x, y, w, boxH, 6).stroke();

  // 椭圆胶囊标签 ! 注意
  const labelX = x + 18;
  const labelY = y + (boxH - 22) / 2;
  roundedRect(doc, labelX, labelY, labelW, 22, 11).fill(COLORS.noteLabelBg);
  applyFont(doc, 'cn', 'bold', 13, COLORS.noteLabelText);
  // ! 用拉丁，注意 用中文
  drawLine(doc, '! 注意', labelX + 12, labelY + 5, {
    style: 'bold', size: 13, color: COLORS.noteLabelText
  });

  // 正文
  let lineY = y + 12;
  lines.forEach(line => {
    drawLine(doc, line, labelX + labelW + 14, lineY, {
      style: 'normal', size: 13, color: COLORS.brownDark
    });
    lineY += 18;
  });
  return y + boxH;
}

// 页脚
function drawFooter(doc, drink, pageIdx, totalPages) {
  const px = MINT_BORDER + PAPER_PAD;
  const pw = PAGE_W - (MINT_BORDER + PAPER_PAD) * 2;
  const y = PAGE_H - MINT_BORDER - PAPER_PAD - 24;

  // 虚线分隔
  doc.lineWidth(0.5).strokeColor(COLORS.brownStroke).dash(3, { space: 3 });
  doc.moveTo(px, y).lineTo(px + pw, y).stroke();
  doc.undash();

  // 左边
  applyFont(doc, 'en', 'italic', 10, COLORS.brownLight);
  doc.text('prepared by: __________', px, y + 8, { lineBreak: false });
  doc.text('date: __________', px + 180, y + 8, { lineBreak: false });

  // 右边
  const right = `Cozy Corner Cat Cafe   ·   page ${pageIdx} of ${totalPages}   ·   ~ purr-fect cup ~`;
  applyFont(doc, 'en', 'italic', 10, COLORS.brownLight);
  const rw = doc.widthOfString(right);
  doc.text(right, px + pw - rw, y + 8, { lineBreak: false });
}

// 整页绘制单款饮品
function drawDrinkPage(doc, drink, imageBuffer, pageIdx, totalPages) {
  doc.addPage({ size: [PAGE_W, PAGE_H], margin: 0 });
  drawPageShell(doc);
  const { innerX, innerW, contentTopY } = drawHeader(doc, drink, pageIdx, totalPages);

  // 中间内容区分两列
  const leftColW = Math.round(innerW * 0.24);
  const gap = 20;
  const rightX = innerX + leftColW + gap;
  const rightW = innerW - leftColW - gap;

  // 左列
  drawLeftColumn(doc, drink, imageBuffer, innerX, contentTopY, leftColW);

  // 右列：Ingredients
  let cy = contentTopY;
  cy = drawSectionTitle(doc, rightX, cy, rightW, 'Ingredients', '原料配方');
  cy = drawIngredientTable(doc, drink.ingredients, rightX, cy, rightW);
  cy += 10;

  // 右列：Steps
  cy = drawSectionTitle(doc, rightX, cy, rightW, 'Steps', '制作步骤');
  drink.steps.forEach((step, i) => {
    cy = drawStep(doc, step, i, rightX, cy, rightW);
  });

  // 注意框（全宽，放在底部 footer 上面）
  if (drink.notes && drink.notes.length) {
    const footerLineY = PAGE_H - MINT_BORDER - PAPER_PAD - 24;
    const noteInfo = measureNoteBox(doc, drink.notes, innerW);
    const preferredY = cy + 6;
    const maxY = footerLineY - noteInfo.height - 8;
    const notesY = preferredY <= maxY ? preferredY : Math.max(maxY, cy + 4);
    drawNoteBox(doc, drink.notes, innerX, notesY, innerW);
  }

  drawFooter(doc, drink, pageIdx, totalPages);
}

// ============================================================
// 主入口：拼整本 PDF
// ============================================================

function buildPdfDocument(drinks, imageBuffers) {
  const PDFKitDocument = getPDFDocument();
  const doc = new PDFKitDocument({
    size: [PAGE_W, PAGE_H],
    margin: 0,
    autoFirstPage: false,
    info: {
      Title: '咖啡店 SOP 手册',
      Author: 'Cozy Corner Cat Cafe',
      Subject: 'Standard Operating Procedures',
      Producer: 'sopApi via pdfkit'
    }
  });

  // 注册字体
  doc.registerFont('enRegular', path.join(FONT_DIR, FONT_FILES.enRegular));
  doc.registerFont('enItalic', path.join(FONT_DIR, FONT_FILES.enItalic));
  doc.registerFont('enMedium', path.join(FONT_DIR, FONT_FILES.enMedium));
  doc.registerFont('enMediumItalic', path.join(FONT_DIR, FONT_FILES.enMediumItalic));
  doc.registerFont('cnRegular', path.join(FONT_DIR, FONT_FILES.cnRegular));
  doc.registerFont('cnBold', path.join(FONT_DIR, FONT_FILES.cnBold));

  const total = drinks.length || 1;
  if (!drinks.length) {
    doc.addPage({ size: [PAGE_W, PAGE_H], margin: 0 });
    drawPageShell(doc);
    applyFont(doc, 'cn', 'bold', 22, COLORS.brownDark);
    doc.text('暂无 SOP 数据', 0, PAGE_H / 2 - 12, { width: PAGE_W, align: 'center' });
  } else {
    drinks.forEach((drink, i) => {
      drawDrinkPage(doc, drink, imageBuffers[String(drink.id)], i + 1, total);
    });
  }

  return doc;
}

function streamToBuffer(doc) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.end();
  });
}

// 备用 PDF：不依赖 pdfkit / 字体文件。云端依赖安装失败时也能导出可读版本。
function fallbackTextWidth(text, fontSize) {
  return String(text || '').split('').reduce((total, char) => {
    if (char === ' ') return total + fontSize * 0.35;
    return total + (char.charCodeAt(0) < 128 ? fontSize * 0.55 : fontSize);
  }, 0);
}

function fallbackWrap(text, fontSize, maxWidth) {
  const lines = [];
  let line = '';
  String(text || '').split('').forEach(char => {
    const candidate = line + char;
    if (line && fallbackTextWidth(candidate, fontSize) > maxWidth) {
      lines.push(line);
      line = char;
    } else {
      line = candidate;
    }
  });
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}

function fallbackUtf16Hex(text) {
  const safe = String(text || '').replace(/[\uD800-\uDFFF]/g, '');
  const buffer = Buffer.from(safe, 'utf16le');
  const bytes = [];
  for (let index = 0; index < buffer.length; index += 2) {
    bytes.push(buffer[index + 1], buffer[index]);
  }
  return Buffer.from(bytes).toString('hex').toUpperCase();
}

function fallbackText(text, x, y, size, color = '0.42 0.27 0.16') {
  return `${color} rg\nBT /F1 ${size} Tf 1 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)} Tm <${fallbackUtf16Hex(text)}> Tj ET\n`;
}

function fallbackTextRight(text, rightX, y, size, color = '0.42 0.27 0.16') {
  return fallbackText(text, rightX - fallbackTextWidth(text, size), y, size, color);
}

function fallbackRect(x, y, width, height, color) {
  return `${color} rg ${x.toFixed(2)} ${y.toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re f\n`;
}

function fallbackStrokeRect(x, y, width, height, color = '0.42 0.27 0.16', lineWidth = 1) {
  return `${color} RG ${lineWidth} w ${x.toFixed(2)} ${y.toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re S\n`;
}

function fallbackLine(x1, y1, x2, y2, color = '0.55 0.42 0.27', width = 1) {
  return `${color} RG ${width} w ${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S\n`;
}

function fallbackPdfObject(id, body) {
  return `${id} 0 obj\n${body}\nendobj\n`;
}

function createFallbackPdfBuffer(drinks) {
  const pageWidth = PAGE_W;
  const pageHeight = PAGE_H;
  const source = normalizeData(drinks);
  const pages = (source.length ? source : [{ id: 0, name: '暂无 SOP 数据', price: '' }]).map((drink, drinkIndex) => {
    const left = 44;
    const top = 528;
    const right = pageWidth - 44;
    let content = '';
    content += fallbackRect(0, 0, pageWidth, pageHeight, '0.72 0.86 0.80');
    content += fallbackRect(18, 18, pageWidth - 36, pageHeight - 36, '0.98 0.94 0.84');
    content += fallbackStrokeRect(18, 18, pageWidth - 36, pageHeight - 36, '0.42 0.27 0.16', 1.5);
    content += fallbackText(drink.name || '暂无 SOP 数据', left, top, 25);
    content += fallbackTextRight(priceText(drink.price), right - 220, top + 4, 13, '0.42 0.27 0.16');
    content += fallbackText(`${sopId(drink)} / 第 ${drinkIndex + 1} 款 / 总 ${source.length || 1} 款`, left, top - 28, 10.5, '0.55 0.42 0.27');
    content += fallbackLine(left, top - 42, right, top - 42, '0.55 0.42 0.27', 1.4);

    const photoX = left;
    const photoY = 284;
    const photoSize = 176;
    content += fallbackRect(photoX, photoY, photoSize, photoSize, '0.74 0.57 0.42');
    content += fallbackStrokeRect(photoX, photoY, photoSize, photoSize, '0.50 0.36 0.22', 1.2);
    content += fallbackText('饮品照片', photoX + 52, photoY + 86, 14, '1 0.97 0.90');

    const tableX = photoX + photoSize + 24;
    const tableW = right - tableX;
    let y = top - 82;
    content += fallbackText('Ingredients / 原料配方', tableX, y, 17);
    y -= 24;
    content += fallbackRect(tableX, y - 4, tableW, 22, '0.94 0.86 0.72');
    content += fallbackStrokeRect(tableX, y - 4, tableW, 22, '0.78 0.61 0.40', 0.5);
    content += fallbackText('item', tableX + 8, y + 3, 10, '0.55 0.42 0.27');
    content += fallbackText('amount', tableX + tableW * 0.68, y + 3, 10, '0.55 0.42 0.27');
    y -= 22;
    (drink.ingredients || []).slice(0, 8).forEach((ingredient, index) => {
      if (index % 2 === 0) content += fallbackRect(tableX, y - 5, tableW, 22, '1 0.97 0.90');
      content += fallbackText(ingredient.name || '', tableX + 8, y + 1, 11);
      content += fallbackTextRight(ingredient.amount || '', tableX + tableW - 16, y + 1, 11);
      y -= 22;
    });

    y -= 14;
    content += fallbackText('Steps / 制作步骤', tableX, y, 17);
    y -= 28;
    (drink.steps || []).slice(0, 5).forEach((step, index) => {
      const lines = fallbackWrap(step, 11.5, tableW - 42);
      content += fallbackRect(tableX, y - lines.length * 15 + 5, 24, 24, '0.42 0.27 0.16');
      content += fallbackText(String(index + 1), tableX + 8, y - 4, 11, '1 1 1');
      lines.forEach((line, lineIndex) => {
        content += fallbackText(line, tableX + 38, y - lineIndex * 15, 11.5);
      });
      y -= Math.max(34, lines.length * 15 + 9);
    });

    const notes = drink.notes || [];
    if (notes.length) {
      content += fallbackRect(left, 70, right - left, 48, '1 0.91 0.78');
      content += fallbackStrokeRect(left, 70, right - left, 48, '0.87 0.55 0.31', 1);
      content += fallbackText('! 注意', left + 18, 88, 12, '0.75 0.38 0.25');
      fallbackWrap(notes.join('；'), 12, right - left - 110).slice(0, 2).forEach((line, lineIndex) => {
        content += fallbackText(line, left + 82, 89 - lineIndex * 16, 12);
      });
    }

    content += fallbackLine(left, 44, right, 44, '0.78 0.61 0.40', 0.6);
    content += fallbackText('月白的厨房秘诀 / 备用 PDF', left, 27, 10, '0.55 0.42 0.27');
    content += fallbackTextRight(`page ${drinkIndex + 1} of ${source.length || 1}`, right, 27, 10, '0.55 0.42 0.27');
    return content;
  });

  const objects = [];
  const pageRefs = [];
  const catalogId = 1;
  const pagesId = 2;
  const fontId = 3;
  const cidFontId = 4;
  const descriptorId = 5;
  let nextId = 6;
  objects[catalogId] = fallbackPdfObject(catalogId, `<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
  objects[fontId] = fallbackPdfObject(fontId, `<< /Type /Font /Subtype /Type0 /BaseFont /STSong-Light /Encoding /UniGB-UCS2-H /DescendantFonts [${cidFontId} 0 R] >>`);
  objects[cidFontId] = fallbackPdfObject(cidFontId, `<< /Type /Font /Subtype /CIDFontType0 /BaseFont /STSong-Light /CIDSystemInfo << /Registry (Adobe) /Ordering (GB1) /Supplement 2 >> /FontDescriptor ${descriptorId} 0 R /DW 1000 >>`);
  objects[descriptorId] = fallbackPdfObject(descriptorId, '<< /Type /FontDescriptor /FontName /STSong-Light /Flags 6 /FontBBox [-25 -254 1000 880] /ItalicAngle 0 /Ascent 880 /Descent -120 /CapHeight 880 /StemV 80 >>');

  pages.forEach(content => {
    const pageId = nextId;
    const streamId = nextId + 1;
    nextId += 2;
    const streamBuffer = Buffer.from(content, 'utf8');
    pageRefs.push(`${pageId} 0 R`);
    objects[pageId] = fallbackPdfObject(pageId, `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${streamId} 0 R >>`);
    objects[streamId] = `${streamId} 0 obj\n<< /Length ${streamBuffer.length} >>\nstream\n${content}endstream\nendobj\n`;
  });
  objects[pagesId] = fallbackPdfObject(pagesId, `<< /Type /Pages /Kids [${pageRefs.join(' ')}] /Count ${pageRefs.length} >>`);

  const chunks = [Buffer.from('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n', 'binary')];
  const offsets = [0];
  for (let id = 1; id < objects.length; id += 1) {
    if (!objects[id]) continue;
    offsets[id] = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    chunks.push(Buffer.from(objects[id], 'utf8'));
  }
  const xrefOffset = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  let xref = `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id += 1) {
    xref += `${String(offsets[id] || 0).padStart(10, '0')} 00000 n \n`;
  }
  xref += `trailer\n<< /Size ${objects.length} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  chunks.push(Buffer.from(xref, 'utf8'));
  return Buffer.concat(chunks);
}

async function exportPdf(drinks) {
  const source = Array.isArray(drinks) && drinks.length ? normalizeData(drinks) : await listDrinks();
  let renderer = 'pdfkit';
  let pdfBuffer;
  try {
    const imageBuffers = await loadImageBuffers(source);
    const doc = buildPdfDocument(source, imageBuffers);
    pdfBuffer = await streamToBuffer(doc);
  } catch (error) {
    renderer = 'fallback';
    console.error('PDFKIT_EXPORT_FAILED_FALLBACK_USED', error && (error.stack || error.message) || error);
    pdfBuffer = createFallbackPdfBuffer(source);
  }
  const stamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
  const result = await cloud.uploadFile({
    cloudPath: `exports/coffee-sop-${stamp}.pdf`,
    fileContent: pdfBuffer
  });
  return {
    fileID: result.fileID,
    count: source.length,
    renderer
  };
}

// ============================================================
// 云函数入口
// ============================================================

exports.main = async event => {
  const action = event && event.action;

  if (action === 'list') {
    await seedIfEmpty();
    return { drinks: await listDrinks() };
  }

  if (action === 'saveAll') {
    const wxContext = cloud.getWXContext();
    const profile = normalizeProfile(event.profile, wxContext);
    if (!profile.nickName || !profile.avatarUrl) {
      return { ok: false, message: 'PROFILE_REQUIRED' };
    }
    const drinks = await saveAll(event.drinks, profile, wxContext);
    return { ok: true, count: drinks.length, drinks };
  }

  if (action === 'exportPdf') {
    return exportPdf(event.drinks);
  }

  return { ok: false, message: 'Unknown action' };
};

// 暴露给本地测试用（云函数运行时不会用到）
exports._internal = { buildPdfDocument, streamToBuffer, normalizeData };
