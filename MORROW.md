# Morrow / 马马记账交付入口

Morrow 的文档与源码放在独立的 **[morrow/](morrow/)** 文件夹。仓库现有 Wordlane 文件保持不变。

- **[快速记账使用说明](morrow/QUICK_ENTRY.md)**
- **[阅读完整交付文档](morrow/MORROW_ERAS_DELIVERY.md)**
- [Mac 使用方法](morrow/README.md)
- [单文件 HTML 源码](morrow/morrow-preview/eras-review.html)
- **[Supabase 配置：现在先运行 SQL](morrow/SUPABASE_SETUP.md)**
- [当前同步 SQL](morrow/supabase/migrations/202610180002_eras_snapshot_sync.sql)

若要在 Mac 使用：在当前交付分支点击 **Code → Download ZIP**，解压后用 Safari 或 Chrome 打开 `morrow/morrow-preview/eras-review.html`。GitHub 上的 HTML 源码页不是在线应用。

已有 Netlify 部署及 Supabase 配置。当前独立快速记账可实际保存，并复用云快照通道；原首页概览仍为演示。请先阅读快速记账说明。模拟跨设备测试已通过，真实双设备仍待验收。不要在 Issue 或聊天中发送数据库密码或管理员密钥。
