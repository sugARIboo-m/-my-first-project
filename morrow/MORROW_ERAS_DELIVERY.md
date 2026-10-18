# Morrow Eras — 本机功能交付与后续配置

## 当前状态

用户已确认保留简洁矢量花园方向，Charm Garden 按修订后的 Intimate / Warm / Effortless 设计。现已实现本机 Garden、Collection、Wrapped 以及三者的真实本机数据关联。**这不是已经部署、已经云同步或已完成全产品财务系统的版本。**

旧版 app.js、finance.js、index.html、style.css 与原测试保持原样；原版小满的 localStorage 键不会被自动读取、清空或覆盖。Morrow 首页收入、支出、预算、账户仍为清楚标记的演示界面，其模拟操作不参与 Eras。

## 代码位置

```text
morrow-preview/
  index.html / preview.css / preview.js  原有 Morrow 界面及 Eras 挂载点
  build.mjs                            无依赖单文件生成
  morrow.html                          生成的完整本机页面
  eras-review.html                     生成的页面，打开后定位 Eras
  eras/
    domain.js                          目标、阶段、分配转移、迁移校验
    store.js                           IndexedDB 事务、恢复快照、跨标签页通知
    art.js / assets/*.svg               四主题 × 五阶段原创 SVG
    messages.js / styles.css / ui.js    花园双语及交互
    experience-domain.js               成就判定、实际账单读取、年度/月度汇总
    experiences.js                     收藏、年度叙事卡、隐私导出
    generate-assets.mjs / README.md
  tests/
    domain.test.js / eras.test.js / experiences.test.js
    browser.cjs / eras-browser.cjs / experiences-browser.cjs
supabase/migrations/
  202610170001_garden_foundation.sql
  202610180001_collection_wrapped.sql
```

## 已实现

- 四套原创主题与二十张 SVG；生长严格按保存的目标金额计算，展台阶段不改变财务数据。
- 新建／编辑／暂停目标、货币、期限、主题；金额整数分，零目标安全拒绝。
- 目标间同币种分配原子转移、操作 ID 幂等、合计守恒，不视为收入或新增资产。分配只是手动记录，不实际移动银行资金。
- 本机目标持久化，跨标签页通知与版本冲突检查。余额下降仍保留历史首次盛放及当时主题。
- PNG 盛放纪念卡不包含目标名、金额、账户、备注，不自动发布。
- 17 项成就定义：三档储蓄、目标完成、记录习惯、财务觉察、个人 Era。判定使用实际本机目标与明确导入的账单，具有唯一 code、发现时间、主题、稀有度和原始条件元数据。
- 已解锁／未解锁收藏卡、Era 筛选、日期排序、详情和隐私 PNG 导出。历史纪念与当前进度分别展示；重复操作不重复解锁。
- 储蓄门槛按用户货币配置，使用单个目标的最大有效余额，避免叠加可能重叠的旧版总余额与独立分配。
- 年度回顾分四张叙事卡，含实际收入、支出、净现金流、现金流储蓄率、分类、记账日期和目标里程碑。金额来源与公式在界面明示，不将结余冒充银行资产增长。
- 无实际账单来源时金额显示未知，零收入不产生无穷储蓄率。无年份数据时展示空状态，不生成虚假快照。
- 年度目标分配统计不计初始余额、旧余额导入或目标转移；旧版已完成目标不会被伪造成导入年份刚完成。
- 回顾快照以内容摘要幂等保存；真正保存一份有实际数据的回顾后才解锁相应成就。
- 明确导入的实际月份可复盘；演示月份或空月份不能解锁。20/30 天记录习惯不要求强制连续打卡。
- 英文／简体中文、Light/Dark/System、系统 Reduce Motion 与本机花园动效偏好、Mac/iPhone 宽度布局。
- Garden V1 到 V2 只增加成就／复盘／回顾元数据，保持金额不变并保留原恢复快照。JSON 备份、导入确认、替换恢复和旧目标兼容仍可用。

## 尚未完成及依赖

