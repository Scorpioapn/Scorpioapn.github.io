# Excel 议程生成器迁移进度

最后更新：2026-07-17（Asia/Shanghai）

## 项目目标

将现有 `agenda_generator.html` 的核心能力迁移为普通、无宏的 Microsoft 365 Excel 工作簿，并尽量保留 Toastmasters 配色、A4 议程排版、接龙导入、模板切换、自动排程和可打印性。

最终交付文件：

```text
outputs/agenda-excel-20260717/畅言议程生成器-无宏版.xlsx
```

当前 HTML 经典版与新版不做功能修改。Excel 迁移在独立分支中完成。

## 分支与工作区

- 开发分支：`codex/excel-agenda-workbook`
- 本机工作树：`.worktrees/excel-agenda-workbook`
- 基准分支：`main`
- 当前进度提交：`3c49c9c fix: keep Excel shell output clean`
- 设计文档：`docs/superpowers/specs/2026-07-17-excel-agenda-workbook-design.md`
- 实施计划：`docs/superpowers/plans/2026-07-17-excel-agenda-workbook.md`

## 已确认的产品决策

- 使用普通 `.xlsx`，不使用 VBA、Office Scripts 或加载项。
- 主要运行环境为新版 Microsoft 365 Excel 桌面版。
- 使用动态数组和现代公式完成解析、切换、修正和排程。
- 标准 A4 首页最多显示 30 个议程项目，最多保留 60 项；31 至 60 项进入续页。
- 议程来源包括：接龙导入、议程模板、手工编辑。
- 数据优先级：手工修正值 > 当前来源值 > 默认值。
- OneDrive/SharePoint 自动保存与共同编辑替代网页的 `localStorage` 和 Supabase。
- A4 打印设置和公式页隐藏/保护在最终 Excel 桌面版验收阶段完成。

## 已完成

### 设计与计划

- [x] 完成无宏 Excel 工作簿设计并提交：`3104629`。
- [x] 完成 10 个任务的详细实施计划并提交：`14c4383`。
- [x] 创建隔离工作树和分支 `codex/excel-agenda-workbook`。
- [x] 在隔离工作树运行基线测试：138/138 通过。

### Task 1：工作簿模型与公式契约

- [x] 新增 `scripts/excel-agenda/workbook-spec.mjs`。
- [x] 复用现有 `js/agenda-templates.js` 和 `js/agenda-schema.js`。
- [x] 定义 7 个工作表、30/60 项容量和 Toastmasters 色彩令牌。
- [x] 将常规例会与即兴马拉松模板转换成稳定行结构。
- [x] 定义接龙议程映射，包括独立的时间官、语法官、哼哈官宣言和报告。
- [x] 定义 24 个接龙标签和 Microsoft 365 解析公式。
- [x] 修复重复接龙的数组方向问题，使用 `TOCOL` 保证最后一个真实姓名优先。
- [x] 支持中英文冒号、冒号两侧空格、换行压平和占位符归一。
- [x] 新增行为与结构测试；Task 1 通过规格审查和代码质量审查。

相关提交：

```text
a7527b6 feat: define Excel agenda workbook model
75cc45e fix: correct Excel relay agenda contract
b041bb8 fix: harden Excel relay formula contract
```

### Task 2：工作簿骨架

- [x] 新增 `scripts/excel-agenda/build.mjs`。
- [x] 使用 `@oai/artifact-tool` 创建 7 个工作表并保持固定顺序。
- [x] 隐藏网格线，添加操作台标题、议程编辑标题和其余页面占位标题。
- [x] 输出中文文件名的有效 `.xlsx` 骨架。
- [x] 清理工具生成的 `.inspect.ndjson` 旁车文件，输出目录只保留工作簿。
- [x] Task 2 通过规格审查和代码质量审查。

相关提交：

```text
c483516 feat: scaffold Excel agenda workbook
3c49c9c fix: keep Excel shell output clean
```

### 当前验证状态

- [x] 新增测试后完整仓库测试：156/156 通过。
- [x] `git diff --check` 通过。
- [x] 构建脚本退出码为 0。
- [x] 当前本地中间工作簿可生成，大小约 6.8 KB。
- [x] 当前输出目录只有 `畅言议程生成器-无宏版.xlsx`。

当前 `.xlsx` 只是骨架中间产物，仍未包含模板表、基础资料、图片、公式或 A4 成品排版，因此暂不提交为最终交付文件。

## 尚未完成

- [ ] Task 3：填充模板库、俱乐部基础资料、官员团队和四张内嵌图片。
- [ ] Task 4：构建操作台、黄色输入区、来源/模板下拉框和接龙粘贴区。
- [ ] Task 5：把接龙解析公式写入计算区并连接解析预览。
- [ ] Task 6：构建 60 行议程编辑表、手工修正优先级、自动排程和容量/超时警告。
- [ ] Task 7：重建 Toastmasters A4 首页和续页视觉排版。
- [ ] Task 8：导入成品工作簿，检查公式、表格、图片并渲染全部工作表做视觉 QA。
- [ ] Task 9：在 Excel 桌面版设置 A4、页边距、打印区域、缩放、隐藏/保护页签，并补充使用说明。
- [ ] Task 10：粘贴 779 期示例接龙，完成模板、三官、排程、PDF 和完整回归验收。
- [ ] 最终代码审查、分支收尾、合并与推送。

## 下一步

下一项是 Task 3，目标是让当前空骨架首次包含真实数据和图片：

1. 将两个现有议程模板写入“模板库”表。
2. 将俱乐部介绍、愿景、会议守则和 2026-2027 官员团队写入“基础资料”。
3. 内嵌 Toastmasters Logo、取伙二维码、入会咨询二维码和投票二维码。
4. 重新生成工作簿并检查表格行数、图片数量和中文显示。

## 在另一台设备继续

先取得远端分支：

```powershell
git fetch origin
git switch --track origin/codex/excel-agenda-workbook
```

如果希望继续使用独立工作树：

```powershell
git fetch origin
git worktree add .worktrees/excel-agenda-workbook -b codex/excel-agenda-workbook origin/codex/excel-agenda-workbook
Set-Location .worktrees/excel-agenda-workbook
```

运行代码测试：

```powershell
npm test
```

工作簿构建依赖 Codex 桌面版提供的 Node 和 `@oai/artifact-tool`。在新设备上应先加载工作区依赖，然后把 `scripts/excel-agenda/node_modules` 建成指向该设备 bundled `node_modules` 的 Junction；不要运行 `npm install`，也不要提交这个 Junction。

构建命令形式：

```powershell
& '<bundled-node.exe>' scripts\excel-agenda\build.mjs
```

## 注意事项

- 不要在 `main` 直接继续 Excel 实现，继续使用 `codex/excel-agenda-workbook`。
- 不要修改或删除主工作区中的未跟踪 `agenda-audit/`。
- 不要提交 `scripts/excel-agenda/node_modules/` 或 QA 预览 PNG。
- 在 Task 8 之前，测试只验证模型和构建契约；完整的工作簿导入、公式扫描和逐页渲染属于 Task 8。
- 最终工作簿必须保持无宏，并在 Excel 中打开时不出现“启用内容”提示。
