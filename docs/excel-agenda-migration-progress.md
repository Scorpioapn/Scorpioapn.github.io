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
- 本机工作树：`C:\Users\Scorp\Documents\mi\Scorpioapn.github.io`
- 基准分支：`main`
- 当前进度：Task 1–10 已全部完成并通过本地验收；最终成果随本分支 HEAD 提交
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
- [x] 清理工具生成的 `.inspect.ndjson` 旁车文件；受版本控制的交付物只保留工作簿，预览图、PDF 与场景副本位于被忽略的 `qa/`。
- [x] Task 2 通过规格审查和代码质量审查。

相关提交：

```text
c483516 feat: scaffold Excel agenda workbook
3c49c9c fix: keep Excel shell output clean
```

### Task 3：模板库、基础资料与内嵌图片

- [x] 从当前 `js/agenda-templates.js` 写入常规例会和即兴马拉松两个模板，保留 section/item 行及稳定项目键。
- [x] 写入当前俱乐部名称、介绍、愿景、每周二晚频率、2026–2027 官员团队、会议守则和下期预告。
- [x] 创建 `AgendaTemplatesTable` 与 `BaseInfoTable` 两个真实 Excel 表格。
- [x] 内嵌 Toastmasters Logo、取伙二维码、入会咨询二维码和投票二维码；对扩展名与实际 JPEG 文件头不一致的素材按魔数识别 MIME。
- [x] 自动回读确认“基础资料”4 张源图片、两张 A4 页各 4 张图片；模板库与基础资料渲染无裁切。

### Task 4：操作台

- [x] 完成来源与模板下拉框、黄色会议输入区、779 期接龙粘贴区、解析预览和状态横幅。
- [x] 保持手工修正不因来源切换被清空，并在页面底部给出操作顺序。
- [x] 修正公式单元格被 `COUNTIF("<>")` 误计为活动行的问题；27 项模板现在正确显示“议程状态正常”。
- [x] “操作台”逐页渲染检查通过，无重叠、裁切或不可读文字。

### Task 5：接龙解析与计算区

- [x] 将 24 个接龙标签写入有界解析区，兼容中英文冒号、空格、换行压平、重复报名和占位符。
- [x] 使用兼容 `artifact-tool` 的标量公式选择最后一个真实姓名，避免不受支持的数组 `REDUCE/LAMBDA` 路径。
- [x] 779 期样例可解析期数、主题、今日一词、经理、日期、起止时间、地点及三官；缺席角色返回“待定”。
- [x] “计算区”渲染清晰，最终公式错误扫描为 0。

### Task 6：议程编辑、修正优先级与排程

- [x] 创建 60 行 `AgendaEditTable`，支持模板、接龙和手工编辑三种来源。
- [x] 实现修正值优先于来源值、数字时间排程、预计结束时间、缺失负责人、非法分钟和超时警告。
- [x] 新增隐藏活动行辅助列，以稳定计算 30/60 项容量并避免空公式误计数。
- [x] 默认常规模板生成 27 项，起始时间与预计结束时间连续且为数值；编辑页视觉 QA 通过。

### Task 7：A4 首页与续页

- [x] 重建 Toastmasters 蓝/酒红配色的 A4 首页，包含页眉、会议信息、左侧资料栏、分组议程、下期预告和来宾说明。
- [x] 首页读取第 1–30 项，续页读取第 31–60 项；当前 27 项样例首页完整、续页显示“本页无超出项目”。
- [x] 两页均保留 4 张内嵌图片，且无裁切、重叠、断边或弱对比问题。
- [x] 修复 27 项被错误提示为超过 30 项的问题并重新渲染确认。

### Task 8：自动验证与逐页视觉 QA

