# Toastmasters Agenda Builder：AI 项目上下文与交接协议

> 主要读者：AI coding agent。人类开发者也可将其作为项目地图使用。
> 最后人工核对：2026-07-13（Asia/Shanghai）。
> 唯一远端事实来源：`origin/main`。每次任务开始必须重新 fetch，不得把本文记录的 commit 当成永久最新状态。
> 最近一次应用代码基线：`cc5537c`；之后可能存在仅修改文档的提交。

## 0. AI 必读：开始任务前的强制协议

### 0.1 启动顺序

AI 在分析或编辑代码前，按顺序执行：

```powershell
git fetch --prune origin
git status -sb
git branch --show-current
git log -1 --oneline --decorate
git rev-list --left-right --count HEAD...origin/main
```

然后：

1. 阅读本文件的第 0、3、5、8、10、12、15、17 节。
2. 根据用户任务再读取相关源码、测试和历史 commit；不要一次性加载全部大型 HTML。
3. 如果工作区有未提交改动，先确认其来源和范围，绝不覆盖或回滚未知改动。
4. 如果本地不是最新 `origin/main`，先判断是否能 `--ff-only` 更新；不要擅自 rebase、reset 或强推。
5. 先复述当前任务边界，再实施最小必要改动。

### 0.2 当前产品重点

- 当前优先方向是议程生成器，尤其是 `agenda_generator_modern.html` 的跨端视觉与编辑效率。
- 时间官 `index.html` 已具备独立现场副本、计时和记录能力；除非用户明确要求，不要顺手重构时间官。
- 经典版 `agenda_generator.html` 是稳定生产基线；Modern 版是正在优化的替代布局。
- 2026-07-10 至 2026-07-13 的 Modern 视觉审查只产出了问题清单，尚未实施修复。具体见第 15 节。

### 0.3 不可破坏的数据与行为约束

任何实现方案都必须保持：

- 纯静态 HTML/CSS/JS，不引入 React、Vue 或构建系统。
- localStorage key 及其既有语义保持兼容。
- 议程生成器数据不会被时间官现场调整反向写回。
- 时间官同步不得清空 `tm_timekeeper_records_v1`。
- 时间官中 `active` / `done` 或已有 `actualStart` / `actualEnd` 的项目不得被新议程覆盖。
- `speaker`、`detail`、`scheduledTime` 在生成器到时间官的同步中保留。
- 旧 localStorage、旧 JSON 导出和旧云端草稿继续可读取。
- Supabase 写入只能经过 `agenda-drafts` Edge Function，不恢复匿名直写 RPC。
- 不提交 access token、service-role key、rate-limit salt、私密 draft URL 或用户数据。

### 0.4 修改路由

| 任务类型 | 首先检查 | 通常需要同步检查 |
| --- | --- | --- |
| Agenda 数据字段/导入导出 | `js/agenda-data.js`、`js/agenda-templates.js` | 两个 generator HTML、JSON、localStorage、cloud tests |
| 生成器到时间官同步 | `js/agenda-schema.js`、`js/storage.js` | 两个 generator HTML、`index.html`、schema tests |
| 计时规则 | `js/time-rules.js` | generator 规则摘要、timekeeper 上下文、相关 tests |
| 接龙导入 | `js/agenda-relay-importer.js` | 模板 skeleton、两个 generator HTML、relay tests |
| 云同步 | `js/agenda-cloud-sync.js`、Edge Function、migration | CORS、版本冲突、smoke test、部署工作流 |
| 经典版视觉/打印 | `agenda_generator.html` | A4/print/mobile tests 与 1440/390/412 截图 |
| Modern 视觉/交互 | `agenda_generator_modern.html` | 经典版共享行为是否仍一致、三端截图 |
| 时间官行为 | `index.html`、`js/timekeeper-state.js` | localStorage、记录、同步兼容与 timer tests |

### 0.5 AI 的完成标准

除非用户明确缩小范围，一个代码任务只有在以下条件满足后才算完成：

