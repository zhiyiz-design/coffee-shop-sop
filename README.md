# 咖啡店 SOP 小站

一个适合手机浏览器打开的静态 SOP 页面，支持：

- 饮品 SOP 搜索与查阅
- 本机编辑、图片上传、打印 / PDF 导出
- JSON 备份导出 / 导入
- 添加到手机桌面与基础离线缓存

## 本地预览

```bash
cd /Users/zoeymac/Documents/Work/coffe
python3 -m http.server 4173
```

然后访问 `http://localhost:4173/`。

## 当前数据逻辑

- `index.html` 里的 `DEFAULT` 是门店发布版内容。
- 页面编辑后会保存到当前手机或浏览器的 `localStorage`。
- 这些本机修改不会自动同步到其他手机。
- 需要统一更新时，请修改发布版后重新部署站点。

## GitHub Pages 部署

```bash
git init
git branch -M main
git add .
git commit -m "Publish coffee SOP site"
gh repo create coffee-shop-sop --public --source=. --remote=origin --push
gh api repos/zhiyiz-design/coffee-shop-sop/pages -X POST -f source[branch]=main -f source[path]=/
```

部署完成后，默认链接会是：

`https://zhiyiz-design.github.io/coffee-shop-sop/`

## 后续如果要做真正的多人同步

下一步应增加后端存储，比如 Supabase、Firebase 或一个简单的管理后台。那样店长在任意设备修改后，所有店员打开同一链接都能看到最新内容。
