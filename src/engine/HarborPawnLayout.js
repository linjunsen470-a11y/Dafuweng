// Presentation only: stable player order across a camera-facing row.
// A crowded tile uses smaller models; the graph and saved tile IDs never change.
export function harborPawnSlot(rank,count,right){
 const spacing=count===2?1.68:1.1;
 const side=(rank-(count-1)/2)*spacing;
 const depth=count===4?[.10,-.85,.85,-.10][rank]:count===3?[.24,-.48,.24][rank]:0;
 return {x:right.x*side-right.z*depth,z:right.z*side+right.x*depth,scale:count>=4?.85:count===3?.94:1.05};
}
