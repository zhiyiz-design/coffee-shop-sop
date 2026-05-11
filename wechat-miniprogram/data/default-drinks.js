const DEFAULT_DRINKS = [
  { id: 1, sort: 1, emoji: '🧂', name: '海盐芝士月白', price: '¥43', img: '', ingredients: [
    { name: 'Espresso 浓缩', amount: '标准份量' },
    { name: '热水（65°C）', amount: '150g' },
    { name: '焦糖海盐糖浆（咖啡底）', amount: '6g' },
    { name: 'Kiri 奶油芝士', amount: '35g' },
    { name: '淡奶油', amount: '15g' },
    { name: '焦糖海盐糖浆（奶盖）', amount: '6g' },
    { name: '奥利奥饼干', amount: '少许' }
  ], steps: [
    '浓缩倒入 150g 65°C 热水，加 6g 焦糖海盐糖浆搅匀（咖啡底）',
    '35g Kiri + 15g 淡奶油 + 6g 糖浆 + 少许奥利奥一起打发（奶盖）',
    '奶盖铺在咖啡液面上，顶部撒奥利奥碎装饰'
  ], notes: ['不要打太久！过度打发会固化，影响口感'] },
  { id: 2, sort: 2, emoji: '🍵', name: '抹茶拿铁', price: '¥39', img: '', ingredients: [
    { name: '抹茶粉', amount: '4g' },
    { name: '蜂蜜', amount: '2.5g' },
    { name: '热水（第一次）', amount: '10g' },
    { name: '热水（第二次）', amount: '20g' },
    { name: '牛奶 / 燕麦奶', amount: '按杯型' }
  ], steps: [
    '抹茶粉 + 蜂蜜，第一次注水 10g，茶筅充分打成泥状（无颗粒）',
    '第二次注水 20g，继续搅打至细腻均匀',
    '打发奶泡，抹茶糊倒入杯中，缓缓注入奶泡'
  ], notes: ['分两次加水：第一次少量打泥，第二次再加，避免结块'] },
  { id: 3, sort: 3, emoji: '☕', name: '泡沫美式（芭乐/百香果/荔枝）', price: '¥31', img: '', ingredients: [
    { name: 'Espresso 浓缩', amount: '标准份量' },
    { name: '冰块', amount: '七分满' },
    { name: '苏打水 / 气泡水', amount: '八分满' },
    { name: '风味糖浆', amount: '15ml' }
  ], steps: [
    '杯中加满冰块',
    '注入苏打水至八分满，加入对应风味糖浆轻轻搅动',
    '缓缓倒入 Espresso，形成分层效果即可'
  ], notes: [] },
  { id: 4, sort: 4, emoji: '🌿', name: '抹茶椰子糖', price: '¥39', img: '', ingredients: [
    { name: '抹茶糊（参考抹茶拿铁）', amount: '按量' },
    { name: '椰浆', amount: '按杯型' }
  ], steps: ['配方待确认，暂用占位'], notes: ['配方待补充，请询问店长确认'] },
  { id: 5, sort: 5, emoji: '🧃', name: '鲜榨果汁', price: '¥33', img: '', ingredients: [
    { name: '新鲜水果', amount: '顾客自选' }
  ], steps: ['按顾客选择水果现榨，出品前确认无籽'], notes: [] },
  { id: 6, sort: 6, emoji: '🥃', name: '爱尔兰咖啡', price: '¥45', img: '', ingredients: [
    { name: '淡奶油', amount: '50g' },
    { name: '浓缩咖啡', amount: '按当天比例' },
    { name: '65°热水', amount: '165g' },
    { name: '爱尔兰威士忌', amount: '45g（两个小的量杯）' },
    { name: '蜂蜜', amount: '8g' }
  ], steps: [
    '爱尔兰咖啡杯加入45g威士忌，再加入8g蜂蜜，吧勺搅匀，尝一口类似old fashion的口感',
    '加入浓缩咖啡和热水165g',
    '打发50g奶油至流动状态，奶油封顶'
  ], notes: ['奶油不要太稠，大概就是50g膨胀到100g'] },
  { id: 7, sort: 7, emoji: '🍊', name: '君度冰橙美式', price: '¥40', img: '', ingredients: [
    { name: '君度利口酒', amount: '45g' },
    { name: '橙汁', amount: '按杯量到8分满' },
    { name: '冰块', amount: '100g' },
    { name: '浓缩咖啡', amount: '按当天比例' }
  ], steps: ['加入45g君度利口酒和适量橙汁吧勺搅匀，浓缩封顶'], notes: [] },
  { id: 8, sort: 8, emoji: '🍺', name: '黄油啤酒拿铁', price: '¥39', img: '', ingredients: [
    { name: '黄油啤酒糖浆', amount: '6g' },
    { name: '牛奶', amount: '' },
    { name: '浓缩咖啡', amount: '' }
  ], steps: ['黄油啤酒糖浆 + 浓缩用打发棒打发出泡沫'], notes: [] },
  { id: 9, sort: 9, emoji: '🫖', name: '现煮红枣老白茶', price: '¥39', img: '', ingredients: [
    { name: '红枣', amount: '6颗' },
    { name: '老白茶', amount: '8g' }
  ], steps: ['洗干净红枣用刀切开，壶中加入8g老白茶叶，点火加热8分钟，倒出一壶按人数给小杯子'], notes: [] },
  { id: 10, sort: 10, emoji: '🥜', name: '好事花生', price: '¥43', img: '', ingredients: [
    { name: '巧克力花生酱', amount: '10g' },
    { name: '浓缩咖啡', amount: '' },
    { name: '淡奶油', amount: '50g' },
    { name: '牛奶', amount: '150g' }
  ], steps: [
    '浓缩 + 巧克力花生酱用勺子搅拌均匀，再加入淡奶油打发',
    '高脚杯150g牛奶，咖啡花生奶油封顶搭配苏打饼干'
  ], notes: ['奶油不要太稠，打稠了可以加入适量牛奶重新打发'] }
];

function cloneDrinks() {
  return JSON.parse(JSON.stringify(DEFAULT_DRINKS));
}

module.exports = {
  DEFAULT_DRINKS,
  cloneDrinks
};
