# 主游戏街景与空间交互开发记录

2026-11-19，Dafuweng 云容器。沿用当前宿主 Codex 会话。宿主未向工作区暴露可独立审计的当前模型标识。用户已取消原生 Goal 前置条件。

## 基线与保留的功能

独立分支 `codex/cartoon-board-m1-20261119` 从 `849d7e7` 建立。该提交包含山海都市岛街区、原创角色和查地；`main` 当时为 `a9202f9`。从 `37d9fcd` 适配弹窗焦点、关闭购地窗时执行放弃回调、键盘掷骰防重入。保留云开发版的移动菜单、地图工具和游戏规则。首个可恢复提交为 `7a6ea07`。

## 可玩增量

- 主入口暖色紧凑 HUD、桌面边栏、手机当前玩家摘要、展开式工具菜单。回合提示、角色反应移至边缘，打开商店或股市后遮蔽底层演出。
- 港区街景使用半球光、暖主光、渐变天穹、细碎草纹和动态海面。调整港区开局镜头，开始手动拖动时交回镜头控制。
- 点击或悬停模型可读所属地块与租金；规则引擎提供道具和卡片合法目标。地块、玩家有可点的 3D 环；可取消或用键盘选取。同格玩家保留独立目标 ID，股票继续由证券列表选择。
- 旗舰地图已有模型的 14 个设施移除白底文字牌。两座交易所改用原创双面金边珐琅行情箭头，保留查地文字详情。

## 验证与证据

- 初始基线单独执行全量验证为 646 通过、17 失败。原有测试对卡数分别预期 30 和 31，基线已含 32 张；另有旧事件格式、业主标签、章节场景替身与按钮查询范围。对照现行行为更新这些测试，未删测试或更改独立章节运行时代码。
- 里程碑验证执行 `npm run verify`，127 个测试文件、663 项测试通过，类型检查和双入口构建通过。有既有大分块警告。
- Chromium 通过 SwiftShader 运行 WebGL。桌面 1440×900，手机模拟触屏 390×844。以 seed 64 和相同起点比较。背包选择路障，直接点 1 号格；乌龟卡直接点对手，验证对手状态；打开股市与商店；重载 V11，比较玩家、道路实体、产权、随机状态后实际掷骰移动。双视口结果见 `qa/review/board-checks.json`。
- 同场景前后对照为 `qa/review/{before,after}-{desktop,mobile}.png`，直选为 `target-{desktop,mobile}.png`。股市、商店截图分别以 `stock-market-`、`card-shop-` 开头。收租和住院局面以 `rent-`、`mine-` 开头，初始条件和实际账款见 `board-events.json`。
- Blender 4.3.2 在本容器生成原始工程和网格。三角度检查图 `qa/review/exchange-crown-sheet.jpg`。原始工程 `art-source/main/exchange-crown.blend`，运行时量化 GLB 在 `public/assets/models/exchange-crown.glb`。

## 复现

在本工作树运行。开发时仅执行与改动相关的一条检查；浏览器脚本独立于 verify。

```sh
cd /workspace/Dafuweng-m1
npm ci
npm run dev
# 里程碑收尾
npm run verify
node scripts/qa/board-view.mjs after
# 收租或住院表现改动时
node scripts/qa/board-events.mjs
```

重建屋标使用 `blender -b -t 2 --python scripts/art/create_exchange_crown.py`。用 glTF Transform 4.2.1 的 `quantize` 将新导出的 GLB 量化至临时文件，再替换同名运行时资产。三张离线渲染在 `/tmp/dafuweng-exchange-{0,1,2}.png`。

## 美术自检与余项

首轮实机看见股市被刚施放的卡牌提示遮盖，已修改弹窗层级。第二轮量测发现 HUD 总面积满足要求时，连续中央净空仍不足，因而再次压缩桌面行动栏和边栏。沿岸空地、建筑立面和部分功能地砖仍显空旷，树木和角色需要独立造型。股市和商店内部保留原版深色布局。完整八人骨骼资产、八位原创新神明、五级已建住宅、全图街区美术与声音演出仍待后续里程碑完成。当前版本不能展示“骑乘＋神明＋五级住宅”组合。


## 第二里程碑首个可玩切片

阿飞（角色 7）已有 Blender Armature、蒙皮及七个独立 GLTF 动画：Idle、Walk、Ride、Cheer、Shock_Hit、Cast、Sad。由主游戏 AnimationMixer 根据移动、持有载具和游戏事件播放。其余角色仍用原有程序模型。原创小绵羊和双门敞篷车由玩家的 MOTOR/CAR 状态驱动，角色坐入车身、车轮随位移转动。新模型均已量化，以标准 GLB 加载。离线多角度见 `qa/review/board-rides-sheet.jpg` 和 `qa/review/afei-poses.jpg`。

同一条搭乘操作已通过真实 WebGL：390×844 触摸查 3 号地，驾驶小绵羊掷两骰；1440×900 悬停查同一地块，驾驶跑车掷三骰。两端均核实 Ride 正在播放、模型有相应车轮、玩家真正走格，零页面异常。棋盘中心最大无常驻 HUD 矩形在桌面为 **66.97%**，手机为 **75.83%**。结果和图见 `qa/review/ride-checks.json`、`ride-desktop.png` 和 `ride-mobile.png`。较早的 HUD 面积与收租截图来自布局收窄前的轮次。旧手机股市截图保留了施卡提示遮挡问题，修复后的桌面股市图和源代码反映最终层级。

续作可从该分支运行 `npm run dev`。只复查这条路径运行 `node scripts/qa/board-ride.mjs`。下一批应补齐至少七名风格不同的骨骼角色、载具尘迹与神明模型；后续五级住宅与演出待实现。

