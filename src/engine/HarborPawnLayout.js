// Presentation only: stable player order across a camera-facing row.
// A crowded tile uses smaller models; the graph and saved tile IDs never change.
export function harborPawnSlot(rank,count,right){
 const spacing=count===2?1.35:1.1;
 const side=(rank-(count-1)/2)*spacing;
 return {x:right.x*side,z:right.z*side,scale:count>=4?.72:count===3?.88:1.05};
}
