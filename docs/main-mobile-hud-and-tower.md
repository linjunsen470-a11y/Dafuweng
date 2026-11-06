# 主游戏手机HUD与第五级美术样稿（2026-11-06）

入口仍是主游戏 `/` 的山海都市岛。120格、123条连接、三处分叉、费用和租金、AI及存档结构均未修改；`/shanhai.html` 不属于本轮改动入口。

## 可玩交付：手机主界面

- 360/390px下四位玩家以顶部2×2卡片展示姓名、身份和现金；当前行动者保留高亮。完整资产信息仍从菜单的资产排名进入。
- 底部操作区完整容纳骰数、掷骰、卡片、股市和道具商店。固定保留主要操作，地图/菜单工具展开后带文字标签，点击工具自动收起，Escape关闭并返回焦点。
- 修复旧全局Enter/Space快捷键抢走按钮键盘操作而意外掷骰的问题；HUD点击也不再穿透到棋盘骰子拾取。
- 实际购地发现旧弹窗的购买按钮位于视口下方；改为内容区域滚动，标题和购买/放弃按钮始终可见。
- 切回桌面尺寸会收起移动工具菜单，避免遗留状态阻挡桌面快捷键。桌面原有工具栏布局保持。

## 第五级的边界：模型完成，未开放建造

当前 `src/game/GameRules.js` 明确 `MAX_PROPERTY_LEVEL = 4`，现有费用/租金表与章节也按四个可建等级实现。要求“第五级”和“保持经济规则”需要区分：本轮完成第五级**原创剪影资源和明确标注的街景预览**，没有将空地重命名成建筑一级，没有添加收费升级，也未把预览模型写入游戏状态。

新模型为三段退台塔楼、玻璃立面、青铜色冠顶与金色风标，尺寸2.6×2.35×6.43，1132三角形，约84KB GLB。造型明显高于现有第四级坡顶住宅。原创建模脚本、Blender源文件、GLB及授权清单均保留，无外部图片、字体或模型。

- `scripts/art/create_harbor_tower.py`
- `art-source/shanhai/harbor-tower.blend`
- `public/shanhai/models/harbor-tower.glb` 与 `harbor-tower.manifest.json`

预览由 `test-harbor-tower-preview.js` 在本地主游戏场景中临时加载，画面注明“尚未开放建造”。常规游戏不会显示第5级建造按钮。若要成为真实可建第五级，需要先确认允许增加相应升级费用、租金和等级上限；当时未擅自改变经济规则；后续用户已明确第五级暂不开放，继续保持四级。

## 直接相关验证

- `node test-main-mobile-hud.js`：真实Chromium的360×844、390×844视口检查每个主要按钮的屏内位置及中心点点击命中；中央未被上下HUD占用的空间为518px。验证工具菜单、Escape/Enter、存档槽、暂停恢复、掷骰及购买1号地产；1440×900桌面保留原工具栏。报告 `qa/main-mobile-hud-report.json`。
- `node test-mobile-hud-resize.js`：真实浏览器验证展开移动菜单后扩到桌面，菜单状态正确复位。初次Happy DOM模拟没有发出预期媒体变更事件，不作为通过依据；最终使用真实Chromium。
- `node test-harbor-tower-preview.js`：真实主游戏视角核对模型尺寸、第五级剪影；预览前后产权数据逐项不变，真实状态最高仍为4级。报告 `qa/harbor-tower-preview-report.json`。
- `npm run build`：主游戏和独立章节构建通过，保留既有大分块警告。未跑全量测试。

截图：`qa/main-mobile-hud-390.png`、`qa/main-mobile-hud-360.png`、`qa/main-mobile-hud-menu.png`、`qa/main-mobile-hud-purchase.png`、`qa/main-mobile-hud-desktop.png`、`qa/harbor-tower-preview.png`。

这些是浏览器手机视口模拟，**不是实体真机或稳定帧率验收**。没有重新验收所有股市、卡片及其他弹窗的手机流程，没有进行长期平衡或主观听感验收。原角色、商业设施风格统一与真实第五等级规则仍待处理。
