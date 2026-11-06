// Existing old-city homes connect the east street to the north business district.
export const isOldTownHome=(map,tile,type)=>Boolean(map?.id==='grand-bay'&&(['OLD_1','OLD_2','OLD_3'].includes(tile?.group)||[101,103,106].includes(tile?.id))&&!tile.large&&(!type||type==='RESIDENTIAL'));
export const isOldTownView=(mapId,position)=>mapId==='grand-bay'&&position?.x>=51&&position.x<=61&&position.z<=10&&position.z>=-29;
export function oldTownOffset(mapId,position,offset){return isOldTownView(mapId,position)?{x:offset.z,y:offset.y,z:offset.x}:offset;}
