# 咖啡店 SOP 小站

一个适合手机浏览器打开的静态 SOP 页面，支持：

- 饮品 SOP 搜索与查阅
- 本机编辑、图片上传、打印 / PDF 导出
- JSON 备份导出 / 导入
- Firebase Firestore 实时同步（填好配置后生效）
- 添加到手机桌面与基础离线缓存

## 本地预览

```bash
cd /Users/zoeymac/Documents/Work/coffe
python3 -m http.server 4173
```

然后访问 `http://localhost:4173/`。

## 目录说明

- [index.html](/Users/zoeymac/Documents/Work/coffe/index.html) 页面结构与样式
- [app.js](/Users/zoeymac/Documents/Work/coffe/app.js) 主逻辑、编辑、打印、云端同步
- [firebase-config.js](/Users/zoeymac/Documents/Work/coffe/firebase-config.js) Firebase 配置入口
- [FIREBASE_SETUP.md](/Users/zoeymac/Documents/Work/coffe/FIREBASE_SETUP.md) Firebase 设置步骤
- [wechat-miniprogram](/Users/zoeymac/Documents/Work/coffe/wechat-miniprogram) 微信小程序版本

## 当前数据逻辑

- 默认情况下，页面仍会把数据存到当前手机或浏览器的 `localStorage`。
- 如果 [firebase-config.js](/Users/zoeymac/Documents/Work/coffe/firebase-config.js) 里已经填好 Firebase 配置，页面会自动尝试连接 Firestore。
- 云端同步启用后，修改会自动同步到共享数据。
- 如果本机草稿和云端版本不一致，页面会先提示你选择“上传本机版本”或“改用云端版本”，避免静默覆盖。
- 当前同步策略是“最后一次保存生效”。

## GitHub Pages 部署

```bash
git init
git branch -M main
git add .
git commit -m "Publish coffee SOP site"
gh repo create coffee-shop-sop --public --source=. --remote=origin --push
gh api repos/zhiyiz-design/coffee-shop-sop/pages -X POST -F 'source[branch]=main' -F 'source[path]=/'
```

部署完成后，默认链接会是：

`https://zhiyiz-design.github.io/coffee-shop-sop/`

## 更稳定的备用网址

如果 GitHub Pages 在手机网络上偶尔打不开，建议同时开一个 Cloudflare Pages 或 Firebase Hosting 入口。两个入口可以指向同一份代码和同一份 Firestore 数据。

### Cloudflare Pages

1. 打开 `https://dash.cloudflare.com/`。
2. 进入 `Workers & Pages`，选择 `Create application`。
3. 选择 `Pages`，再选择 `Connect to Git`。
4. 授权 GitHub 仓库 `zhiyiz-design/coffee-shop-sop`。
5. 构建设置选择：
   - Framework preset: `None`
   - Build command: 留空
   - Build output directory: `/`
6. 部署完成后，会得到一个 `*.pages.dev` 链接。

仓库里的 [_headers](/Users/zoeymac/Documents/Work/coffe/_headers) 会让浏览器每次重新确认页面版本，减少手机端长期卡旧版的问题。

### Firebase Hosting

这条路会得到 `coffee-app-430df.web.app` 和 `coffee-app-430df.firebaseapp.com` 两个入口。

```bash
cd /Users/zoeymac/Documents/Work/coffe
npx firebase-tools login
npx firebase-tools deploy --only hosting
```

仓库里的 [firebase.json](/Users/zoeymac/Documents/Work/coffe/firebase.json) 已经配置好静态文件目录和缓存策略。

## 启用多人同步

按 [FIREBASE_SETUP.md](/Users/zoeymac/Documents/Work/coffe/FIREBASE_SETUP.md) 完成 Firestore 配置后：

- 所有手机会订阅同一份云端 SOP
- 编辑完成后会自动同步
- PDF 打印版会沿用同一份最新数据
