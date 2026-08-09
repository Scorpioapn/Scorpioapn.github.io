# Design QA — 时间官产品协调改版

## 对照目标

- 线上时间官基线：`timekeeper-redesign/01-production-timekeeper-1440.png`、`timekeeper-redesign/07-production-timekeeper-390.png`
- 同产品视觉参照：`timekeeper-redesign/02-production-agenda-classic-1440.png`、`timekeeper-redesign/03-production-agenda-modern-1440.png`
- 选定设计方向：`timekeeper-redesign/00-selected-concept-editorial-control-room.png`
- 浏览器实现：`http://127.0.0.2:8000/index.html`
- 实现截图：`timekeeper-redesign/04-implementation-timekeeper-1440.png`、`timekeeper-redesign/05-implementation-timekeeper-390.png`、`timekeeper-redesign/06-implementation-timekeeper-412.png`

## 视口与状态

| 证据 | CSS 视口 | 像素尺寸 | 状态 | 结果 |
| --- | ---: | ---: | --- | --- |
| Desktop | 1440 × 1000 | 1440 × 1000 | 默认议程、详情折叠 | 无横向/纵向溢出；页头 64 px；议程栏 248 px |
| Mobile | 390 × 844 | 390 × 844 | 默认议程、底部控制坞 | 页面尺寸与视口一致；控制坞 358 px；主按钮 52 px 高 |
| Mobile | 412 × 915 | 412 × 915 | 切换到下一环节后 | 页面尺寸与视口一致；控制坞 380 px；无横向溢出 |

## 同屏比较证据

- 线上与实现（Desktop）：`timekeeper-redesign/08-comparison-production-vs-implementation-1440.png`
- 设计方向与实现（Desktop）：`timekeeper-redesign/09-comparison-concept-vs-implementation-1440.png`
- 线上与实现（Mobile）：`timekeeper-redesign/10-comparison-production-vs-implementation-390.png`

桌面和移动截图均以同一视口、同一核心计时状态并排检查。标题、导航、议程行、计时数字、控制按钮与状态提示在原始截图中可读，因此无需额外裁切；浏览器 DOM 测量用于验证精确尺寸和溢出情况。

## 结论

没有遗留的 P0、P1 或 P2 设计问题。

### 必查表面

- 字体：中文沿用 Noto Sans SC/系统无衬线，计时数字使用窄体数字栈；1440、390、412 三个视口均无裁切或意外换行。
- 间距：桌面采用 64 px 产品页头、248 px 议程栏与 6/10/14 px 圆角体系；移动端使用 16 px 外侧留白并保留稳定的全宽控制坞。
- 色彩：主色限定为 Toastmasters 深蓝 `#004165`，酒红 `#772432` 用于品牌和当前议程强调，绿/黄/红仅表示计时语义；已移除线上页面的玻璃渐变观感。
- 图像：直接复用仓库内真实 Toastmasters 标志，没有占位资产、手绘 SVG、emoji 或 CSS 图形替代。
- 文案：保留原有计时与议程文案，仅增加产品名、当前页和两版议程生成器导航。
- 交互：桌面详情、更多、议程检查器、开始、暂停、继续、记录均通过；移动端议程抽屉、更多菜单和完整计时流程均通过。
- 可访问性：新增语义化页头与导航，保留文字状态，键盘焦点样式可见；真实 iOS Safari 与屏幕阅读器仍属于发布前设备级抽查项。

## 迭代记录

1. Desktop 的“议程”按钮原先调用移动端抽屉并落在屏幕外。`setMobileTab()` 现在按断点分流，桌面直接打开现有右侧检查器，并新增回归测试。
2. 390 px 下控制坞曾被内部 flex 收窄至 186 px，页面还产生额外底部滚动。修正为按 16 px 边距计算的明确宽度，并去掉重复的底部占位；修复后页面尺寸与视口相等。
3. 移动端“详情”标签曾换成两行。按钮改为固定 48 px、禁止换行，390/412 两个视口复核通过。

## 自动化与诊断

- `npm test`：164/164 通过。
- `git diff --check`：通过。
- 浏览器控制台：Desktop、390 × 844、412 × 915 均为 0 error。
- 最终结果：通过。