## 第二里程碑 · 八人角色与八位巡游神明

主游戏角色 0–7 均接入独立 GLB。八份量化模型各含一个蒙皮、九个骨骼节点和全部七段标准动作。眼、眉、嘴随动作变化。持有机车或跑车的角色切换为 Ride，车轮和尘迹跟随位移。八位神明共用一份按需加载的模型包，地图巡游和肩后附身都使用对应造型。原始模型、角色姿态和神明双角度图分别见 `art-source/main/`、`qa/review/core-cast-poses.jpg` 和 `qa/review/spirits-sheet.jpg`。

两端各跑一局，共覆盖八名角色。桌面悬停查看地块，再驾驶跑车掷三骰；手机触摸查看地块，再骑机车掷两骰。两局均已观察到走格、Ride 动作、地图神明与肩后神明，并且没有页面异常。按常驻 HUD 元素可见矩形的并集直接量测，1440×900 占 **15.67%**，390×844 占 **20.91%**；中心连续净空另计为 **66.97%** 和 **75.83%**。实机图与各项读数见 `qa/review/cast-spirits-desktop.png`、`qa/review/cast-spirits-mobile.png` 和 `qa/review/cast-spirits-checks.json`。

角色可用 `blender -b --python scripts/art/create_baseball_pawn.py -- xiaoman` 重建，神明用 `blender -b --python scripts/art/create_board_spirits.py` 重建；运行时 GLB 使用 glTF Transform quantize。运行 `node scripts/qa/board-ride.mjs` 可复查实机操作。俯视镜头中角色主要靠帽形、配色和载具辨认，脸部细节在手机默认缩放下较小。后八名可选角色仍使用原模型，五级住宅与后续城市美术尚待实现。

本轮收尾运行一次 `npm run verify`，类型检查通过，127 个测试文件的 663 项全部通过，生产构建成功。

## 第三里程碑 · 空地与五级住宅

从 `55b081b` 接入主游戏。空地保留业主色围栏与旗帜，住宅依次成为平房、双层洋房、带花园与廊柱的别墅、带错层阳台的公寓、带冠塔的摩天楼。三级和四级新增原创 Blender 模型，其他级别复用项目原创资产，各街区有不同住宅配色。升级时出现脚手架与金光，模型弹起；降级时散落碎块并轻震镜头。主棋盘移除了旧的住宅平面立牌和公共设施悬浮文字牌。商业地块使用五种对应模型；酒店门与研究所天线可转动，医院有救护车停靠位。新增资产集中在 `scripts/art/create_city_landmarks.py`、`art-source/main/city-landmarks.blend`、`public/assets/models/city-landmarks.glb`。设施沿用各自等级上限。

旧 V11 住宅按原等级读入。四级宅可继续付费升至五级，新五级存档可恢复，不重新认定业主或补扣旧账。没有显式第五级报价的地图，以四级基础租金的 1.5 倍作为第五级基础租金；现有垄断、物价和折扣规则继续生效。独立山海章节保留原四级住宅上限。

实机检查从 V11 的蓝湾码头 2 号四级宅开始，在正常落地对话框点击或触摸升级。桌面和手机均得到五级冠塔，基础过路费从 5,570 升至 8,355，桌面下一位玩家通过手牌点中地图上的同一块地，拆回四级。初次看片发现手机镜头会让塔楼挡住棋子而变透明；已针对路旁高楼调整交棒取景，镜头从街侧同时纳入塔楼和棋子。两端实机结果见 `qa/review/m3-upgrade-checks.json`、`qa/review/m3-upgrade-desktop.png` 和 `qa/review/m3-upgrade-mobile.png`。离线双角度拼图见 `qa/review/m3-residences.jpg` 和 `qa/review/m3-landmarks.jpg`。

复查主流程运行 `node scripts/qa/board-housing.mjs`，代码验收运行 `npm run verify`。复现美术运行 `blender -b --python scripts/art/create_city_landmarks.py`，量化新 GLB 后运行 `blender -b --python scripts/art/render_residence_review.py`。商业与公共设施已看过建模拼图，尚未逐栋进行游戏内访问录像；默认海港画面中岸线、人行道与防波堤之间仍显空旷。

收尾通过类型检查、127 个测试文件共 663 项及 Vite 生产构建；实机两条路径均未捕获页面异常。

## 第四里程碑首批 · 海港步道与路上道具

在旗舰图海港沿岸加入连续防护栏、石缘、长椅、花箱、夜间亮起的步道灯和路口斑马线。219 件静态构件按材质合成 8 批实例，五只海鸥沿水边盘旋。场景使用现有地图坐标和道路连接。红白拒马、闪光软壳地雷、卡通倒计时钟及发条机器人均有原创 Blender 源文件与量化 GLB。地图道具跟随存档恢复和清除；机器人施放时向目标走格清障。修正了角色编号 0 携带的时钟会被当作地面目标的问题。

桌面悬停、手机触摸均读到 3 号地报价，同时确认三类道路实体的模型已加载。桌面再通过手牌选择发条机器人并点中路障，确认道路实体移除。实机取景见 `qa/review/m4-promenade-desktop.png`、`qa/review/m4-promenade-mobile.png`；结构读数与操作结果见 `qa/review/m4-promenade-checks.json`；四件道具双角度图见 `qa/review/m4-road-tokens.jpg`。复查运行 `node scripts/qa/board-promenade.mjs`。此检查点通过类型检查、生产构建及道路实体和选路相关的 4 项测试。

海港步道已有游戏内验收。旧城、商务区与山城仍需相同密度的街景打磨，昼夜与雨雪的全图可读性也待实机验收。桌面默认视距下地雷与倒计时钟的细部较小，可点地块查看说明。
