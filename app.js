const STORE = 'coffee_sop_v2';
const CLOUD_HASH_KEY = 'coffee_sop_v2_cloud_hash';
const PUBLISHED_LABEL = '2026.04.29 发布版';
const ASSET_VERSION = '20260429b';
const FIREBASE_SDK_VERSION = '12.7.0';
const IMAGE_MAX_DATA_URL_LENGTH = 460000;
const IMAGE_MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

const DEFAULT = [
  {id:1,sort:1,emoji:'🧂',name:'海盐芝士月白',price:'¥43',img:'',
   ingredients:[
     {name:'Espresso 浓缩',amount:'标准份量'},
     {name:'热水（65°C）',amount:'150g'},
     {name:'焦糖海盐糖浆（咖啡底）',amount:'6g'},
     {name:'Kiri 奶油芝士',amount:'35g'},
     {name:'淡奶油',amount:'15g'},
     {name:'焦糖海盐糖浆（奶盖）',amount:'6g'},
     {name:'奥利奥饼干',amount:'少许'}
   ],
   steps:[
     '浓缩倒入 150g 65°C 热水，加 6g 焦糖海盐糖浆搅匀（咖啡底）',
     '35g Kiri + 15g 淡奶油 + 6g 糖浆 + 少许奥利奥一起打发（奶盖）',
     '奶盖铺在咖啡液面上，顶部撒奥利奥碎装饰'
   ],
   notes:['不要打太久！过度打发会固化，影响口感']},
  {id:2,sort:2,emoji:'🍵',name:'抹茶拿铁',price:'¥39',img:'',
   ingredients:[
     {name:'抹茶粉',amount:'4g'},
     {name:'蜂蜜',amount:'2.5g'},
     {name:'热水（第一次）',amount:'10g'},
     {name:'热水（第二次）',amount:'20g'},
     {name:'牛奶 / 燕麦奶',amount:'按杯型'}
   ],
   steps:[
     '抹茶粉 + 蜂蜜，第一次注水 10g，茶筅充分打成泥状（无颗粒）',
     '第二次注水 20g，继续搅打至细腻均匀',
     '打发奶泡，抹茶糊倒入杯中，缓缓注入奶泡'
   ],
   notes:['分两次加水：第一次少量打泥，第二次再加，避免结块']},
  {id:3,sort:3,emoji:'☕',name:'泡沫美式（芭乐/百香果/荔枝）',price:'¥31',img:'',
   ingredients:[
     {name:'Espresso 浓缩',amount:'标准份量'},
     {name:'冰块',amount:'七分满'},
     {name:'苏打水 / 气泡水',amount:'八分满'},
     {name:'风味糖浆',amount:'15ml'}
   ],
   steps:[
     '杯中加满冰块',
     '注入苏打水至八分满，加入对应风味糖浆轻轻搅动',
     '缓缓倒入 Espresso，形成分层效果即可'
   ],
   notes:[]},
  {id:4,sort:4,emoji:'🌿',name:'抹茶椰子糖',price:'¥39',img:'',
   ingredients:[
     {name:'抹茶糊（参考抹茶拿铁）',amount:'按量'},
     {name:'椰浆',amount:'按杯型'}
   ],
   steps:['配方待确认，暂用占位'],
   notes:['配方待补充，请询问店长确认']},
  {id:5,sort:5,emoji:'🧃',name:'鲜榨果汁',price:'¥33',img:'',
   ingredients:[{name:'新鲜水果',amount:'顾客自选'}],
   steps:['按顾客选择水果现榨，出品前确认无籽'],
   notes:[]},
  {id:6,sort:6,emoji:'🥃',name:'爱尔兰咖啡',price:'¥45',img:'',
   ingredients:[
     {name:'淡奶油',amount:'50g'},
     {name:'浓缩咖啡',amount:'按当天比例'},
     {name:'65°热水',amount:'165g'},
     {name:'爱尔兰威士忌',amount:'45g（两个小的量杯）'},
     {name:'蜂蜜',amount:'8g'}
   ],
   steps:[
     '爱尔兰咖啡杯加入45g威士忌，再加入8g蜂蜜，吧勺搅匀，尝一口类似old fashion的口感',
     '加入浓缩咖啡和热水165g',
     '打发50g奶油至流动状态，奶油封顶'
   ],
   notes:['奶油不要太稠，大概就是50g膨胀到100g']},
  {id:7,sort:7,emoji:'🍊',name:'君度冰橙美式',price:'¥40',img:'',
   ingredients:[
     {name:'君度利口酒',amount:'45g'},
     {name:'橙汁',amount:'按杯量到8分满'},
     {name:'冰块',amount:'100g'},
     {name:'浓缩咖啡',amount:'按当天比例'}
   ],
   steps:[
     '加入45g君度利口酒和适量橙汁吧勺搅匀，浓缩封顶'
   ],
   notes:[]},
  {id:8,sort:8,emoji:'🍺',name:'黄油啤酒拿铁',price:'¥39',img:'',
   ingredients:[
     {name:'黄油啤酒糖浆',amount:'6g'},
     {name:'牛奶',amount:''},
     {name:'浓缩咖啡',amount:''}
   ],
   steps:[
     '黄油啤酒糖浆 + 浓缩用打发棒打发出泡沫'
   ],
   notes:[]},
  {id:9,sort:9,emoji:'🫖',name:'现煮红枣老白茶',price:'¥39',img:'',
   ingredients:[
     {name:'红枣',amount:'6颗'},
     {name:'老白茶',amount:'8g'}
   ],
   steps:[
     '洗干净红枣用刀切开，壶中加入8g老白茶叶，点火加热8分钟，倒出一壶按人数给小杯子'
   ],
   notes:[]},
  {id:10,sort:10,emoji:'🥜',name:'好事花生',price:'¥43',img:'',
   ingredients:[
     {name:'巧克力花生酱',amount:'10g'},
     {name:'浓缩咖啡',amount:''},
     {name:'淡奶油',amount:'50g'},
     {name:'牛奶',amount:'150g'}
   ],
   steps:[
     '浓缩 + 巧克力花生酱用勺子搅拌均匀，再加入淡奶油打发',
     '高脚杯150g牛奶，咖啡花生奶油封顶搭配苏打饼干'
   ],
   notes:['奶油不要太稠，打稠了可以加入适量牛奶重新打发']},
];

