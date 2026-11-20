# 富翁帝国 3D

基于 Three.js、Vite 与原生 JavaScript/TypeScript 实现的 3D 本地多人 / AI 大富翁策略游戏，单一主线持续向经典《大富翁4》核心体验演进。

## 核心特性

- **单一主线入口 (`/`)**：包含 5 张拓扑地图（120 格旗舰图“山海都市岛”、宝岛环岛图、霓虹财富城、潮汐宝藏岛、福星岔路岛）、16 名原创 3D 骨骼角色、5 级住宅与 5 类大型商业建筑、载具系统（步行 / 机车 / 跑车，支持 1–3 颗 3D 骰子）。
- **核心策略系统**：32 张策略卡、13 种道具与研究所科技树、6 家公司与股市大盘、银行与经济周期结算、乐透、魔法屋、8 位巡游精灵、城市新闻与 3 款街机小游戏。
- **确定性与离线支持**：全部随机逻辑基于 `GameState.rng` 确定性重放；支持 V11 版本化多槽存档、JSON 导入导出与 PWA 离线运行。

## 开发环境

- Node.js 22+
- npm
- Chrome / Chromium / Edge（仅完整浏览器 E2E 需要）

```bash
npm ci
npm run dev
```

开发服务器默认运行在 `http://localhost:5173`。

## 常用验证命令

```bash
# 类型检查 + 全部 Vitest 单元测试 + 生产构建
npm run verify

# 确定性多地图/多模式经济与破产平衡性遥测（每组合 30 局）
npm run test:balance

# 完整浏览器 E2E 与 PWA 验证
npm run verify:full
```

## 项目结构

```text
AGENTS.md                   AI Agent / Codex Cloud 开发宪章与硬性规范
docs/CODEX-CLOUD-TASKS.md   面向 Codex Cloud 的分阶段任务队列与 Prompt
index.html                  主游戏入口
src/game/                   纯规则引擎、状态、卡牌、股市、银行、AI 与存档
src/engine/                 Three.js 3D 场景、棋盘、角色、载具、骰子与音频
src/ui/                     HUD、商店、股市、弹窗、小地图与事件演出
src/css/                    样式表
tests/                      单元测试、规则契约、存档与确定性模拟测试
tests/board/                棋盘与街景组件单元测试
tests/fixtures/             最小化 JSON 测试夹具
scripts/                    构建清单、平衡性模拟与可复用 QA 脚本
public/assets/              模型（GLB）、卡图、角色肖像与静态素材
art-source/main/            原创 Blender 源文件（.blend）
```

## 协作与开发规范

- 贡献者与云端 Agent（含 Codex Cloud）请务必先阅读根目录 [`AGENTS.md`](AGENTS.md) 与 [`docs/CODEX-CLOUD-TASKS.md`](docs/CODEX-CLOUD-TASKS.md)。
- UI 与 AI 必须通过 `GameEngine.execute(command)` 变更状态，随机玩法必须使用 `GameState.rng`。
- 禁止向 Git 提交 `dist/`、`qa/` 截图/录像或根目录临时测试脚本。