1. 实现目标行为，且没有修改无关模块。
2. `npm test` 通过。
3. `git diff --check` 通过。
4. UI 改动按风险检查 1440 × 1000、390 × 844、412 × 915；确认无横向滚动和遮挡。
5. Supabase 改动运行 `npm run smoke:supabase`，并检查部署 workflow。
6. 明确报告修改文件、验证结果、未验证项和遗留风险。
7. 只有用户明确要求发布时才 push；发布后确认目标分支、Pages 和 Supabase workflow 状态。
8. 如任务改变了架构、协议、部署、当前待办或重要历史，更新本文件。

## 1. 项目速览

| 项目 | 当前值 |
| --- | --- |
| GitHub 仓库 | `https://github.com/Scorpioapn/Scorpioapn.github.io` |
| 默认/发布分支 | `main` |
| GitHub Pages | `https://scorpioapn.github.io/` |
| 经典议程生成器 | `https://scorpioapn.github.io/agenda_generator.html` |
| Modern 议程生成器 | `https://scorpioapn.github.io/agenda_generator_modern.html` |
| 时间官 | `https://scorpioapn.github.io/index.html` |
| Supabase 项目 ref | `nixguazietjzvcztbueh` |
| Supabase URL | `https://nixguazietjzvcztbueh.supabase.co` |
| 技术形态 | 纯静态 HTML/CSS/JS，无构建系统、无前端框架 |
| 测试命令 | `npm test` |
| 线上 Supabase smoke test | `npm run smoke:supabase` |

截至 2026-07-13 的最近一次核对：

- GitHub Pages 已成功发布包含 `HANDOFF.md` 的文档提交。
- 最近一次应用代码提交 `cc5537c` 的 Pages 与 Supabase workflow 均成功。
- 线上 Pages 来源为 `main` 分支根目录 `/`。

这些状态会变化。开始工作前应重新运行 `git fetch` 和本文中的状态检查命令，不要只依赖这段快照。

## 2. 在新机器上开始

### 2.1 前置工具

- Git。
- Node.js。CI 当前使用 Node.js 24；本地建议使用 Node.js 22 或 24。
- Python 3（仅用于启动简单静态服务器，可选）。
- GitHub CLI `gh`（检查 Actions、Pages 或发布时使用，可选）。
- Supabase CLI（修改数据库迁移或 Edge Function 时才需要）。

### 2.2 克隆与验证

```powershell
git clone https://github.com/Scorpioapn/Scorpioapn.github.io.git
cd Scorpioapn.github.io
git switch main
git pull --ff-only origin main
npm test
```

确认当前状态：

```powershell
git status -sb
git log -1 --oneline --decorate
git remote -v
```

### 2.3 本地预览

项目不需要安装前端依赖，也不需要编译。可在仓库根目录运行：

```powershell
python -m http.server 8000
```

然后打开：

- `http://localhost:8000/agenda_generator.html`
- `http://localhost:8000/agenda_generator_modern.html`
- `http://localhost:8000/index.html`

生产 Edge Function 默认只允许 `https://scorpioapn.github.io` 作为浏览器 Origin。本地页面的云同步可能收到 `origin_not_allowed`，这不代表静态页面本身损坏。不要为了普通 UI 开发随意放宽生产 CORS；可用 `npm run smoke:supabase` 验证生产同步链路。

## 3. 主要页面与职责

| 文件 | 职责 | 维护提示 |
| --- | --- | --- |
| `agenda_generator.html` | 经典议程编辑器、A4 预览、打印/保存 PDF、模板、接龙导入、云同步、同步到时间官 | 当前稳定版；2026-07-06 完成打印可读性与移动端密度修复 |
| `agenda_generator_modern.html` | Modern 编辑器，功能与经典版基本一致，使用另一套响应式工作台布局 | 视觉替代版；仍有移动端待修问题，见“当前待办” |
| `index.html` | 时间官现场计时、议程副本、记录、报告和现场调整 | 不得回写议程生成器原始数据 |

两个议程生成器共享 `js/` 下的数据、模板、同步和规则模块，但页面 DOM、CSS 和大量页面级控制代码仍分别存在于两个大型 HTML 文件中。

