# 蓝湾海岸原创街区模型

这组 Blender 4.3.2 模型使用项目原有奶油白、陶红、灰蓝、木色与植物绿调色板；没有下载模型、纹理、字体或原版游戏素材。项目所有者可使用、修改和再分发。

## 实际接入

`SliceScenery.js` 记录 12 处场景布置，`SliceScene` 将其加载、克隆并合并入静态场景。所有编号道路与可经营地块仍由原地图定义；装饰不增加规则节点，不更改存档。

| 模型 | 原创几何细节 | 三角形 |
| --- | --- | ---: |
| harbor_boathouse | 架高木栈台、横向木板墙、售票窗、陶瓦屋顶、救生圈、绳栏 | 1,604 |
| market_clock_gallery | 柱廊、条纹遮阳棚、二层窗、钟面双指针、八角塔帽 | 2,280 |
| garden_conservatory | 花房玻璃墙、奶油色格栅、绿屋面、盆花、叶形风向标 | 1,476 |
| harbor_fishing_rack | 晾鱼杆、吊绳、鱼身尾鳍、鱼箱 | 407 |
| market_cafe_set | 八片双色阳伞、桌凳与咖啡杯 | 392 |
| garden_flower_cart | 双侧四轮、木车架、花盆、叶簇、花朵、推手 | 772 |
| garden_easel | 三脚画架、画框和几何海岛画作 | 217 |

全组 7,148 三角形；GLB 约 524 KiB，只有几何与材质色，不依赖外部图片。花房采用不透明风格化玻璃，避免透明排序和额外叠绘。

港口保留陶红屋顶；已建设的商街地产使用灰蓝屋顶与深蓝窗饰，艺坊地产使用鼠尾草绿屋顶与橄榄色窗饰。空地、产权底座/旗帜、五阶建筑轮廓与价格不变。材质按区域缓存，原始素材不会被改色。

街区地标替换中央原来重复摆放的四栋升级示例楼；减少穿插的树木和灌木，保留喷泉、市场、灯塔及原有交通。所有新装饰的世界包围盒距道路编号中心至少 0.65 世界单位（专项检查），不以此替代摄像机遮挡的目视检查。

## 重建

```sh
blender -b -t 4 --python scripts/art/create_shanhai_neighborhoods.py
npx vitest run tests/shanhai-scenery.test.js
npm run build:shanhai
node test-shanhai-visuals.js
```

输出 `public/shanhai/models/neighborhoods.glb`、同名 manifest 与 `art-source/shanhai/neighborhoods.blend`。所有预制体保存于原点，原点为地面中心；GLB 为 Y 向上、入口 +Z。不要将整个资产包直接加入游戏场景，按根节点名克隆。

运行时将新资产的同名材质复用为旧建筑材质，然后通过既有静态批处理合并绘制；不会为每个小道具增加一套材质或逐帧动画。

## 验证边界

`qa/neighborhoods-baseline.json` 是上一提交 `15e83c6` 的同视口开局基线；`qa/neighborhoods-browser-report.json` 记录新场景真实 Chromium 软件 WebGL 数量及交互。测试中的满建筑棋盘只调用呈现层绘制合法等级的夹具，原对局、现金与存档未改动；该截图不代表玩家已经建成这些建筑。

截图保留于云环境本地作目视验证，不包含在恢复包中。软件 WebGL 的绘制数量不能证明用户硬件帧率、触屏手感或主观音频质量。未运行全量玩法回归或批量模拟。