let data = [];
let editMode = false;
let openCards = new Set();

const cloud = {
  mode: 'missing',
  modules: null,
  db: null,
  collectionRef: null,
  unsubscribe: null,
  docIds: new Set(),
  pendingRemote: null,
  lastRemoteHash: '',
  collectionName: '',
  syncTimer: null,
  error: '',
};

function clone(value){
  return JSON.parse(JSON.stringify(value));
}

function sortData(list){
  return list.slice().sort((a,b)=>{
    const left = Number(a.sort ?? a.id ?? 0);
    const right = Number(b.sort ?? b.id ?? 0);
    if(left === right)return Number(a.id) - Number(b.id);
    return left - right;
  });
}

function normalizeData(source){
  const list = Array.isArray(source) ? source : Array.isArray(source && source.data) ? source.data : [];
  return sortData(list.map((item, idx)=>({
    id:Number(item && item.id) || idx + 1,
    sort:Number(item && item.sort) || Number(item && item.id) || idx + 1,
    emoji:item && item.emoji ? String(item.emoji) : '☕',
    name:item && item.name ? String(item.name) : `饮品 ${idx + 1}`,
    price:item && item.price ? String(item.price) : '¥--',
    img:item && item.img ? String(item.img) : '',
    ingredients:Array.isArray(item && item.ingredients)
      ? item.ingredients.map(ing=>({name:String(ing && ing.name || ''), amount:String(ing && ing.amount || '')}))
      : [{name:'', amount:''}],
    steps:Array.isArray(item && item.steps)
      ? item.steps.map(step=>String(step || ''))
      : [''],
    notes:Array.isArray(item && item.notes)
      ? item.notes.map(note=>String(note || ''))
      : [],
  })));
}

function serializeDrink(drink){
  return {
    id:Number(drink.id),
    sort:Number(drink.sort ?? drink.id),
    emoji:String(drink.emoji || '☕'),
    name:String(drink.name || ''),
    price:String(drink.price || '¥--'),
    img:String(drink.img || ''),
    ingredients:(drink.ingredients || []).map(ing=>({
      name:String(ing && ing.name || ''),
      amount:String(ing && ing.amount || ''),
    })),
    steps:(drink.steps || []).map(step=>String(step || '')),
    notes:(drink.notes || []).map(note=>String(note || '')),
  };
}

function esc(value){
  return String(value || '')
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}

function stableDataHash(list){
  return JSON.stringify(sortData(list).map(serializeDrink));
}

function nextId(){
  const ids = data.map(item=>Number(item.id)).filter(Number.isFinite);
  return ids.length ? Math.max(...ids) + 1 : 1;
}

function nextSort(){
  const sorts = data.map(item=>Number(item.sort ?? item.id)).filter(Number.isFinite);
  return sorts.length ? Math.max(...sorts) + 1 : 1;
}

function openAllCards(){
  openCards = new Set(data.map(item=>item.id));
}

function hasLocalDraft(){
  try{
    return !!localStorage.getItem(STORE);
  } catch {
    return false;
  }
}

function getSavedCloudHash(){
  try{
    return localStorage.getItem(CLOUD_HASH_KEY) || '';
  } catch {
    return '';
  }
}

function setSavedCloudHash(hash){
  try{
    localStorage.setItem(CLOUD_HASH_KEY, hash);
  } catch {}
}

function clearSavedCloudHash(){
  try{
    localStorage.removeItem(CLOUD_HASH_KEY);
  } catch {}
}

function persistLocalData(){
  try{
    localStorage.setItem(STORE, JSON.stringify(data));
    return true;
  } catch (error){
    showToast('存储已满，请删除一些图片');
    return false;
  }
}