因此：

- 修改共享数据协议时优先修改 `js/` 模块。
- 修改页面行为时检查经典版和 Modern 版是否都需要同步。
- 不要把项目迁移到 React、Vue 或新的构建系统，除非产品负责人明确改变技术方向。

## 4. 目录地图

```text
.
|-- agenda_generator.html             # 经典议程生成器
|-- agenda_generator_modern.html      # Modern 议程生成器
|-- index.html                        # 时间官
|-- assets/                           # Logo、二维码、字体等静态资源
|-- js/                               # 浏览器/CommonJS 共享模块
|   |-- agenda-data.js                # 议程 payload 校验与归一化
|   |-- agenda-schema.js              # 生成器 -> 时间官转换/合并协议
|   |-- agenda-templates.js           # 默认数据与可选模板
|   |-- agenda-relay-importer.js      # 微信接龙解析与合并
|   |-- agenda-cloud-sync.js          # Supabase 草稿同步状态机
|   |-- storage.js                    # 共享 localStorage key 与 JSON helper
|   |-- time-rules.js                 # 计时规则推导与文案
|   |-- timekeeper-state.js           # 时间官状态辅助函数
|   |-- export-safety.js              # CSV/导出内容安全处理
|   |-- supabase-config.js            # 可公开的 URL 与 publishable key
|   `-- vendor/                        # 固定版本的浏览器 vendor 脚本
|-- src/shared/agendaCore.mjs          # 可测试的核心议程逻辑
|-- supabase/
|   |-- functions/agenda-drafts/      # 公开 capability-link Edge Function
|   |-- functions/_shared/            # Edge Function 请求策略与校验
|   `-- migrations/                   # 草稿、版本冲突、限流等迁移
|-- scripts/supabase-smoke-test.mjs   # 线上 preflight/create/get/save 测试
|-- tests/                             # Node 静态与行为测试
|-- .github/workflows/                # Supabase 自动部署工作流
`-- docs/superpowers/                 # 历史设计说明与实施计划
```

## 5. 核心数据流

```text
议程生成器页面
  -> TMAgendaData.normalizeAgendaData()
  -> tm_agenda_generator_v1 (localStorage)
  -> JSON 导入/导出与 A4 预览
  -> TMAgendaCloudSync -> Supabase Edge Function -> PostgreSQL RPC
  -> TMAgendaSchema.buildTimekeeperPayload()
  -> tm_timekeeper_agenda_v2 / tm_timekeeper_meeting_v1
  -> index.html 时间官现场副本
