# Firebase 云端同步设置

这个站点已经支持 Firebase Firestore 实时同步。

## 1. 创建项目

1. 打开 [Firebase Console](https://console.firebase.google.com/)
2. 新建一个项目
3. 在项目里添加一个 Web App
4. 复制 Web App 的配置对象

## 2. 填配置

把配置粘到 [firebase-config.js](/Users/zoeymac/Documents/Work/coffe/firebase-config.js) 的 `config` 里。

## 3. 开通 Firestore

在 Firebase Console 中创建 Cloud Firestore 数据库。

## 4. 设置规则

如果你坚持“不登录、所有人都能编辑”，可以先用下面这组最宽松的规则：

```txt
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /coffee_sop_drinks/{document} {
      allow read, write: if true;
    }
  }
}
```

注意：这意味着知道站点链接的人，理论上都能改数据。

## 5. 重新部署

填完配置后重新推送仓库，GitHub Pages 会自动更新。

## 6. 首次迁移旧手机数据

因为之前每台手机各自存了一份本地草稿，切到云端后的第一次使用建议这样做：

1. 先在每台手机上点“导出备份”
2. 选一台内容最全的手机作为基准
3. 在这台手机上点“上传到云端”
4. 其他手机如果提示本机草稿与云端不同，可以选择：
   - “上传本机版本”
   - 或“改用云端版本”

之后再编辑，就会按“最后一次保存生效”的方式自动同步。
