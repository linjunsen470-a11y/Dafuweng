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

// Screen-space union of visible permanent HUD panels.
export function boardHudFraction(){
        const rects = [...document.querySelectorAll('.hud-layer > :not(.hidden)')].map(el=>el.getBoundingClientRect()).filter(r=>r.width && r.height);
        const xs = [...new Set(rects.flatMap(r=>[r.left,r.right]))].sort((a,b)=>a-b);
        let sum = 0;
        for(let i=1;i<xs.length;i++){
          const intervals = rects.filter(r=>r.left<xs[i] && r.right>xs[i-1]).sort((a,b)=>a.top-b.top);
          let end = 0;
          for(const r of intervals){
            sum += (xs[i]-xs[i-1])*Math.max(0,Math.min(innerHeight,r.bottom)-Math.max(end,r.top,0));
            end = Math.max(end,r.bottom);
          }
        }
        return sum/(innerWidth*innerHeight);
      }