```

重要边界：

- 议程生成器是“原议程”；时间官使用自己的“现场副本”。
- 时间官新增、删除、排序、记录或完成环节，不回写 `tm_agenda_generator_v1`。
- 再次从生成器同步时，只更新可安全更新的 `pending` 项。
- 已经 `active` / `done`，或带有 `actualStart` / `actualEnd` 的时间官项目必须保留。
- `tm_timekeeper_records_v1` 绝不能因议程同步而清空。

## 6. 共享模块 API

| 模块 | 全局 API | 主要职责 |
| --- | --- | --- |
| `js/storage.js` | `window.TMStorage` | storage key、`readJson`、`writeJson`、`removeKey` |
| `js/time-rules.js` | `window.TMTimeRules` | `deriveRule`、`deriveRuleForMinutes`、`formatRule`、`formatRemainingRule` |
| `js/agenda-schema.js` | `window.TMAgendaSchema` | 时长解析、生成器项目转换、时间官 payload、现场副本安全合并 |
| `js/agenda-templates.js` | `window.TMAgendaTemplates` | 常规例会模板、即兴马拉松模板、接龙用无人员骨架 |
| `js/agenda-data.js` | `window.TMAgendaData` | 白名单校验、图片来源校验、4 MiB/250 项限制 |
| `js/agenda-relay-importer.js` | `window.TMAgendaRelayImporter` | 接龙文本结构化与非破坏性合并 |
| `js/agenda-cloud-sync.js` | `window.TMAgendaCloudSync` | capability draft、版本控制、冲突恢复、Realtime broadcast |
| `js/timekeeper-state.js` | `window.TMTimekeeperState` | 时间官切换与记录持久化约束 |

这些文件使用 UMD 风格，既可直接被浏览器 `<script>` 引入，也可在 Node 测试中通过 CommonJS 加载。

## 7. 议程数据结构

默认数据由 `js/agenda-templates.js` 提供，不应再在页面里维护另一套独立 `DEFAULT_DATA`。

主要顶层字段：

```text
clubName, clubNameEnglish, meetingNo, theme, wordOfDay,
date, startTime, endTime, location, manager, posterDesigner,
logoData, wechatQrData, joinQrData, voteQrData,
nextTheme, nextMeetingDate, nextMeetingTime,
residentPeople, clubIntro, officers, meetingRules,
meetingVision, guestInvitation, items
```

议程项目：

```js
{
  id: "stable-id",
  kind: "item",       // 或 "section"
  time: "19:20",
  title: "环节名",
  detail: "补充说明",
  duration: "5-7",
  durationNote: "2min/人",
  person: "负责人"
}
```

数据约束：

- `items` 最多 250 项。
- 归一化后的 JSON payload 最大 4 MiB。
- 图片字段仅接受空字符串、受支持的 `data:image/...;base64` 或仓库内 `assets/...` 路径。
- 支持的图片字段为 `logoData`、`wechatQrData`、`joinQrData`、`voteQrData`。
- 旧 localStorage 与旧 JSON 导入必须继续兼容；新增字段需要默认值和归一化测试。

## 8. 时间官同步协议

转换与合并集中在 `js/agenda-schema.js`：

- `section` 分组标题不进入时间官。
- `title -> name`。
- `person -> speaker`。
- `detail -> detail`。
- `time -> scheduledTime`。
- `duration -> plannedMinutes`，原文保存在 `durationLabel`。
- 新同步项状态为 `pending`，`actualStart` / `actualEnd` 为空。

时长示例：

- `5-7 -> 7`
- `2min/人 -> 2`
- `20 -> 20`
- `30秒 × 4 -> 2`
- `30秒 × 4 + 1分钟 -> 3`
- 无法可靠解析的复杂表达式返回调用方提供的 fallback。

项目匹配优先级：

1. `sourceId` 完全匹配。
2. `id` 完全匹配。
3. `scheduledTime + name` 匹配。
4. 仅当同名项目在两侧都唯一时，才允许按 `name` 匹配。

不要降低该匹配严格度；会议中经常出现多个同名“备稿演讲”。

## 9. localStorage key

| Key | 所有者/用途 |
| --- | --- |
| `tm_agenda_generator_v1` | 议程生成器本地状态 |
| `tm_timekeeper_agenda_v2` | 时间官现场议程副本 |
| `tm_timekeeper_meeting_v1` | 时间官会议基础信息 |
| `tm_timekeeper_records_v1` | 时间官计时记录，议程同步不得清空 |
| `tm_timekeeper_agenda_sync_meta_v1` | 上次生成器同步元信息与冲突检测 |
| `tm_timekeeper_custom_rules_v1` | 时间官自定义规则 |
| `tm_timekeeper_inspector_open_v1` | 时间官 inspector 展开状态 |
| `tm_agenda_guide_seen_v1` | 议程生成器首次引导完成状态 |
| `tm_agenda_cloud_client_id_v1` | 云同步客户端随机 ID |

如需升级 key：

- 保留旧 key 读取迁移逻辑。
- 不要就地改变旧数据含义。
- 为升级和旧数据恢复补测试。

## 10. Supabase 架构与安全边界

云同步使用无登录 capability link：URL 查询参数为 `?draft=<random-id>`。随机 draft ID 是访问能力的一部分，应像私密分享链接一样处理。

公开浏览器只调用：

```text
POST /functions/v1/agenda-drafts
```

支持 `create`、`get`、`save`。数据库写入只允许 Edge Function 使用 service role 调用受保护 RPC；不要恢复匿名浏览器直连写 RPC。

关键保护：

- Origin allowlist。
- CORS preflight 必须允许 `x-client-info`。
- 4 MiB payload 限制。
- draft/client/version 格式校验。
- IP/草稿维度限流。
- 90 天草稿过期策略。
- optimistic version (`expectedVersion`) 冲突检测。
- 超时后重新读取远端，区分“请求失败”和“其实已经保存成功”。

`js/supabase-config.js` 中的 publishable key 是前端公开配置，不是管理员密钥。

永远不要提交：

- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_SERVICE_ROLE_KEY`
- `AGENDA_RATE_LIMIT_SALT`
- GitHub personal access token
- 任何用户私密草稿链接或会议隐私数据

