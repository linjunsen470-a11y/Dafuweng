// Presentation only: no tile IDs, property levels or save fields change.
export const REGIONAL_SCENERY = [
  {model:'harbor_boathouse',region:'HARBOR',x:-4.4,z:5.2,scale:1.18,rotation:.2,landmark:true,label:'盐风船屋'},
  {model:'harbor_fishing_rack',region:'HARBOR',x:-7,z:5.2,scale:.85,rotation:.4},
  {model:'harbor_fishing_rack',region:'HARBOR',x:-1.6,z:6.5,scale:.8,rotation:-.15},
  {model:'market_cafe_set',region:'HARBOR',x:-5,z:2.8,scale:.7,rotation:.1},
  {model:'market_clock_gallery',region:'MARKET',x:6.4,z:-3.5,scale:1.1,rotation:.35,landmark:true,label:'灯塔钟楼街'},
  {model:'market_cafe_set',region:'MARKET',x:7.8,z:.2,scale:.75,rotation:-.2},
  {model:'market_cafe_set',region:'MARKET',x:5.7,z:1.2,scale:.65,rotation:0},
  {model:'garden_flower_cart',region:'MARKET',x:8.1,z:-5.5,scale:.75,rotation:0},
  {model:'garden_conservatory',region:'GARDEN',x:-5.6,z:-4.8,scale:1.05,rotation:.35,landmark:true,label:'林间花房'},
  {model:'garden_flower_cart',region:'GARDEN',x:-7.9,z:-4.5,scale:.8,rotation:-.4},
  {model:'garden_easel',region:'GARDEN',x:-3.1,z:-3.4,scale:.85,rotation:-.6},
  {model:'garden_easel',region:'GARDEN',x:-4.2,z:-7,scale:.7,rotation:.3}
];

export const REGION_ARCHITECTURE = {
  MARKET:{coral:'#527e94',tile_light:'#89afbb',teal:'#365e7a'},
  GARDEN:{coral:'#719166',tile_light:'#a4bb80',teal:'#647c55'}
};

export function residenceModel(tile,level,buildingType) {
  if(tile.type==='BIG_PROPERTY')return ['MALL','PARK'].includes(buildingType)?`commerce_${buildingType.toLowerCase()}_${Math.min(level,buildingType==='PARK'?1:4)}`:'market';
  if(!level)return 'property_level0';
  const region=['harbor','market','garden'][Math.floor(tile.id/8)];
  return `res_${region}_${level}`;
}
