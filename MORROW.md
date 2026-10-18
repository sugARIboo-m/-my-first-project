# Morrow / 马马记账交付入口

Morrow 的文档与源码放在独立的 **[morrow/](morrow/)** 文件夹。仓库现有 Wordlane 文件保持不变。

- **[阅读完整交付文档](morrow/MORROW_ERAS_DELIVERY.md)**
- [Mac 使用方法](morrow/README.md)
- [单文件 HTML 源码](morrow/morrow-preview/eras-review.html)
- **[Supabase 配置：现在先运行 SQL](morrow/SUPABASE_SETUP.md)**
- [当前同步 SQL](morrow/supabase/migrations/202610180002_eras_snapshot_sync.sql)

若要在 Mac 使用：在当前交付分支点击 **Code → Download ZIP**，解压后用 Safari 或 Chrome 打开 `morrow/morrow-preview/eras-review.html`。GitHub 上的 HTML 源码页不是在线应用。

已接入公开 Supabase 配置和 Eras 登录/同步代码，但尚未部署网站或完成托管数据库及真实双设备验证。请先完成配置文档中的 SQL 步骤。不要在 Issue 或聊天中发送数据库密码或管理员密钥。
