# 四人对局与原创修缮师陶宁（2026-11-06）

本轮沿用现有多人引擎接通一名玩家对三名 AI，没有新增一套轮转或竞拍系统。启程页保留双人默认值，支持双人、三人、四人；玩家和首位 AI 可选角色，剩余 AI 按角色目录顺序补齐不同角色。没有队伍模式。

## 可玩的变化

- 第四席加入产权、租金、道具合法目标、AI 回顾、破产后的存续轮转、竞拍和最终排名。四个棋子同站时分处四角，资产卡沿用紧凑排布并可在手机纵向查看。
- 新增原创修缮师陶宁：蓝色工装、安全帽、护耳、工具箱和工具围兜，使用琥珀色产权标记；选角页提供能力比较与建议，两图均可使用。
- 「随身工坊」花 20 点券制作一张真实清路工具包，普通兑换价为 30 点券，每三轮一次。已有同卡、背包满、点券不足或时机不合法时不能制作。制作不移动也不消耗策略机会；使用卡仍占本回合策略机会，只清施工围栏、不清地雷。没有额外委托奖励。
- AI 遵守相同成本和限制，有障碍且制作后保留至少 45 点券时考虑制作，再沿用现有路线判断决定是否使用，仍可保留对自己有利的围栏。
- 修正现有合法福神免租的反馈：明确显示本次免租，不再显示“已支付 ¥0”。不改变租金规则。

## 存档与竞拍

旧双人、三人默认阵容顺序和字段兼容，两图存档键不变；仍是每图一个存档槽，新人数开局会覆盖该图旧局，不提供每个人数单独存档槽。第四位 AI 的中途恢复只行动一次，重玩保留四人阵容。

四人首位破产后，三名存续者按原竞拍机制竞价，出价现金限制、款项流向和结果回执不变。只剩一位存续者仍直接获胜，不进行赛后竞拍。债权人自己竞得的净支出及长期平衡限制见上一轮竞拍记录，本轮没有修改清算经济规则。

## 原创素材与重建

陶宁基于本项目原创关节玩偶基体制作，新增安全帽、护耳、工装和工具几何；不使用外部图片或模型。保留 Blender 源文件、未合并 GLB 与优化验证报告。模型 751,080 字节、17,156 三角面、6 网格，每普通渲染遍 30 次绘制；六组原有基础动作和喜悦、担忧、惊讶三种表情，四张同模型渲染头像。没有独立配音或专属故事，动作复用现有原创系统。

```sh
blender -b --python scripts/art/create_shanhai_builder.py
python3 -c "import sys; sys.path.insert(0, 'scripts/art'); from optimize_shanhai_characters import optimize; optimize('builder', expressions=True)"
blender -b --python scripts/art/render_shanhai_portraits.py -- --builder-only
blender -b --python scripts/art/render_shanhai_expressions.py -- --builder-only
```

模型数据见 `public/shanhai/models/builder-manifest.json` 和 `art-source/shanhai/builder-validation.json`。其余三位运行模型与头像未重写。

## 本轮验证

39 项直接相关测试通过，涵盖四人阵容、两图轮转、末位 AI 恢复、第四席收租/目标、三方竞拍、四人排名、旧二/三/四人恢复、新角色制作/使用限制及模型结构。命令：

```sh
npx vitest run tests/shanhai-four-players.test.js tests/shanhai-three-players.test.js tests/shanhai-auctions.test.js tests/shanhai-cartographer.test.js tests/shanhai-role-notes.test.js
npm run build:shanhai
```

独立构建通过，哈希见 `qa/four-players-build-hashes.json`，仍有既有大包警告。真实 Puppeteer 页面验证见 `test-shanhai-four-players.js` 与 `qa/four-players-browser-report.json`，成功且无页面错误：

- 海岸桌面、山城 390px 新四人局，四位不同模型、三 AI 行动、第四席持产、租金结算、四个策略目标和刷新恢复；山城玩家陶宁真实扣 20 点券得卡。海岸种子有合法福神免租，页面断言实际结果和产权现金差；正金额第四席收租由单测覆盖。
- 保存于第四席 AI 回合后恢复，与仅执行一次该 AI 的结果一致。
- 使用明确准备的债务局面验证首位 AI 破产，三名存续者参拍，玩家与低储备 AI 放弃、第四席竞得，刷新无重复付款，后续三人继续。
- 两图正常模拟前两轮，再在真实页面操作三轮短季的最后一轮，得到四人排名、引擎一致胜者、刷新结算、原阵容重玩和切回三人。
- 目视检查桌面资产卡、手机角色选择与资产卡；截图仅供内部检查，不入 Git 或恢复包。

未跑全量测试，未在 GUI 从头完成完整 16 轮。未验证长期四人经济平衡或真实手机 GPU 性能；四个模型的绘制负担高于三个，不能把软件 WebGL/窄视窗通过当作真机性能承诺。原有主观音频试听缺口仍在。仍为开发版，未达到完整经典作品的体量和体验。
