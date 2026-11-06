/** Shared, presentation-only moods for original model morphs and rendered portraits. */
export const EXPRESSION_LABELS={neutral:'平静',happy:'欣喜',concern:'担忧',surprise:'留意'};
export function expressionFor(kind){
 if(['setback','rent','diverted','disappointed'].includes(kind))return 'concern';
 if(['event','boarding','notice'].includes(kind))return 'surprise';
 if(['success','purchase','upgrade','commission','ability','arrival','alighting','celebrate'].includes(kind))return 'happy';
 return 'neutral';
}
export function applyExpression(model,mood='neutral'){
 const target=Object.hasOwn(EXPRESSION_LABELS,mood)?mood:'neutral';let meshes=0;
 model.traverse(o=>{if(!o.morphTargetDictionary||!o.morphTargetInfluences)return;
  for(const name of ['happy','concern','surprise']){const i=o.morphTargetDictionary[name];if(i!==undefined)o.morphTargetInfluences[i]=Number(name===target);}
  meshes++;
 });return meshes;
}