- [x] 新增 `scripts/excel-agenda/verify.mjs`，在原生 Excel 后处理前重新导入构建器输出，并验证工作表顺序、真实表格名、图片数量、779 解析结果与数值排程。
- [x] 扫描 7 张工作表的已用区域，确认 `#REF!`、`#DIV/0!`、`#VALUE!`、`#NAME?`、`#N/A`、`#SPILL!` 均为 0。
- [x] 渲染并人工检查操作台、议程编辑、A4 首页、A4 续页、模板库、基础资料、计算区共 7 张预览图。
- [x] Task 8 检查点 Excel 专项测试 25/25 通过，验证器退出码为 0。

### Task 9：原生 Excel 打印、保护与使用说明

- [x] 新增 `docs/excel-agenda-usage.md`，覆盖来源选择、接龙粘贴、模板切换、黄色修正列、A4/续页、图片替换和 PDF 导出。
- [x] 新增 `scripts/excel-agenda/finalize-excel.vbs`，使用 Excel 后期绑定完成原生公式归一化和打印元数据写入，绕过本机旧 WPS 残留类型库对 PowerShell COM 的干扰。
- [x] 将 657 个含 `LET`、`FILTER`、`XLOOKUP`、`TEXTBEFORE`、`TEXTAFTER`、`TEXTJOIN` 等现代函数的公式重新登记为原生 `Formula2`，避免 Excel 打开后出现隐式交叉 `@` 与 `#NAME?`。
- [x] 为占位符被全部移除后的 `TEXTAFTER` 边界增加 `IFERROR` 兜底；“备稿演讲3”和“备稿点评3”在真实 Excel 中稳定返回“待定”。
- [x] 两张 A4 页设置为 A4 纵向、四边 12 mm、打印区域 `$A$1:$P$48`、1 页宽 × 1 页高、水平居中、不打印网格线和行列标题。
- [x] 隐藏并保护“计算区”，保护两张 A4 成品页；工作簿保持 FileFormat 51、无外部链接，各 A4 页及基础资料均保留 4 张图片。
- [x] 新增 `scripts/excel-agenda/verify-excel-native.vbs`；最终保存后以只读 Excel 重开，确认公式错误 0、活动行 27、保护/隐藏与打印元数据均保持。
- [x] Excel 导出的 A4 首页与续页 PDF 各为 1 页、210.0 × 296.9 mm、各含 4 张图片、文字可提取；无 `#NAME?/#VALUE!/#REF!` 和多余独立“0”。
- [x] 两份 PDF 重新渲染并人工检查，Logo、二维码、页眉页尾、边框和正文均无裁切或重叠。
- [x] 补做灰度打印预览；标题、分组、边框、正文与二维码在去色后仍可辨识。
- [x] A4 两页保持单元格保护，但图片对象可编辑；用户可直接使用“更改图片”，使用说明明确两页图片为独立副本。

### Task 10：最终回归与交付物检查

- [x] 完整仓库测试 165/165 通过，0 失败；Excel 专项测试 27/27 通过。
- [x] 按 `build.mjs → verify.mjs → finalize-excel.vbs → verify-excel-native.vbs → verify-excel-scenarios.vbs` 顺序重跑完整生成与验证链路。
- [x] 原生 Excel 只读重开确认 FileFormat 51、外部链接 0、公式错误 0、默认活动行 27、计算区隐藏并保护、两张 A4 页保护且各含 4 张图片。
- [x] 原生 Excel 场景回归 8/8 通过：常规模板 27 项、779 接龙 21 项、单行压平接龙、重复报名保留最后真实姓名、即兴马拉松 19 项、动态新增模板 1 项、手工修正保留/恢复/排程、手工 31 项续页。
- [x] 779 接龙解析得到期数 779、主题“志愿者”、今日一词“服务”、经理“莫婷”；May、莫婷、Jessica 的三官宣言与报告负责人正确，缺席角色为“待定”，19:30 连续排程至 21:05。
- [x] 新增模板可在 `AgendaTemplatesTable` 末尾追加并自动进入模板下拉；公式读取上限为第 1000 行。
- [x] 完整接龙原文保留在黄色粘贴区，灰色提示明确要求核对预览未显示的内容；固定 60 行编辑边界与安全操作方式已写入使用说明。
- [x] 31 项手工议程触发容量警告，首页保留前 30 项，第 31 项进入续页，场景结束时公式错误为 0。
- [x] OOXML 检查通过：无 `xl/vbaProject.bin`、无 `xl/externalLinks/*`、两个打印区、A4/纵向/12 mm/水平居中/单页适配、计算区隐藏保护、`_xludf.` 为 0；现代公式保留原生 `_xlfn` 前缀。
- [x] 两份最终 PDF 各 1 页、210.0 × 296.9 mm、各含 4 张图片、文字可提取；无公式错误标记或多余独立“0”，彩色与灰度视觉检查均通过。
- [x] 独立代码审查未发现阻塞或高严重度缺陷；指出的图片替换、模板扩展、未识别内容提示和固定行结构四项均已实现或在说明中明确。
- [x] `git diff --check` 通过；临时渲染目录已清理，最终工作簿无 `.inspect.ndjson` 旁车文件。