## 11. Supabase 自动部署

`.github/workflows/deploy-supabase.yml` 在每次 push 到 `main` 时运行：

1. `npm test`
2. 安装并链接 Supabase CLI
3. 校验 `SUPABASE_ACCESS_TOKEN`
4. 设置 `AGENDA_ALLOWED_ORIGINS=https://scorpioapn.github.io`
5. dry-run 数据库迁移
6. 推送迁移
7. 部署 `agenda-drafts` Edge Function
8. `npm run smoke:supabase`

GitHub 仓库必须配置 Secret：

- `SUPABASE_ACCESS_TOKEN`

Supabase Function 必须具备：

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `AGENDA_RATE_LIMIT_SALT`
- `AGENDA_ALLOWED_ORIGINS`

手动部署细节见 `supabase/functions/agenda-drafts/README.md`。GitHub Pages 与 Supabase 是两套部署系统；只有 Actions 工作流成功，push 到 GitHub 才同时意味着后端已更新。

## 12. 测试与验证

完整静态/行为测试：

```powershell
npm test
```

生产 Supabase smoke test：

```powershell
npm run smoke:supabase
```

主要测试覆盖：

- `agenda_generator_sidebar.test.mjs`：经典版 UI、A4、同步入口、移动端与打印约束。
- `agenda_redesign_static.test.mjs`：Modern/重设计静态约束。
- `agenda_layout_switch.test.mjs`：经典版与 Modern 版入口。
- `agenda_cloud_sync.test.mjs`：加载、保存、超时、冲突、fork、broadcast。
- `agenda_schema` 相关断言位于 generator/sidebar 与核心行为测试中。
- `agenda_data.test.mjs`：payload 类型、图片、数量和大小限制。
- `agenda_templates.test.mjs`：模板与旧数据兼容。
- `agenda_relay_importer.test.mjs`：微信接龙解析/合并。
- `agenda_user_guide.test.mjs`：首次引导与重播。
- `timekeeper_state.test.mjs`：计时器切换、状态与记录持久化。
- `timekeeper_mobile_layout.test.mjs`：时间官移动端布局。
- `agenda_edge_policy.test.mjs`：Edge Function 与迁移安全契约。
- `export_safety.test.mjs`：CSV/导出公式注入防护。
- `code_health.test.mjs`：已移除旧 key/旧路径等健康约束。

修改 UI 后还应手动检查：

- PC：1440 × 1000。
- iOS 参考视口：390 × 844。
- Android 参考视口：412 × 915。
- 无横向滚动。
- 输入、议程编辑、模板、接龙、JSON 导入/导出正常。
- A4 预览、打印、PDF 导出正常。
- 从生成器打开时间官后，speaker/detail/scheduledTime 保留。
- 时间官开始、暂停、继续、记录、多人下一位和完成环节正常。
- 浏览器控制台无 `TMTimeRules` / `TMAgendaSchema` / null element 错误。

## 13. 发布流程

推荐流程：

```powershell
git fetch --prune origin
git switch main
git pull --ff-only origin main
git switch -c agent/<short-description>

# 修改并验证
npm test

git add <明确的文件列表>
git commit -m "<简短说明>"
git push -u origin HEAD
```

通过 PR 合入 `main`；只有明确要求直接上线时才快进推送 `main`。

发布后检查：

