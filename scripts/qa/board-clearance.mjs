// Largest axis-aligned, unobstructed rectangle containing the board center.
export function boardClearance() {
  const width=innerWidth, height=innerHeight;
  const rects=[...document.querySelectorAll('.hud-layer > :not(.hidden)')].map(el=>el.getBoundingClientRect()).filter(r=>r.width && r.height);
  const lefts=[0,...rects.map(r=>r.right).filter(x=>x<width/2)];
  const rights=[width,...rects.map(r=>r.left).filter(x=>x>width/2)];
  let best=0;
  for(const left of lefts) for(const right of rights) {
    let top=0,bottom=height;
    for(const r of rects) {
      if(r.right<=left || r.left>=right) continue;
      if(r.bottom<=height/2) top=Math.max(top,r.bottom);
      else if(r.top>=height/2) bottom=Math.min(bottom,r.top);
      else {bottom=0;break;}
    }
    best=Math.max(best,(right-left)*(bottom-top));
  }
  return best/(width*height);
}
