/** One original, optional story. Cosmetic ending; ordinary commissions retain their rewards. */
export const LANTERN_STEPS=[
 {title:'一封花灯便笺',objective:'在 0号蓝湾出发站，向阿澜接下便笺。',targetId:0,actions:[{id:'accept',label:'接下阿澜的便笺'}]},
 {title:'先把约定办好',objective:'接信后完成任意一单海湾委托：速递或焕新均可，奖励照原规则领取。',targetId:null,actions:[]},
 {title:'灯塔街的纸灯罩',objective:'实际停靠 8号海风补给，向小栀领取灯罩。',targetId:8,actions:[{id:'collect',label:'向小栀领取灯罩'}]},
 {title:'花棚里的点灯之约',objective:'实际停靠 16号远方来信，处理完来信后，与木木一起点灯。',targetId:16,actions:[{id:'harbor',label:'让灯先照归船'},{id:'garden',label:'把灯留在花棚'}]},
 {title:'灯火已经亮起',objective:'海风花灯的约定已完成。',targetId:null,actions:[]}
];
export const LANTERN_ENDINGS={
 harbor:{title:'归航之光',text:'阿澜把灯挂到栈桥边，小栀写上归港的路，木木送来一圈绿叶。晚归的船望见灯火，三位街坊也记住了你的名字。'},
 garden:{title:'花棚夜话',text:'木木把灯留在花棚，小栀端来温茶，阿澜收船后也来坐坐。大家聊起你沿路办成的委托，约好花开时再聚。'}
};

export const MOUNTAIN_PEOPLE=[
 {id:'atang',name:'阿棠',role:'茶棚主人',color:'#879350',x:-4,z:-2,reply:'“茶叶要慢慢焙，约好的事也要一件件办。去看看陶九的新窑，回来我替你留一包新茶。”'},
 {id:'taojiu',name:'陶九',role:'柴窑陶工',color:'#b87755',x:5,z:-5,reply:'“杯子不一定件件完美，肯一起开窑就是朋友。挑好茶，再决定把茶会摆在哪里。”'}
];
export const MOUNTAIN_STEPS=[
 {title:'茶棚的邀请',objective:'在0号枫谷驿站接下阿棠的茶会便笺。',targetId:0,actions:[{id:'accept',label:'接下阿棠的茶会便笺'}]},
 {title:'和陶九一起开窑',objective:'实际停靠10号窑场来信，完成任一柴窑试烧方案；成功或失利都算参与。',targetId:10,actions:[]},
 {title:'阿棠留的新茶',objective:'实际停靠16号茶坡来信，先处理来信，再领取茶棚留的新茶。',targetId:16,actions:[{id:'collect',label:'向阿棠领取新茶'}]},
 {title:'把茶会带上山路',objective:'实际停靠22号山林来信，处理完本站来信后选择茶会结局；免费帮工也算，不必冒险投入。',targetId:22,actions:[{id:'teahouse',label:'在茶棚邀请街坊'},{id:'trail',label:'把热茶送到货栈'}]},
 {title:'这一窑，茶香正好',objective:'一窑新茶的约定已完成。',targetId:null,actions:[]}
];
export const MOUNTAIN_ENDINGS={
 teahouse:{title:'茶棚的长桌',text:'阿棠铺好长桌，陶九带来深浅不一的茶杯。街坊聊起开窑和山路上的选择，一壶新茶很快见底。'},
 trail:{title:'古道暖茶人',text:'阿棠包好茶叶，陶九把厚实茶杯送到货栈。赶路的人和修路的人坐到一起，雨后的古道多了一处歇脚的地方。'}
};
