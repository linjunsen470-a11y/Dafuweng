/** Original coastal services. These links never change the legacy road graph. */
export const COAST_ROUTES = [
  { id:'harbor',name:'灯塔航线',from:0,to:9,divert:4 },
  { id:'market',name:'艺坊航线',from:8,to:17,divert:10 },
  { id:'garden',name:'归港航线',from:16,to:3,divert:22 }
];
export const COAST_SERVICES = [
  { id:'ferry',name:'定班渡轮',fare:650,chance:100 },
  { id:'skiff',name:'潮汐快艇',fare:250,chance:75 }
];