```powershell
gh run list --workflow deploy-supabase.yml --limit 5
gh api repos/Scorpioapn/Scorpioapn.github.io/pages/builds/latest
```

然后打开生产页面并强制刷新。GitHub Pages 可能需要几十秒完成构建和 CDN 更新。

## 14. 近期关键历史

| 提交 | 日期 | 影响 |
| --- | --- | --- |
| `cc5537c` | 2026-07-06 | 经典版 A4 可读性、浏览器打印 PDF、移动端密度与持续溢出提示 |
| `ddf6c34` | 2026-07-06 | 云保存超时对账、schema 缺失 ID 修复、图片上传限制与移动端密度 |
| `4aa2f94` | 2026-07-06 | Supabase version conflict 迁移、Edge 错误映射、smoke test 强化 |
| `ecc7de4` | 2026-07-06 | 保留经典版并新增 `agenda_generator_modern.html` 切换入口 |
| `2ccaa4b` | 2026-07-05 | 议程生成器工作台重设计 |
| `06883c5` | 2026-07-05 | 接龙合并到既有议程；模板改为人员为空的流程骨架 |
| `0a4ffa1` | 2026-07-05 | 模板切换确认、撤销与图片保留 |
| `0d02c57` | 2026-07-05 | 每次 Supabase 部署设置生产 CORS allowlist |
| `f946651` | 2026-07-03 | GitHub Actions 自动部署 Supabase 与线上检查 |
| `0d733ca` | 2026-07-03 | 可选择“常规例会/即兴马拉松”模板 |
| `a9b12bd` | 2026-07-03 | 可编辑现场投票二维码 |
| `ea2275b` | 2026-07-03 | 暴露中文俱乐部名称编辑字段 |
| `8e1ed99` | 2026-07-04 | 首次使用引导及旧空议程兼容 |
| `85f6fde` | 2026-06-01 | Supabase 草稿同步与移动端 PDF |
| `dbca1d6` | 2026-05-22 | 抽出共享 agenda schema |
| `780113f` | 2026-05-22 | 时间官 Apple-style UI 与同步状态重构 |
| `f08c45e` | 2026-05-20 | 首次打通议程生成器到时间官 |

查看完整历史：

```powershell
git log --date=short --format="%h`t%ad`t%s" --all
git show <commit>
```

## 15. 当前待办与已知问题

### Modern 议程生成器视觉审查（尚未实施修复）

2026-07-10 至 2026-07-13 已对线上 `agenda_generator_modern.html` 做 PC、390px iOS 参考视口和 412px Android 参考视口审查。审查本身没有产生代码提交。

优先问题：

1. 手机底部导航跳转后，面板标题会被 56px 固定顶部栏遮住。建议对目标面板增加约 68px `scroll-margin-top`。
2. 顶部图标约 36px、输入框约 38px、行更多按钮约 34px，低于 44px 推荐触控尺寸。
3. 浮动“+ 项目”覆盖议程列表内容，并与底部导航争夺空间。
4. 议程首屏有两段常驻说明和多组操作，第一条议程出现过晚。
5. 手机标题换成两行并同时容纳四个顶部图标，视觉拥挤。
6. 分组行重复显示“分组 · 不占时间”，且 98px 高，明显高于普通 56px 行。
7. 390px 预览工具栏中的“缩放/密度”发生竖向换行；A4 缩略图缺少明确的点击放大入口。
8. 日期和时间显示格式受浏览器 locale 影响，可能出现中文 UI 配 `06/30/2026`、`07:20 PM`。

已确认的优点：

- PC 双栏布局健康。
- 三个参考视口均无横向滚动。
- 手机 A4 成稿能较早出现。
- 底部导航本身约 46px 高，触控尺寸基本合格。
- 审查时浏览器控制台未发现错误。

### 结构性技术债

- 三个 HTML 都是大型单文件应用，页面级代码重复；改动应保持小范围并由测试保护。
- 经典版和 Modern 版功能大致相同但视觉/导出路径存在差异。经典版主“保存 PDF”走浏览器打印；Modern 版仍保留 html2canvas + jsPDF 位图导出路径。
- 本地浏览器无法直接完整模拟真实 iOS Safari 和 Android Chrome 的原生控件；发布前仍需真机 smoke test。

