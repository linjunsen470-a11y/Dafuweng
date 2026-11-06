/** Original player-facing guidance; descriptive only, never changes role rules. */
export const ROLE_GUIDES={
 taoning:{style:'喜欢备好工具，应对围栏竞争',bonus:'没有委托额外奖励。',ability:'随身工坊 · 20点券',condition:'没有清路工具包且卡栏有空位，制作一张真实清路卡；每三轮一次。',tradeoff:'制作不清路；使用时仍占本回合策略机会，只处理施工围栏，不清地雷。',opening:'有围栏需要应对时，比较保留、转向或用20点券备工具；也可以按普通30点券价格补给。'},
 ayu:{style:'喜欢追着短途目标走',bonus:'速递委托额外 +¥300；焕新无加成。',ability:'驿站接力 · 20点券',condition:'先接速递，目的地在当前位置或前方两步内；领取原委托奖励，不移动。',tradeoff:'需要合适的委托位置；不会凭空领取第二份奖励。',opening:'先接一份速递，查看目的地，再决定普通掷骰还是保留遥控卡。'},
 qinghe:{style:'喜欢沿路买地、慢慢经营',bonus:'焕新委托额外 +¥300；速递无加成。',ability:'社区花市 · 30点券',condition:'当前街区有自有且未抵押地产；按地块与等级获得 ¥300–600。',tradeoff:'开局没地时不能办花市；异地施工与改建不算焕新委托。',opening:'先接焕新，在能负担的地块买地；回到有自有地产的街区再看花市。'},
 xingluo:{style:'喜欢自己选落点，重视路线',bonus:'没有委托额外奖励。',ability:'行路制图 · ¥500',condition:'没有遥控骰子且卡栏有空位，制作一张真实遥控骰子；点券不变。',tradeoff:'开局已有一张，不能立即再制作；花现金选路，也要留够购地与租金。',opening:'先用好开局遥控骰子。缺少卡片时，再比较花 ¥500 制图与花45点券补给。'}
};
export const roleGuide=id=>ROLE_GUIDES[id]||ROLE_GUIDES.ayu;
