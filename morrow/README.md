# Morrow / 马马记账

这是 Morrow 的独立交付目录，不会替换仓库中的 Wordlane 项目。

## 先看这里

- [完整交付与功能说明](MORROW_ERAS_DELIVERY.md)
- [原版代码审查与升级计划](MORROW_AUDIT.md)
- [Eras 模块说明](morrow-preview/eras/README.md)
- [数据库迁移脚本](supabase/migrations)

## 在 Mac 上打开

1. 下载 GitHub 交付分支 ZIP 并解压。
2. 打开此目录中的 `morrow-preview/eras-review.html`，用 Safari 或 Chrome 运行。
3. GitHub 的 HTML 源码页本身不是运行预览，不要将网页源码页当作应用网址。

该文件已内嵌脚本、样式和原创矢量图，无需安装依赖。Garden 数据保存于当前浏览器，不会自动跨设备同步。更换浏览器或文件位置前请备份。

## 开发与测试

在此目录运行：

```sh
npm run preview
npm run build:preview
npm test
npm run test:preview
```

## 当前限制

Garden、Collection、Wrapped 可使用本机保存或明确导入的数据。首页账本、账户和预算仍是标明的演示界面；预算及愿望清单相关成就保持锁定。尚未配置 Supabase 登录、云端同步、实际银行连接或 PWA 安装。SQL 为未执行的提案，不能据此宣称 RLS 或跨设备同步已验证。

导入、恢复前请备份；旧版应用仍保留于此目录根部的 `index.html`，不会自动清空 `xiaoman-v1`。