function save(options = {}){
  const stored = persistLocalData();
  updateStatus();
  if(stored && !options.skipCloud){
    scheduleCloudSync(options.reason || 'auto');
  }
}

function load(){
  try{
    const saved = localStorage.getItem(STORE);
    data = normalizeData(saved ? JSON.parse(saved) : DEFAULT);
  } catch {
    data = normalizeData(DEFAULT);
  }
}

function isCloudConfigured(){
  const cfg = window.COFFEE_SOP_FIREBASE;
  return !!(cfg && cfg.config && cfg.config.apiKey);
}

function isCloudReadyForUpload(){
  return !!(cloud.modules && cloud.db && cloud.collectionRef && cloud.mode !== 'connecting' && cloud.mode !== 'error' && cloud.mode !== 'conflict' && cloud.mode !== 'missing');
}

function updateStatus(){
  const chip = document.getElementById('statusChip');
  const title = document.getElementById('statusTitle');
  const text = document.getElementById('statusText');
  const primaryBtn = document.getElementById('cloudPrimaryBtn');
  const secondaryBtn = document.getElementById('cloudSecondaryBtn');
  const resetBtn = document.getElementById('resetBtn');

  if(!chip || !title || !text || !primaryBtn || !secondaryBtn || !resetBtn)return;

  chip.className = 'status-chip';
  primaryBtn.className = 'status-btn primary';
  primaryBtn.disabled = false;
  secondaryBtn.hidden = true;
  secondaryBtn.disabled = false;
  primaryBtn.hidden = false;

  switch (cloud.mode){
    case 'connecting':
      chip.classList.add('sync');
      chip.textContent = '连接云端';
      title.textContent = '正在连接共享数据';
      text.textContent = '首次打开可能要几秒。连接完成后，大家会看到同一份 SOP。';
      primaryBtn.textContent = '连接中…';
      primaryBtn.disabled = true;
      break;
    case 'empty':
      chip.classList.add('sync');
      chip.textContent = '云端已连接';
      title.textContent = '云端还没有共享内容';
      text.textContent = '现在看到的还是这台手机上的版本。点“上传到云端”后，它会变成全店共享版本。';
      primaryBtn.textContent = '上传到云端';
      break;
    case 'ready':
      chip.classList.add('sync');
      chip.textContent = '实时同步中';
      title.textContent = '大家正在看同一份 SOP';
      text.textContent = '修改会自动保存到云端，其他手机会看到最新内容。当前采用“最后一次保存生效”的方式。';
      primaryBtn.textContent = '立即上传';
      break;
    case 'syncing':
      chip.classList.add('sync');
      chip.textContent = '正在同步';
      title.textContent = '正在保存到云端';
      text.textContent = '这次修改保存完成后，其他手机会看到更新。';
      primaryBtn.textContent = '同步中…';
      primaryBtn.disabled = true;
      break;
    case 'conflict':
      chip.classList.add('warn');
      chip.textContent = '发现两个版本';
      title.textContent = '本机草稿和云端版本不一致';
      text.textContent = '如果这台手机的版本更新，请点“上传本机版本”；如果想直接看别人最新修改，请点“改用云端版本”。';
      primaryBtn.textContent = '上传本机版本';
      secondaryBtn.hidden = false;
      secondaryBtn.textContent = '改用云端版本';
      break;
    case 'error':
      chip.classList.add('warn');
      chip.textContent = '云端失败';
      title.textContent = '云端连接失败';
      text.textContent = cloud.error || '先继续本机编辑也没问题，稍后可以再试一次连接。';
      primaryBtn.textContent = '重试连接';
      break;
    case 'missing':
    default:
      chip.textContent = hasLocalDraft() ? '本机草稿' : PUBLISHED_LABEL;
      title.textContent = '当前还是各手机各自保存';
      text.textContent = '要做到“大家随时看见别人的修改”，还需要把 Firebase 配置填进站点。配置完成后，这里会自动切到实时同步。';
      primaryBtn.hidden = true;
      break;
  }

  resetBtn.disabled = !hasLocalDraft();
}

