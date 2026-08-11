# 素材来源与发行约束

正式构建只使用仓库内可审查的 SVG 源文件、CSS、Canvas 与 Three.js 程序化图形。

| 类别 | 来源 | 发行状态 |
|---|---|---|
| 角色头像（6 个） | `public/assets/char_*.svg`，随项目维护的矢量源文件 | 项目原创内容，可随本项目发行 |
| 其余角色 | `PawnManager.createDetailedCharacter()` 的程序化低多边形模型与 Emoji HUD | 无外部美术文件 |
| 30 张策略卡 | `public/assets/card_*.svg`，随项目维护的矢量源文件 | 项目原创内容，可随本项目发行 |
| 地图、地面、建筑、设施、道路实体 | `BoardBuilder` 中的 Three.js/Canvas 程序化图形 | 无外部美术文件 |
| 字体与 Emoji | 浏览器/操作系统提供 | 不打包字体或 Emoji 字库 |
| 第三方代码 | `three`、`canvas-confetti` 及开发依赖 | 依各自 npm 包许可证使用 |

原作角色名称、旧角色照片、旧角色/建筑图集和不具备来源证明的 JPG/WebP 已从正式资源目录删除。新增二进制素材前必须在本文件登记作者、来源、许可证和修改情况。