### 当前验证状态

- [x] 初始隔离工作树基线测试：138/138 通过；Task 1–2 检查点完整测试：156/156 通过。
- [x] 最终完整仓库测试：165/165 通过；Excel 专项测试：27/27 通过。
- [x] 构建态验证脚本退出码为 0，7 张工作表渲染完成，公式错误为 0。
- [x] 原生 Excel 定稿、只读重开与 8 组场景回归均退出码为 0，公式错误为 0。
- [x] OOXML、彩色/灰度 PDF、`git diff --check` 与独立代码审查全部通过。
- [x] 最终工作簿大小 741,712 字节（约 724 KiB / 0.74 MB），SHA-256：`733373C9B6F90ABD2C68DFCDE78C936E120C325C95F326F0220F9DF74F51A6DE`。

当前 `.xlsx` 是最终本地交付文件，已包含完整数据、公式、A4 版式、打印元数据、保护设置和使用说明所述能力。

## 尚未完成

- 无。产品实现与本地验收已全部完成。
- 未执行远端推送、合并或部署；这些属于需要用户明确授权的发布动作，不计入本地交付缺口。

## 本地交付状态

Task 1–10 均已完成。最终工作簿位于：

```text
outputs/agenda-excel-20260717/畅言议程生成器-无宏版.xlsx
```

## 在另一台设备重建与验证

完整成果尚未推送到远端。在推送前，另一台设备不能仅通过 `origin/codex/excel-agenda-workbook` 取得本次最终改动。

取得包含最终提交的分支后，先加载 Codex 桌面版工作区依赖，并把 `scripts/excel-agenda/node_modules` 建成指向该设备 bundled `node_modules` 的 Junction；不要运行 `npm install`，也不要提交这个 Junction。

唯一支持的生成与验证顺序是：

```powershell
& '<bundled-node.exe>' scripts\excel-agenda\build.mjs
& '<bundled-node.exe>' scripts\excel-agenda\verify.mjs
cscript.exe //nologo scripts\excel-agenda\finalize-excel.vbs
cscript.exe //nologo scripts\excel-agenda\verify-excel-native.vbs
cscript.exe //nologo scripts\excel-agenda\verify-excel-scenarios.vbs
npm test
```

`verify.mjs` 只验证构建器导出、原生 Excel 后处理前的文件。Excel 原生保存会写入合法 `_xlfn` 前缀，`artifact-tool` 再导入可能误报 `#NAME?`；最终成品以两个 VBS 验证器和 OOXML 检查为权威结果。

## 注意事项

- 不要在 `main` 直接继续 Excel 实现，继续使用 `codex/excel-agenda-workbook`。
- 不要修改或删除主工作区中的未跟踪 `agenda-audit/`。
- 不要提交 `scripts/excel-agenda/node_modules/` 或 QA 预览 PNG。
- “议程编辑”是固定 60 行结构；不要插入、删除或排序整行，只在黄色修正列填写、清空或复制内容。
- 最终工作簿必须保持无宏，并在 Excel 中打开时不出现“启用内容”提示。
