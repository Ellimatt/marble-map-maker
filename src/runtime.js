import {pose,boundaryWalls} from './map.js';
import {geometry} from './geometry.js';
import {attachMarbleTeleports} from './marble-teleports.js';
// Each convex piece moves with its source shape, including off-center rotation pins.
export function buildMap(Matter,map){
 const {Bodies,Body,Vertices}=Matter,entries=[];let cleanupTeleports=()=>{};
 if(!Matter.Detector.mapGatesInstalled){const original=Matter.Detector.canCollide;Matter.Detector.canCollide=(a,b)=>original(a,b)&&(!a.gate||a.gate(b.mapBody))&&(!b.gate||b.gate(a.mapBody));Matter.Detector.mapGatesInstalled=true;}
 const gateStates=new Map();let previousTime=0;
 for(const o of map.objects){
  if(o.type==='marble')continue;
  const options={isStatic:true,isSensor:o.type==='teleporter',restitution:o.material?.bounce??.5,friction:o.material?.friction??0,frictionStatic:o.material?.friction??0,render:{fillStyle:o.color}};
  if(o.type==='circle'&&!o.cuts?.length){entries.push({o,b:Bodies.circle(o.x,o.y,o.w/2,options),offset:{x:0,y:0}});continue;}
  for(const vertices of geometry(o)){
   const offset=Vertices.centre(vertices);
   const b=Bodies.fromVertices(o.x+offset.x,o.y+offset.y,[vertices],options,false,0,0,0);
   entries.push({o,b,offset});
  }
 }
 for(const {o,b} of entries){b.restitution=o.material?.bounce??.5;b.friction=o.material?.friction??0;b.frictionStatic=o.material?.friction??0;}
 for(const o of map.objects.filter(o=>o.oneWay&&o.oneWay!=='none')){
 const parts=entries.filter(e=>e.o===o).map(e=>e.b),states=new Map();gateStates.set(o,{parts,states});
 const dir={up:{x:0,y:-1},down:{x:0,y:1},left:{x:-1,y:0},right:{x:1,y:0}}[o.oneWay];
 for(const part of parts)part.collisionFilter.gate=marble=>{if(!marble||marble.isStatic)return true;if(!states.has(marble))states.set(marble,marble.velocity.x*dir.x+marble.velocity.y*dir.y>0);return !states.get(marble);};
 }
 function prepare(marbles,engine){for(const b of marbles)b.collisionFilter.mapBody=b;cleanupTeleports();if(engine)cleanupTeleports=attachMarbleTeleports(Matter,engine,entries.filter(e=>e.o.type==='teleporter').map(e=>({body:e.b,destination:e.o.destination})),marbles);}
 function update(seconds){for(const {o,b,offset:v} of entries){const p=pose(o,seconds),m=o.motion;let jump=m.type==='teleport'&&Math.floor(seconds/m.interval)!==Math.floor(previousTime/m.interval);
 if(['path','pathRotate'].includes(m.type)&&m.playback==='loop'){const length=m.path.slice(1).reduce((sum,p,i)=>sum+Math.hypot(p.x-m.path[i].x,p.y-m.path[i].y),0);if(length)jump=Math.floor(seconds*m.speed/length)!==Math.floor(previousTime*m.speed/length);}
 Body.setPosition(b,{x:p.x+Math.cos(p.angle)*v.x-Math.sin(p.angle)*v.y,y:p.y+Math.sin(p.angle)*v.x+Math.cos(p.angle)*v.y},!jump);if(jump)Body.setVelocity(b,{x:0,y:0});Body.setAngle(b,p.angle,true);}previousTime=seconds;for(const {parts,states} of gateStates.values())for(const marble of states.keys()){if(!parts.some(b=>marble.bounds.max.x>=b.bounds.min.x-2&&marble.bounds.min.x<=b.bounds.max.x+2&&marble.bounds.max.y>=b.bounds.min.y-2&&marble.bounds.min.y<=b.bounds.max.y+2))states.delete(marble);}}
 update(0);
 const boundaries=boundaryWalls(map).map(r=>Bodies.rectangle(r.x,r.y,r.w,r.h,{isStatic:true,restitution:.5,friction:0,label:'map-boundary',render:{fillStyle:'#7397ab'}}));
 return {bodies:[...entries.map(e=>e.b),...boundaries],update,prepare,dispose(){cleanupTeleports();}};
}
