// Convex clipping keeps the visible cut geometry and collision geometry identical.
const cross=(a,b,p)=>(b.x-a.x)*(p.y-a.y)-(b.y-a.y)*(p.x-a.x);
export function outline(o){
 if(['circle','oval','marble'].includes(o.type))return Array.from({length:64},(_,i)=>({x:Math.cos(i*Math.PI/32)*o.w/2,y:Math.sin(i*Math.PI/32)*(o.type==='oval'?o.h:o.w)/2}));
 if(o.type==='polygon'){const v=o.vertices.map(p=>({...p}));return area(v)<0?v.reverse():v;}
 return [{x:-o.w/2,y:-o.h/2},{x:o.w/2,y:-o.h/2},{x:o.w/2,y:o.h/2},{x:-o.w/2,y:o.h/2}];
}
export function area(v){return v.reduce((s,p,i)=>{const q=v[(i+1)%v.length];return s+p.x*q.y-q.x*p.y;},0)/2;}
function clip(poly,a,b,inside){const result=[];for(let i=0;i<poly.length;i++){const p=poly[i],q=poly[(i+1)%poly.length],dp=cross(a,b,p),dq=cross(a,b,q),pin=inside?dp>=0:dp<=0,qin=inside?dq>=0:dq<=0;if(pin)result.push(p);if(pin!==qin){const t=dp/(dp-dq);result.push({x:p.x+(q.x-p.x)*t,y:p.y+(q.y-p.y)*t});}}return result.filter((p,i)=>!i||Math.hypot(p.x-result[i-1].x,p.y-result[i-1].y)>1e-7);}
function subtract(poly,cutter){let remainder=poly;const pieces=[];for(let i=0;i<cutter.length&&remainder.length>=3;i++){const a=cutter[i],b=cutter[(i+1)%cutter.length],outside=clip(remainder,a,b,false);if(outside.length>=3&&Math.abs(area(outside))>1e-6)pieces.push(outside);remainder=clip(remainder,a,b,true);}return pieces;}
const cache=new WeakMap();
export function geometry(o){const key=JSON.stringify([o.type,o.w,o.h,o.vertices,o.cuts]);const old=cache.get(o);if(old?.key===key)return old.pieces;let pieces=decompose(outline(o));for(const cut of o.cuts||[]){const a=(cut.angle||0)*Math.PI/180,c=Math.cos(a),s=Math.sin(a);const cutter=outline(cut).map(p=>({x:cut.x+p.x*c-p.y*s,y:cut.y+p.x*s+p.y*c}));pieces=pieces.flatMap(p=>subtract(p,cutter));if(pieces.length>3000)throw Error('This shape has too many cut edges. Undo a cut or simplify it.');}cache.set(o,{key,pieces});return pieces;}
export function contains(o,p){return geometry(o).some(poly=>poly.every((a,i)=>cross(a,poly[(i+1)%poly.length],p)>=-1e-6));}
export function validatePolygon(v){
 if(Math.abs(area(v))<1e-6)throw Error('Polygon must enclose an area.');
 const on=(a,b,p)=>Math.abs(cross(a,b,p))<1e-7&&p.x>=Math.min(a.x,b.x)-1e-7&&p.x<=Math.max(a.x,b.x)+1e-7&&p.y>=Math.min(a.y,b.y)-1e-7&&p.y<=Math.max(a.y,b.y)+1e-7;
 for(let i=0;i<v.length;i++){const a=v[i],b=v[(i+1)%v.length];if(Math.hypot(a.x-b.x,a.y-b.y)<1e-6)throw Error('Remove duplicate polygon corners.');for(let j=i+1;j<v.length;j++){if(j===i+1||(i===0&&j===v.length-1))continue;const c=v[j],d=v[(j+1)%v.length];if((cross(a,b,c)*cross(a,b,d)<0&&cross(c,d,a)*cross(c,d,b)<0)||on(a,b,c)||on(a,b,d)||on(c,d,a)||on(c,d,b))throw Error('Polygon edges cannot cross or touch.');}}
}
function decompose(vertices){
 let v=vertices.map(p=>({...p}));
 // Drop straight-line intermediate corners before ear clipping.
 let changed=true;while(changed&&v.length>3){changed=false;for(let i=0;i<v.length;i++)if(Math.abs(cross(v[(i+v.length-1)%v.length],v[i],v[(i+1)%v.length]))<1e-7){v.splice(i,1);changed=true;break;}}
 if(v.every((p,i)=>cross(p,v[(i+1)%v.length],v[(i+2)%v.length])>=0))return [v];
 const pieces=[];while(v.length>3){let found=false;for(let i=0;i<v.length;i++){const a=v[(i+v.length-1)%v.length],b=v[i],c=v[(i+1)%v.length];if(cross(a,b,c)<=1e-7)continue;if(v.some(p=>p!==a&&p!==b&&p!==c&&cross(a,b,p)>=-1e-7&&cross(b,c,p)>=-1e-7&&cross(c,a,p)>=-1e-7))continue;pieces.push([a,b,c]);v.splice(i,1);found=true;break;}if(!found)throw Error('Unable to build polygon. Check its corners.');}pieces.push(v);return pieces;
}