## 16. 常见故障排查

### GitHub 已更新，但线上页面没变

1. 确认提交真的在 `origin/main`。
2. 检查 Pages 最新 build。
3. 等待 CDN 更新并强制刷新。
4. 确认打开的是经典版还是 Modern 版 URL。

### 云同步链接创建失败

1. 检查 `Deploy Supabase Backend` Actions 是否成功。
2. 运行 `npm run smoke:supabase`。
3. 检查 preflight 是否返回 204。
4. 确认 `access-control-allow-headers` 包含 `x-client-info`。
5. 检查 `AGENDA_ALLOWED_ORIGINS` 是否包含生产 Origin。
6. 检查 Edge Function secrets 和最新 migration 是否已部署。

### 用户看到版本冲突

- 不要直接清空远端或本地数据。
- 先读取最新远端版本，判断上一次超时保存是否其实成功。
- 保留“载入云端”和“本机另存为新草稿”两个显式恢复路径。
- stale `expectedVersion` 应返回 409 `version_conflict`。

### 本地议程异常或旧数据不兼容

- 先使用 JSON 导出备份当前状态。
- 检查 `tm_agenda_generator_v1`，不要直接删除时间官记录 key。
- 通过 `TMAgendaData.normalizeAgendaData()` 做防御性恢复。
- 为遇到的旧数据形状补回归测试后再修改迁移逻辑。

## 17. 修改时必须守住的约束

- 不提交任何 token、service-role key、rate-limit salt 或用户隐私数据。
- 不更改既有 localStorage key 的语义。
- 不清空时间官记录。
- 不覆盖时间官已开始/已完成项目和实际开始/结束时间。
- 不在生成器和时间官之间建立反向写回。
- 不绕过 `AgendaData` payload 校验。
- 不恢复匿名数据库直写 RPC。
- 修改共享协议后同时验证经典版、Modern 版和时间官。
- 修改 Supabase 后必须运行静态测试、线上 smoke test并检查 Actions。
- 保留纯静态 HTML/CSS/JS 架构，除非明确批准技术迁移。

## 18. 每次交接时更新本文件

- 日期：2026-08-08
- 分支/提交：`codex/agenda-modern-control-console` @ `b6ca7fb`（发布合并前）
- 目标：完成 Modern 议程生成器控制台重设计，并按标注移除 A4 行底色图例、强化页眉识别度、修复页脚遮挡。
- 修改文件：`agenda_generator_modern.html`、相关静态/行为测试、设计说明、视觉 QA 报告与对照截图。
- 验证：`npm test` 159 项通过；`git diff --check` 待发布前复核；桌面/移动端与 A4 预览已做浏览器验证。
- 部署：用户已授权直接推送 `main`；Pages 与 Supabase workflow 状态在推送后检查。
- 遗留：发布后确认 GitHub Pages 构建、Supabase workflow，并强制刷新线上 Modern 页面。

完成一轮工作后，在本节顶部追加简短记录：

```text
日期：YYYY-MM-DD
分支/提交：branch @ commit
目标：本轮解决了什么
修改文件：...
验证：npm test / smoke / 手动视口
部署：未部署 / 已推分支 / 已合入 main / Pages 与 Supabase 状态
遗留：下一位应首先处理什么
```

不要把完整聊天记录粘贴到这里。只保留能帮助下一位继续工作的事实、约束、验证结果和未完成事项；完整细节通过 commit、PR、测试和 `docs/` 追溯。

## 19. 建议的新任务开场指令

在另一台机器或新的 Codex 任务中，可以直接使用：

```text
请先读取仓库根目录 HANDOFF.md，然后运行 git fetch、git status、git log -1，
确认本地是否与 origin/main 同步。不要覆盖未提交修改。
完成环境核对后，再根据 HANDOFF.md 的“当前待办”继续工作，并在结束时更新交接记录。
```
