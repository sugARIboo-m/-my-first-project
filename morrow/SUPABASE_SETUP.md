# 连接 Supabase：下一步操作

项目已创建，客户端已配置公开地址 `https://hvyuzeqxxkovjshywnhc.supabase.co` 和 publishable key。这里使用项目根地址，不带 `/rest/v1/`。**这不代表托管数据库已初始化或真实云同步已验收。**

## 切换项目时的数据保护

2026-10-25 按用户提供的新公开配置切换项目。旧项目、旧登录令牌和本地数据库未清空。新项目不会自动继承旧项目的数据库或账户。登录后的本地数据库按项目域名和用户 ID 隔离，防止旧项目的版本号或待同步请求发往新项目。未登录花园继续使用原本的本机空间。

如需迁移旧账户数据，请先在旧版本／旧项目的原运行环境导出花园 JSON，保存副本，再在新账户中使用已提供的恢复流程。不要删除旧项目。新数据库是否已建表尚未验证；若之前已在新项目运行 SQL，请先做只读检查，不要重复创建或删除表。

## 现在先做这一件事

1. 打开 [新的 Supabase 项目](https://supabase.com/dashboard/project/hvyuzeqxxkovjshywnhc)，进入 **SQL Editor → New query**。
2. 先复制并运行 [只读检查脚本](supabase/check_eras_setup.sql)，不会修改任何数据。
3. 如果四项都是 `NULL`，说明四个对象尚未创建；这时再复制 [当前同步 SQL 脚本](supabase/migrations/202610180002_eras_snapshot_sync.sql) 的全部内容，在新查询中运行一次。
4. 如果任一项不是 `NULL`，把结果反馈给开发者，检查已有结构后再决定；不要重复创建或删除表。
5. 执行成功后，回复“新项目 SQL 执行成功”。失败时发送错误文字，不需要任何密码。

**建表时只使用 `202610180002_eras_snapshot_sync.sql`。前两份是早期关系型架构提案，不是前置步骤。** 当前迁移故意在名称冲突时失败，事务会回滚，不会覆盖已有表。

本次新增 `morrow_eras.sync_documents`、`morrow_eras.sync_commits` 和 `public.morrow_eras_read` / `public.morrow_eras_commit` 两个 RPC。通过公开 schema 的受认证 RPC 访问，不需要把 `morrow_eras` 加入暴露 schema。用户 ID 来自已验证的登录身份，客户端不能指定其他用户 ID。匿名调用被拒绝，直接表写入被拒绝，RLS 限制查询只读本人记录。

## 首次使用登录与同步

正式使用前应将页面部署至稳定 HTTPS 地址，并在 **Authentication → URL Configuration → Site URL** 填写实际网站地址；需要时在 Redirect URLs 加入同一可信地址。不要填 GitHub 的 `blob` 源码页地址。应用目前没有部署，GitHub 源码链接不是可运行的网站。

静态站点部署建议：保留交付分支 `morrow/eras-delivery-20261018`，以 `morrow/morrow-preview` 为根目录；运行 `node build.mjs`，发布该目录中的静态文件。不要为了部署而覆盖仓库 main 上的 Wordlane。可用 Vercel 的静态站点部署，框架选择 Other；确认所选分支与目录，完成后配置实际 HTTPS 地址。若尚未部署，可先完成 SQL 步骤。

1. 页面打开后，在 **Morrow Cloud / Morrow 云端** 选择“创建 Morrow 账户”。这是你的个人应用账户，不是 Supabase 后台管理员账户。
2. 使用邮箱及独立密码创建账户。若启用了邮箱确认，在邮箱中确认，再回到应用登录。
3. 登录后进入独立账户空间；未登录时的花园不会自动转入账户，也不会被删除。
4. 需要迁移未登录目标时，先在未登录空间导出花园 JSON，再登录并通过“恢复”流程确认导入；不要反复替换不同设备的备份。
5. 阅读上传范围并勾选同意后，点“开启 Eras 同步”。暂停不会删除已上传副本；上传中的请求可能已经在服务端提交。
6. 在另一台设备使用同一个 Morrow 邮箱登录并开启同步。需先完成真实双设备验收，才能确认实际可用。

## 同步范围及数据保护

- 同步实际 Eras 目标、主题、操作记录、个人纪念成就、月度复盘、偏好、Wrapped，以及用户明确导入的完整旧版 JSON 备份。备份可能包含账单、账户及备注，开启前有单独同意说明。
- 新增的独立快速记账账本参与同步；首页演示账单、示例账户和预算不上传。没有连接支付宝、微信或银行。
- 金额使用整数最小货币单位。目标转移仍是同一份完整状态内的原子操作，不会制造收入。
- IndexedDB 同一事务保存本地状态和待提交元数据。发请求前保存不可变请求 ID / payload / 预期版本；断网、页面重开或响应丢失后重试原请求。
- 服务端锁定当前用户，校验完整文档版本后整体提交，并记录幂等回执；旧版本不会静默覆盖新版本。
- 同时修改时停止自动覆盖。用户先保存双方 JSON，确认后选择完整的本机或云端版本，不自动相加金额。选择前再次检查本机版本；服务端版本变化会重新提示冲突。
- 远端替换前在 IndexedDB `recovery` 保存旧状态；云端每次接受的版本也会保留在 `sync_commits`。目前没有历史浏览/清理 UI，应继续定期下载 JSON。
- 纪念成就是个人记录，仍由客户端实际业务数据计算；本次没有实现服务端可信成就判定，也不声称快照等同于规范化生产总账。
- 登录令牌保存在当前浏览器，不放入备份或 GitHub。共享设备请退出登录。不要在聊天中发送数据库密码、secret 或 service_role key。
- 页面壳尚无 Service Worker；已加载页面可离线保存和排队，但冷启动离线/PWA 安装仍未交付。

## 开发环境网络

本次真实请求在代理建立隧道时返回 `403 Forbidden`，尚未到达 Supabase，无法判断公开 key 或项目是否可用。已在环境配置草稿新增域名 `hvyuzeqxxkovjshywnhc.supabase.co`，平台返回 `requires_publish: true`；需要在环境设置中检查、保存并发布配置，然后重新验证连接。保存草稿本身不会改变当前运行环境。

## 本次验证

- 原版 4 项测试、Morrow/Eras/Cloud/Quick entry 44 项单元测试通过。
- Chromium：原首页交互、花园、收藏/Wrapped 原有流程通过。
- 使用两个独立 Chromium profile 和合成 API 验证：登录/未登录隔离、显式同意、完整状态上传/拉取、冲突双方备份、响应丢失后刷新重试不重复提交、离线恢复、中英切换、360/390/768/1440 布局。
- PostgreSQL-WASM 本地执行当前 SQL，通过用户隔离/RLS、匿名 RPC 拒绝、直接表写入拒绝、版本 CAS、幂等、重复请求 ID 载荷校验及畸形文档拒绝。这里使用模拟 `auth.uid()` 的测试环境。
- **未验证：实际 Supabase Auth/邮箱确认、托管 SQL/RLS、真实 Mac/iPhone 同步、Safari、正式 HTTPS 部署、PWA。**

本地 SQL 测试：在项目外临时安装 `@electric-sql/pglite`，通过 `MORROW_PGLITE_MODULE` 指定其模块路径，执行 `node morrow-preview/tests/cloud-sql.mjs`。浏览器测试执行 `node morrow-preview/tests/cloud-browser.cjs`，环境配置方式同交付文档。测试不会请求真实 Supabase。

## 登录提示修复

登录框内可直接切换到创建账户，邮箱会保留、密码会清空。注册响应要求确认邮箱时，显示独立确认步骤，并提供返回登录按钮。已识别的 Supabase 错误分别显示密码不匹配、邮箱未确认、邮箱发送限流等提示；未知错误不回显服务器原文。当前项目邮箱注册开启且需确认，但用户截图中的旧通用错误无法单独证明账户是否已注册；应以新提示及本人邮件为准。

36 项单元测试及新的合成认证浏览器流程通过。没有创建真实测试账户或发送邮件。Netlify 页面有站点访问保护，开发环境匿名访问返回 HTTP 401，因此生产页面更新仍需以 Netlify 新部署记录及用户刷新后的页面确认。

## 快速记账更新

真实账本复用已安装的快照 RPC，无需再次运行 SQL。先登录并开启同步，再进入 [快速记账](https://enchanting-pegasus-4af56c.netlify.app/#quick-entry)，只填金额保存。现有花园及旧版数据保持独立。详见 [QUICK_ENTRY.md](QUICK_ENTRY.md)。