1. 用户已创建 Supabase 项目并提供公开连接配置。已新增邮箱密码登录、用户独立本地空间、显式开启同步、持久化待提交快照、版本 CAS、幂等、离线重试及冲突双副本选择代码；当前环境访问项目域名仍被网络代理拒绝，托管 SQL 尚未确认执行，不能宣称真实云同步已经完成。操作见 [Supabase 配置步骤](SUPABASE_SETUP.md)。
2. 本次仅使用新增的 `202610180002_eras_snapshot_sync.sql`；前两份是早期规范化 schema 提案，不是前置步骤。当前快照 SQL 已通过本地 PostgreSQL-WASM 的 RLS/CAS/幂等测试，尚未在托管 Supabase 验证。成就是客户端计算的个人纪念快照，不是服务端可信判定。
3. Morrow 原有实际持久化记账／账户／预算基础尚未建立。当前 Wrapped 的真实账单来源是经用户确认的旧版 JSON 快照，非实时银行或生产账本。预算创建／预算复盘／愿望清单冷静期相关成就保留定义并锁定，不用演示数据假解锁。
4. 尚无真实 Safari/iPhone 安装测试，也没有注册 PWA Service Worker 或部署网站。已打开页面中的 Garden 本机写入无需网络；离线恢复已做合成 API 测试，但冷启动离线壳、PWA 安装和真实跨设备恢复未验收。
5. 日期为用户填写的目标日期，不是假定的预计完成日期。因缺少可靠贡献节奏，完成时间预测显示明确空状态。
6. GitHub 交付版本以独立 morrow/ 目录保存于交付分支，避免覆盖仓库现有的 Wordlane 项目。文档和 HTML 源码可在 GitHub 查看或下载；这不代表已经部署网页或实现云同步。

## 运行及验证

```sh
cd morrow
node morrow-preview/eras/generate-assets.mjs
npm run build:preview
npm run preview
npm test
npm run test:preview
```

在 Mac 上先下载并解压 GitHub 交付分支，再进入其中的 morrow 文件夹。单文件页面为本机构建产物，没有外部字体、图像或脚本依赖。浏览器和站点地址决定 IndexedDB 的存储范围，换设备、域名、端口或本地文件位置之前应导出备份。

浏览器脚本需 Playwright（验证版本 1.62.1）及 Chromium。可通过 `MORROW_PLAYWRIGHT_MODULE`、`MORROW_CHROMIUM_PATH`、`MORROW_PREVIEW_URL` 配置测试环境，截图写到临时文件夹。脚本只用合成测试记录，不读取真实个人账单。

## 测试证据

- 原版 4 项测试通过。
- Morrow／Eras／Cloud 33 项单元与业务测试通过：阶段边界、无效目标、金额精度、幂等、历史保留、分配守恒、冲突、币种隔离、迁移、成就、实际年度统计、空状态和 V1 元数据升级。
- 花园 Chromium：20 张视觉资产、360/390/768/1500 无页面横向溢出；新建／编辑／刷新保留、盛放 PNG、转移、历史纪念、演示账单隔离和动效设置通过。
- 收藏／Wrapped Chromium：17 卡、无数据空状态、备份后确认导入、实际金额与 98% 测试储蓄率、PNG 默认隐私、快照去重、月度复盘、币种隔离、中英切换、响应式、刷新后成就保留通过。
- 新增本地 PostgreSQL-WASM SQL/RLS/CAS/幂等验证，以及两个独立 Chromium profile 的合成 API 同步、响应丢失重试、冲突及离线恢复测试通过。
- 未运行：托管 Supabase SQL/RLS/Auth、真实双设备、Safari、PWA、真实服务远端断网重试。

## Supabase 下一步

请按 [SUPABASE_SETUP.md](SUPABASE_SETUP.md) 先运行当前快照同步 SQL，再配置实际 HTTPS 站点与邮箱认证，最后进行真实双设备验收。公开 URL/key 已配置；不要提供任何管理员密钥。