function exportData(){
  const payload = {
    version:2,
    exportedAt:new Date().toISOString(),
    publishedLabel:PUBLISHED_LABEL,
    data,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const stamp = new Date().toISOString().slice(0,10);
  a.href = url;
  a.download = `coffee-sop-backup-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  showToast('已导出当前备份');
}

function importData(event){
  const file = event.target.files && event.target.files[0];
  if(!file)return;
  const reader = new FileReader();
  reader.onload = loadEvent=>{
    try{
      const parsed = JSON.parse(loadEvent.target.result);
      const nextData = normalizeData(parsed);
      if(!nextData.length)throw new Error('empty');
      data = nextData;
      openAllCards();
      save({skipCloud:true});
      renderList();
      showToast(isCloudConfigured() ? '备份已导入本机，如需共享请点“上传到云端”' : '备份已导入到当前设备');
    } catch {
      showToast('导入失败，请选择正确的 JSON 备份文件');
    } finally {
      event.target.value = '';
    }
  };
  reader.readAsText(file);
}

function resetPublishedData(){
  if(!hasLocalDraft())return;
  if(!confirm('确认恢复到模板版？这台手机上的本机修改会被清除。'))return;
  try{
    localStorage.removeItem(STORE);
  } catch {}
  data = normalizeData(DEFAULT);
  openAllCards();
  clearSavedCloudHash();
  renderList();
  updateStatus();
  showToast('已恢复模板版');
}

function renderList(){
  const q = (document.getElementById('searchInput').value || '').toLowerCase();
  const area = document.getElementById('listArea');
  area.innerHTML = '';
  const list = sortData(data).filter(drink=>
    !q
    || drink.name.toLowerCase().includes(q)
    || (drink.ingredients || []).some(ing=>ing.name.toLowerCase().includes(q))
  );
  if(!list.length){
    area.innerHTML = '<div class="empty"><span class="empty-icon">🔍</span>没有找到匹配的饮品</div>';
    return;
  }
  list.forEach(drink=>area.appendChild(buildCard(drink)));
}

function buildCard(drink){
  const isOpen = openCards.has(drink.id);
  const wrap = document.createElement('div');
  wrap.className = 'card' + (isOpen ? ' open' : '');
  wrap.id = 'card-' + drink.id;

  const hdr = document.createElement('div');
  hdr.className = 'card-hdr';
  hdr.onclick = ()=>toggleCard(drink.id);

  const thumb = document.createElement('div');
  thumb.className = 'card-img-thumb';
  if(drink.img){
    const image = document.createElement('img');
    image.src = drink.img;
    image.alt = '';
    thumb.appendChild(image);
  } else {
    thumb.textContent = drink.emoji || '☕';
  }

  const meta = document.createElement('div');
  meta.className = 'card-meta';

  if(editMode){
    meta.innerHTML = `<input class="edit-name-input" value="${esc(drink.name)}" onchange="upField(${drink.id},'name',this.value)" onclick="event.stopPropagation()"><br>
    <input class="edit-price-input" value="${esc(drink.price)}" onchange="upField(${drink.id},'price',this.value)" onclick="event.stopPropagation()">`;
  } else {
    meta.innerHTML = `<div class="card-name">${esc(drink.name)}</div><span class="card-price">${esc(drink.price)}</span>`;
  }

  const chev = document.createElement('span');
  chev.className = 'card-chev';
  chev.textContent = '▶';

  hdr.appendChild(thumb);
  hdr.appendChild(meta);

  if(editMode){
    const delBtn = document.createElement('button');
    delBtn.className = 'hdr-btn';
    delBtn.style.cssText = 'background:rgba(220,50,50,.12);color:#c0392b;border-color:rgba(220,50,50,.2);font-size:11px;padding:4px 10px';
    delBtn.textContent = '删除';
    delBtn.onclick = event=>{
      event.stopPropagation();
      deleteDrink(drink.id);
    };
    hdr.appendChild(delBtn);
  }

  hdr.appendChild(chev);

  const body = document.createElement('div');
  body.className = 'card-body';
  body.innerHTML = editMode ? buildEditBody(drink) : buildViewBody(drink);

  wrap.appendChild(hdr);
  wrap.appendChild(body);
  return wrap;
}

function toggleCard(id){
  if(openCards.has(id))openCards.delete(id);
  else openCards.add(id);
  const card = document.getElementById('card-' + id);
  if(card)card.classList.toggle('open', openCards.has(id));
  const chev = card && card.querySelector('.card-chev');
  if(chev)chev.style.transform = openCards.has(id) ? 'rotate(90deg)' : '';
}

function buildViewBody(drink){
  let html = '';
  if(drink.img)html += `<img class="card-hero" src="${esc(drink.img)}" alt="">`;
  html += '<div class="sec-label">原料配方</div><div class="ingr-grid">';
  (drink.ingredients || []).forEach(ingredient=>{
    html += `<div class="ingr-row"><div class="ingr-dot"></div>
    <span class="ingr-name-v">${esc(ingredient.name)}</span>
    <span class="ingr-amt-v">${esc(ingredient.amount)}</span></div>`;
  });
  html += '</div><div class="sec-label">制作步骤</div><div class="steps">';
  (drink.steps || []).forEach((step, index)=>{
    html += `<div class="step-row"><div class="step-n">${index + 1}</div><div class="step-t">${esc(step)}</div></div>`;
  });
  html += '</div>';
  if((drink.notes || []).length){
    html += '<div class="sec-label">注意事项</div>';
    drink.notes.forEach(note=>{
      html += `<div class="note-box"><span class="note-icon">⚠</span><div class="note-t">${esc(note)}</div></div>`;
    });
  }
  return html;
}

function buildEditBody(drink){
  let html = '';
  html += '<div class="sec-label">配方图片</div>';
  if(drink.img){
    html += `<div class="img-preview-wrap">
      <img class="img-preview" src="${esc(drink.img)}" alt="">
      <button class="img-remove" onclick="removeImg(${drink.id})">✕ 删除图片</button>
    </div>`;
  } else {
    html += `<div class="img-upload-wrap">
      <label class="img-upload-btn">
        <span>📷</span><span>上传图片</span>
        <input class="img-upload-input" type="file" accept="image/*" onchange="handleImg(event,${drink.id})">
      </label>
    </div>`;
  }

  html += '<div class="sec-label">原料配方</div>';
  (drink.ingredients || []).forEach((ingredient, index)=>{
    html += `<div class="edit-row">
      <input class="ef ef-name" value="${esc(ingredient.name)}" placeholder="原料名称" onchange="upIngr(${drink.id},${index},'name',this.value)">
      <input class="ef ef-amt" value="${esc(ingredient.amount)}" placeholder="用量" onchange="upIngr(${drink.id},${index},'amount',this.value)">
      <button class="del-x" onclick="rmIngr(${drink.id},${index})">✕</button>
    </div>`;
  });
  html += `<button class="add-btn" onclick="addIngr(${drink.id})">＋ 添加原料</button>`;

  html += '<div class="sec-label">制作步骤</div>';
  (drink.steps || []).forEach((step, index)=>{
    html += `<div class="edit-step-row">
      <div class="step-n" style="margin-top:9px">${index + 1}</div>
      <textarea class="ef" rows="2" onchange="upStep(${drink.id},${index},this.value)">${esc(step)}</textarea>
      <button class="del-x" onclick="rmStep(${drink.id},${index})">✕</button>
    </div>`;
  });
  html += `<button class="add-btn" onclick="addStep(${drink.id})">＋ 添加步骤</button>`;

  html += '<div class="sec-label">注意事项</div>';
  (drink.notes || []).forEach((note, index)=>{
    html += `<div class="note-box" style="margin-bottom:5px">
      <span class="note-icon">⚠</span>
      <textarea class="ef edit-note-ta" rows="1" onchange="upNote(${drink.id},${index},this.value)">${esc(note)}</textarea>
      <button class="del-x" onclick="rmNote(${drink.id},${index})">✕</button>
    </div>`;
  });
  html += `<button class="add-btn" onclick="addNote(${drink.id})">＋ 添加注意事项</button>`;
  return html;
}

function toggleEdit(){
  editMode = !editMode;
  const btn = document.getElementById('editBtn');
  btn.textContent = editMode ? '完成' : '编辑';
  btn.className = 'hdr-btn' + (editMode ? ' active' : '');
  document.getElementById('fab').style.display = editMode ? 'flex' : 'none';
  if(editMode)openAllCards();
  updateStatus();
  renderList();
}

function upField(id, field, value){
  const drink = data.find(item=>item.id === id);
  if(!drink)return;
  drink[field] = value;
  save();
}

function upIngr(id, index, field, value){
  const drink = data.find(item=>item.id === id);
  if(!drink || !drink.ingredients[index])return;
  drink.ingredients[index][field] = value;
  save();
}

function upStep(id, index, value){
  const drink = data.find(item=>item.id === id);
  if(!drink)return;
  drink.steps[index] = value;
  save();
}

function upNote(id, index, value){
  const drink = data.find(item=>item.id === id);
  if(!drink)return;
  drink.notes[index] = value;
  save();
}

function rmIngr(id, index){
  const drink = data.find(item=>item.id === id);
  if(!drink)return;
  drink.ingredients.splice(index, 1);
  save();
  renderList();
}

function addIngr(id){
  const drink = data.find(item=>item.id === id);
  if(!drink)return;
  drink.ingredients.push({name:'', amount:''});
  save();
  renderList();
}

function rmStep(id, index){
  const drink = data.find(item=>item.id === id);
  if(!drink)return;
  drink.steps.splice(index, 1);
  save();
  renderList();
}

function addStep(id){
  const drink = data.find(item=>item.id === id);
  if(!drink)return;
  drink.steps.push('');
  save();
  renderList();
}

function rmNote(id, index){
  const drink = data.find(item=>item.id === id);
  if(!drink)return;
  drink.notes.splice(index, 1);
  save();
  renderList();
}

function addNote(id){
  const drink = data.find(item=>item.id === id);
  if(!drink)return;
  drink.notes.push('');
  save();
  renderList();
}

function deleteDrink(id){
  const drink = data.find(item=>item.id === id);
  if(!drink)return;
  if(!confirm(`确认删除「${drink.name}」？此操作不可撤销。`))return;
  data = data.filter(item=>item.id !== id);
  openCards.delete(id);
  save();
  renderList();
}

function fileToDataUrl(file){
  return new Promise((resolve, reject)=>{
    const reader = new FileReader();
    reader.onload = event=>resolve(event.target.result);
    reader.onerror = ()=>reject(new Error('read-failed'));
    reader.readAsDataURL(file);
  });
}

function loadImage(source){
  return new Promise((resolve, reject)=>{
    const image = new Image();
    image.onload = ()=>resolve(image);
    image.onerror = ()=>reject(new Error('image-failed'));
    image.src = source;
  });
}

async function compressImageFile(file){
  const source = await fileToDataUrl(file);
  const image = await loadImage(source);
  const maxWidth = 1440;
  const scale = Math.min(1, maxWidth / image.width);
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(image, 0, 0, width, height);

  let quality = 0.82;
  let dataUrl = canvas.toDataURL('image/jpeg', quality);
  while(dataUrl.length > IMAGE_MAX_DATA_URL_LENGTH && quality > 0.42){
    quality -= 0.08;
    dataUrl = canvas.toDataURL('image/jpeg', quality);
  }

  if(dataUrl.length > IMAGE_MAX_DATA_URL_LENGTH){
    throw new Error('too-large');
  }
  return dataUrl;
}

async function handleImg(event, id){
  const file = event.target.files && event.target.files[0];
  if(!file)return;
  if(file.size > IMAGE_MAX_UPLOAD_BYTES){
    showToast('原图太大，请选择 8MB 以内的图片');
    event.target.value = '';
    return;
  }

  try{
    showToast('正在压缩图片…');
    const compressed = await compressImageFile(file);
    const drink = data.find(item=>item.id === id);
    if(drink){
      drink.img = compressed;
      save();
      renderList();
      showToast('图片已保存并会跟随云端同步');
    }
  } catch {
    showToast('图片仍然偏大，请换一张更小的照片');
  } finally {
    event.target.value = '';
  }
}

function removeImg(id){
  const drink = data.find(item=>item.id === id);
  if(!drink)return;
  drink.img = '';
  save();
  renderList();
}

function openAddModal(){
  document.getElementById('addModal').classList.add('show');
  setTimeout(()=>document.getElementById('newName').focus(), 100);
}

function closeAddModal(){
  document.getElementById('addModal').classList.remove('show');
}

function confirmAdd(){
  const emoji = document.getElementById('newEmoji').value.trim() || '☕';
  const name = document.getElementById('newName').value.trim();
  const price = document.getElementById('newPrice').value.trim() || '¥--';
  if(!name){
    showToast('请输入饮品名称');
    return;
  }
  const newDrink = {
    id:nextId(),
    sort:nextSort(),
    emoji,
    name,
    price,
    img:'',
    ingredients:[{name:'', amount:''}],
    steps:[''],
    notes:[],
  };
  data.push(newDrink);
  openCards.add(newDrink.id);
  save();
  document.getElementById('newEmoji').value = '';
  document.getElementById('newName').value = '';
  document.getElementById('newPrice').value = '';
  closeAddModal();
  renderList();
  showToast(`已添加「${name}」`);
}

function getPrintBlocksHtml(){
  return sortData(data).map(drink=>{
    let html = `<article class="print-drink-block"><div class="print-head"><div><div class="print-drink-name">${esc(drink.emoji)} ${esc(drink.name)}</div><div class="print-price">${esc(drink.price)}</div></div></div>`;
    if(drink.img)html += `<img class="print-img" src="${esc(drink.img)}" alt="">`;
    html += '<div class="print-section">原料配方</div>';
    (drink.ingredients || []).filter(ingredient=>ingredient.name).forEach(ingredient=>{
      html += `<div class="print-ing-row"><span class="print-ing-name">· ${esc(ingredient.name)}</span><span class="print-ing-amt">${esc(ingredient.amount)}</span></div>`;
    });
    html += '<div class="print-section">制作步骤</div>';
    (drink.steps || []).filter(step=>step).forEach((step, index)=>{
      html += `<div class="print-step"><div class="print-step-n">${index + 1}</div><div>${esc(step)}</div></div>`;
    });
    (drink.notes || []).filter(note=>note).forEach(note=>{
      html += `<div class="print-note">⚠ ${esc(note)}</div>`;
    });
    html += '</article>';
    return html;
  }).join('');
}

function getPrintStyles(){
  return `
  *{box-sizing:border-box;margin:0;padding:0}
  @page{size:A4;margin:10mm}
  body{font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Noto Sans CJK SC","Source Han Sans SC",sans-serif;color:#1a1a1a;background:#fff;font-size:14.5px;line-height:1.58}
  .sheet{max-width:190mm;margin:0 auto}
  .cover{margin-bottom:12px;padding-bottom:10px;border-bottom:2px solid #edf1ea}
  h1{font-family:"Iowan Old Style","Palatino Linotype","Songti SC","STSong",serif;font-size:25px;color:#264e28;letter-spacing:.02em}
  .sub{margin-top:4px;font-size:11.5px;color:#66706a}
  .print-drink-block{margin:0 0 12px;border:1px solid #e9dfd1;border-radius:16px;padding:14px 14px 12px;page-break-inside:avoid}
  .print-drink-name{font-family:"Iowan Old Style","Palatino Linotype","Songti SC","STSong",serif;font-size:20px;font-weight:600;color:#264e28;line-height:1.25}
  .print-price{display:inline-flex;margin-top:6px;padding:2px 9px;border-radius:999px;background:#fff6e9;color:#a66e1f;font-size:12px;font-weight:600}
  .print-section{font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#69746e;margin:12px 0 6px}
  .print-ing-row{display:flex;gap:10px;font-size:13.2px;margin-bottom:4px}
  .print-ing-name{flex:1;color:#39433d}
  .print-ing-amt{color:#264e28;font-weight:700;white-space:nowrap}
  .print-step{display:flex;gap:10px;font-size:13.2px;margin-bottom:6px}
  .print-step-n{min-width:22px;height:22px;border-radius:50%;background:#2C5F2E;color:#fff;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px}
  .print-note{background:#fff5e8;border-left:3px solid #c17f2e;padding:8px 10px;font-size:12.5px;color:#7a5c00;margin-top:6px;border-radius:0 8px 8px 0}
  .print-img{width:100%;max-height:180px;object-fit:cover;border-radius:10px;margin-top:12px;border:1px solid #e2e2e2}
  `;
}

function showView(view){
  const app = document.querySelector('.app');
  const fab = document.getElementById('fab');
  if(view === 'print'){
    app.style.display = 'none';
    fab.style.display = 'none';
    showPrintPage();
  }
}

function showPrintPage(){
  const old = document.getElementById('printPage');
  if(old)old.remove();
  const wrap = document.createElement('div');
  wrap.id = 'printPage';
  wrap.style.cssText = 'max-width:900px;margin:0 auto;padding-bottom:28px';

  const toolbar = document.createElement('div');
  toolbar.style.cssText = 'background:var(--brew);color:#fff;padding:12px 14px;display:flex;align-items:center;gap:10px;';
  toolbar.innerHTML = `
    <button onclick="closePrintPage()" style="background:rgba(255,255,255,.15);border:1px solid rgba(255,255,255,.25);border-radius:100px;color:#fff;font-family:var(--sans);font-size:12px;padding:5px 12px;cursor:pointer;">← 返回</button>
    <span style="flex:1;font-family:var(--serif);font-size:15px;font-weight:600;">打印 / 导出</span>
    <button onclick="doPrint()" style="background:#fff;color:var(--brew);border:none;border-radius:100px;font-family:var(--sans);font-size:12px;font-weight:500;padding:6px 14px;cursor:pointer;">🖨 打印</button>
  `;
  wrap.appendChild(toolbar);

  const tip = document.createElement('div');
  tip.style.cssText = 'padding:10px 14px;font-size:12px;color:var(--text-mid);background:#fffbf5;border-bottom:1px solid var(--border)';
  tip.textContent = '字体和留白已按打印版收紧。手机上点「打印」后，选择「另存为 PDF」即可保存。';
  wrap.appendChild(tip);

  const preview = document.createElement('div');
  preview.className = 'print-page';
  preview.innerHTML = `<div class="print-preview"><div class="cover"><h1>☕ 咖啡店 SOP 操作手册</h1><div class="sub">标准操作程序 · 手机查阅与打印共用版</div></div>${getPrintBlocksHtml()}</div>`;
  wrap.appendChild(preview);
  document.body.appendChild(wrap);
}

function closePrintPage(){
  const page = document.getElementById('printPage');
  if(page)page.remove();
  document.querySelector('.app').style.display = '';
  document.getElementById('fab').style.display = editMode ? 'flex' : 'none';
}

function doPrint(){
  const popup = window.open('', '_blank');
  if(!popup)return;
  popup.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>咖啡店 SOP</title><style>${getPrintStyles()}</style></head><body><main class="sheet"><div class="cover"><h1>☕ 咖啡店 SOP 操作手册</h1><div class="sub">标准操作程序 · 手机查阅与打印共用版</div></div>${getPrintBlocksHtml()}</main></body></html>`);
  popup.document.close();
  popup.onload = ()=>popup.print();
}

let toastTimer;
function showToast(message){
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>toast.classList.remove('show'), 2200);
}

function registerServiceWorker(){
  if(!('serviceWorker' in navigator))return;
  window.addEventListener('load', ()=>{
    navigator.serviceWorker.register(`./sw.js?v=${ASSET_VERSION}`, {updateViaCache:'none'}).catch(()=>{});
  });
}

function getFirebaseConfig(){
  const cfg = window.COFFEE_SOP_FIREBASE || {};
  return {
    config:cfg.config || null,
    collection:cfg.collection || 'coffee_sop_drinks',
  };
}

function scheduleCloudSync(reason = 'auto'){
  if(!isCloudReadyForUpload())return;
  if(cloud.mode === 'conflict')return;
  clearTimeout(cloud.syncTimer);
  cloud.mode = 'syncing';
  updateStatus();
  cloud.syncTimer = setTimeout(()=>{
    syncAllToCloud(reason).catch(error=>{
      cloud.mode = 'error';
      cloud.error = '保存到云端失败，请稍后再试。';
      updateStatus();
      console.error(error);
      showToast('云端保存失败，已保留本机内容');
    });
  }, reason === 'manual' ? 40 : 420);
}

async function syncAllToCloud(reason = 'manual'){
  if(!cloud.modules || !cloud.db || !cloud.collectionRef)return;
  const mod = cloud.modules;
  const batch = mod.writeBatch(cloud.db);
  const nextIds = new Set();
  sortData(data).forEach(drink=>{
    const docId = String(drink.id);
    nextIds.add(docId);
    batch.set(mod.doc(cloud.collectionRef, docId), serializeDrink(drink));
  });
  cloud.docIds.forEach(docId=>{
    if(!nextIds.has(docId)){
      batch.delete(mod.doc(cloud.collectionRef, docId));
    }
  });
  await batch.commit();
  cloud.docIds = nextIds;
  cloud.pendingRemote = null;
  const hash = stableDataHash(data);
  cloud.lastRemoteHash = hash;
  cloud.mode = nextIds.size ? 'ready' : 'empty';
  setSavedCloudHash(hash);
  updateStatus();
  if(reason === 'manual')showToast('已上传当前设备版本到云端');
}

function hasUnsyncedLocalDraft(remoteHash){
  if(!hasLocalDraft())return false;
  const localHash = stableDataHash(data);
  return localHash !== remoteHash && localHash !== getSavedCloudHash();
}

function applyRemoteData(nextData){
  data = normalizeData(nextData);
  openAllCards();
  save({skipCloud:true});
  renderList();
}

function adoptCloudVersion(){
  if(!cloud.pendingRemote)return;
  const remoteHash = stableDataHash(cloud.pendingRemote);
  applyRemoteData(cloud.pendingRemote);
  setSavedCloudHash(remoteHash);
  cloud.lastRemoteHash = remoteHash;
  cloud.pendingRemote = null;
  cloud.mode = cloud.docIds.size ? 'ready' : 'empty';
  updateStatus();
  showToast('已切换为云端版本');
}

function handleCloudPrimaryAction(){
  switch (cloud.mode){
    case 'empty':
    case 'ready':
    case 'conflict':
      scheduleCloudSync('manual');
      break;
    case 'error':
      initCloud(true);
      break;
    default:
      break;
  }
}

function handleCloudSecondaryAction(){
  if(cloud.mode === 'conflict'){
    adoptCloudVersion();
  }
}

async function initCloud(force = false){
  if(!isCloudConfigured()){
    cloud.mode = 'missing';
    updateStatus();
    return;
  }
  if(cloud.mode === 'connecting' && !force)return;

  const firebase = getFirebaseConfig();
  cloud.mode = 'connecting';
  cloud.error = '';
  cloud.collectionName = firebase.collection;
  updateStatus();

  try{
    const [{initializeApp, getApp, getApps}, firestore] = await Promise.all([
      import(`https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-app.js`),
      import(`https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-firestore.js`),
    ]);

    if(cloud.unsubscribe){
      cloud.unsubscribe();
      cloud.unsubscribe = null;
    }

    const appName = 'coffee-sop-web';
    const appExists = getApps().some(item=>item.name === appName);
    const app = appExists ? getApp(appName) : initializeApp(firebase.config, appName);

    const db = firestore.getFirestore(app);

    cloud.modules = firestore;
    cloud.db = db;
    cloud.collectionRef = firestore.collection(db, firebase.collection);

    const queryRef = firestore.query(
      cloud.collectionRef,
      firestore.orderBy('sort', 'asc')
    );

    cloud.unsubscribe = firestore.onSnapshot(queryRef, snapshot=>{
      const nextIds = new Set(snapshot.docs.map(docSnap=>docSnap.id));
      cloud.docIds = nextIds;

      if(snapshot.empty){
        cloud.pendingRemote = null;
        cloud.lastRemoteHash = '';
        cloud.mode = 'empty';
        updateStatus();
        return;
      }

      const incoming = normalizeData(snapshot.docs.map(docSnap=>({
        ...docSnap.data(),
        id:Number(docSnap.data().id) || Number(docSnap.id) || Date.now(),
      })));
      const remoteHash = stableDataHash(incoming);

      if(hasUnsyncedLocalDraft(remoteHash)){
        cloud.pendingRemote = incoming;
        cloud.lastRemoteHash = remoteHash;
        cloud.mode = 'conflict';
        updateStatus();
        return;
      }

      cloud.pendingRemote = null;
      cloud.lastRemoteHash = remoteHash;
      applyRemoteData(incoming);
      setSavedCloudHash(remoteHash);
      cloud.mode = 'ready';
      updateStatus();
    }, error=>{
      cloud.mode = 'error';
      cloud.error = '云端监听失败，请检查 Firebase 配置或 Firestore 规则。';
      updateStatus();
      console.error(error);
    });
  } catch (error){
    cloud.mode = 'error';
    cloud.error = '云端初始化失败，请检查 Firebase 配置。';
    updateStatus();
    console.error(error);
  }
}

load();
openAllCards();
renderList();
updateStatus();
document.getElementById('fab').style.display = 'none';
registerServiceWorker();
initCloud();
