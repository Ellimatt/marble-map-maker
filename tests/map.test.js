import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {demo,validate,clone,pose,shape} from '../src/map.js';
import {buildMap} from '../src/runtime.js';
import fs from 'node:fs';
import vm from 'node:vm';
const module={exports:{}};vm.runInThisContext('(function(module,exports){'+fs.readFileSync(new URL('../vendor/matter.min.js',import.meta.url),'utf8')+'\n})')(module,module.exports);const Matter=module.exports;
test('map JSON round trip and rejection',()=>{const m=demo();assert.deepEqual(validate(JSON.parse(JSON.stringify(m))),m);for(const mutate of [m=>m.version=2,m=>m.width=NaN,m=>m.objects[0].motion.type='code',m=>m.objects[1].id=m.objects[0].id,m=>m.objects[0].motion.path=null]){const bad=clone(m);mutate(bad);assert.throws(()=>validate(bad));}});
test('off-center pin remains fixed through rotation',()=>{const o=shape('rectangle',100,200);o.angle=30;o.motion.type='rotate';o.motion.anchor={x:70,y:12};for(const t of [0,.25,1,5]){const p=pose(o,t),a=o.motion.anchor,b=o.angle*Math.PI/180;assert.ok(Math.abs(p.x+Math.cos(p.angle)*a.x-Math.sin(p.angle)*a.y-(o.x+Math.cos(b)*a.x-Math.sin(b)*a.y))<1e-8);assert.ok(Math.abs(p.y+Math.sin(p.angle)*a.x+Math.cos(p.angle)*a.y-(o.y+Math.sin(b)*a.x+Math.cos(b)*a.y))<1e-8);}});
test('path pingpong and loop use elapsed seconds',()=>{const o=shape('rectangle',0,0);Object.assign(o.motion,{type:'path',speed:100,path:[{x:0,y:0},{x:100,y:0}]});assert.equal(pose(o,.5).x,50);assert.equal(pose(o,1.5).x,50);assert.equal(pose(o,2).x,0);o.motion.playback='loop';assert.equal(pose(o,1.5).x,50);});
test('shared runtime collides marbles with a wall',()=>{const m=demo();m.objects=[shape('wall',450,400,800,20)];const e=Matter.Engine.create(),r=buildMap(Matter,m),ball=Matter.Bodies.circle(450,100,8);Matter.Composite.add(e.world,[...r.bodies,ball]);for(let i=0;i<240;i++){r.update(i/120);Matter.Engine.update(e,1000/120);}assert.ok(ball.position.y<400);assert.ok(ball.position.y>370);});
test('polygon runtime preserves off-center vertices',()=>{const m=demo(),o=shape('polygon',200,200,100,100);o.vertices=[{x:-50,y:-50},{x:50,y:-50},{x:0,y:50}];m.objects=[o];validate(m);const r=buildMap(Matter,m);assert.ok(Math.abs(Math.min(...r.bodies[0].vertices.map(v=>v.y))-150)<1e-6);});

test('automatic boundaries contain marbles on all four edges after resizing and JSON round trip',()=>{
 for(const [width,height] of [[900,1400],[320,480]]){
  const m=demo();m.objects=[];m.width=width;m.height=height;
  const r=buildMap(Matter,validate(JSON.parse(JSON.stringify(m)))) ,e=Matter.Engine.create();e.gravity.y=0;
  const balls=[Matter.Bodies.circle(12,height/2,8),Matter.Bodies.circle(width-12,height/2,8),Matter.Bodies.circle(width/2,12,8),Matter.Bodies.circle(width/2,height-12,8)];
  const velocities=[{x:-5,y:0},{x:5,y:0},{x:0,y:-5},{x:0,y:5}];
  balls.forEach((b,i)=>Matter.Body.setVelocity(b,velocities[i]));Matter.Composite.add(e.world,[...r.bodies,...balls]);
  for(let i=0;i<120;i++){r.update(i/120);Matter.Engine.update(e,1000/120);for(const b of balls){assert.ok(b.position.x>=7&&b.position.x<=width-7);assert.ok(b.position.y>=7&&b.position.y<=height-7);}}
  assert.equal(r.bodies.filter(b=>b.label==='map-boundary').length,4);
 }
});
import {geometry,area,contains} from '../src/geometry.js';
test('rectangle cuts subtract union area and round trip',()=>{
 const m=demo(),o=shape('rectangle',450,400,200,200);o.cuts=[{type:'rectangle',x:0,y:0,w:100,h:100,angle:0},{type:'rectangle',x:25,y:0,w:100,h:100,angle:0}];m.objects=[o];
 assert.equal(geometry(o).reduce((sum,p)=>sum+area(p),0),27500);
 assert.equal(contains(o,{x:0,y:0}),false);assert.equal(contains(o,{x:-90,y:0}),true);
 assert.deepEqual(validate(JSON.parse(JSON.stringify(m))),m);
 o.cuts=[{type:'rectangle',x:0,y:0,w:500,h:500,angle:0}];assert.throws(()=>validate(m),/entire shape/);
});
test('circle cut creates a real hole that does not collide with a marble',()=>{
 const m=demo(),o=shape('rectangle',450,400,200,200);o.cuts=[{type:'circle',x:0,y:0,w:100,h:100,angle:0}];m.objects=[o];
 const r=buildMap(Matter,m),ball=Matter.Bodies.circle(450,400,8);
 assert.equal(Matter.Query.collides(ball,r.bodies).length,0);
 Matter.Body.setPosition(ball,{x:520,y:400});assert.ok(Matter.Query.collides(ball,r.bodies).length>0);
 const areaLeft=geometry(o).reduce((s,p)=>s+area(p),0);assert.ok(Math.abs(areaLeft-(40000-Math.PI*2500))<20);
});
test('edge cut opens a channel marbles can fall through',()=>{
 const m=demo(),o=shape('rectangle',450,400,200,40);o.cuts=[{type:'rectangle',x:0,y:0,w:60,h:100,angle:0}];m.objects=[o];
 const r=buildMap(Matter,m),e=Matter.Engine.create(),ball=Matter.Bodies.circle(450,300,8);Matter.Composite.add(e.world,[...r.bodies,ball]);
 for(let i=0;i<100;i++){r.update(i/120);Matter.Engine.update(e,1000/120);}assert.ok(ball.position.y>450);
});
test('combined path and rotation preserves the translated pin and cut holes',()=>{
 const m=demo(),o=shape('rectangle',100,200,200,200);Object.assign(o.motion,{type:'pathRotate',speed:100,rotationSpeed:90,anchor:{x:20,y:0},path:[{x:100,y:200},{x:300,y:200}]});o.cuts=[{type:'circle',x:0,y:0,w:80,h:80,angle:0}];m.objects=[o];validate(m);
 const p=pose(o,1);assert.ok(Math.abs(p.angle-Math.PI/2)<1e-8);assert.ok(Math.abs(p.x-220)<1e-8);assert.ok(Math.abs(p.y-180)<1e-8);
 const r=buildMap(Matter,m);r.update(1);const ball=Matter.Bodies.circle(p.x,p.y,8);assert.equal(Matter.Query.collides(ball,r.bodies).length,0);
});
import {savePrefab,placePrefab,validatePrefab} from '../src/prefabs.js';
test('saved groups preserve all properties and translate paths with independent IDs',()=>{
 const source=demo().objects.slice(4);source[0].cuts=[{type:'circle',x:10,y:0,w:8,h:8,angle:0}];source[0].motion.anchor={x:30,y:4};const before=clone(source);
 const prefab=validatePrefab(JSON.parse(JSON.stringify(savePrefab('Moving pair',source))));const placed=placePrefab(prefab,600,700),again=placePrefab(prefab,600,700);
 assert.deepEqual(source,before);assert.equal(placed[1].y-placed[0].y,source[1].y-source[0].y);
 for(let i=0;i<source.length;i++){const a=source[i],b=placed[i],dx=b.x-a.x,dy=b.y-a.y;assert.notEqual(a.id,b.id);assert.notEqual(b.id,again[i].id);assert.deepEqual(b.cuts,a.cuts);assert.deepEqual(b.motion.anchor,a.motion.anchor);assert.equal(b.motion.speed,a.motion.speed);assert.deepEqual(b.motion.path,a.motion.path.map(p=>({x:p.x+dx,y:p.y+dy})));}
 placed[0].motion.anchor.x=999;assert.notEqual(prefab.objects[0].motion.anchor.x,999);
});
test('concave polygon leaves its notch open in physics',()=>{
 const m=demo(),o=shape('polygon',450,400,100,100);o.vertices=[{x:-50,y:-50},{x:50,y:-50},{x:50,y:-10},{x:-10,y:-10},{x:-10,y:50},{x:-50,y:50}];m.objects=[o];validate(m);
 assert.equal(geometry(o).reduce((s,p)=>s+area(p),0),6400);
 const r=buildMap(Matter,m);assert.equal(Matter.Query.collides(Matter.Bodies.circle(480,430,5),r.bodies).length,0);assert.ok(Matter.Query.collides(Matter.Bodies.circle(420,430,5),r.bodies).length>0);
 o.vertices=[{x:0,y:0},{x:100,y:100},{x:0,y:100},{x:100,y:0}];assert.throws(()=>validate(m));
});
test('ovals use distinct axes and scale marbles do not become obstacles',()=>{
 const m=demo(),o=shape('oval',450,400,200,80),ref=shape('marble',450,100,16,16);m.objects=[o,ref];validate(m);const r=buildMap(Matter,m);
 assert.equal(Matter.Query.collides(Matter.Bodies.circle(450,100,8),r.bodies).length,0);
 assert.ok(Math.abs(r.bodies[0].bounds.max.x-r.bodies[0].bounds.min.x-200)<.01);
 assert.ok(Math.abs(r.bodies[0].bounds.max.y-r.bodies[0].bounds.min.y-80)<.01);
 assert.deepEqual(validate(JSON.parse(JSON.stringify(m))),m);
});
test('one-way gate passes downward travel and blocks upward travel',()=>{
 for(const [y,vy,passes] of [[350,4,true],[450,-4,false]]){
 const m=demo(),o=shape('rectangle',450,400,200,20);o.oneWay='down';m.objects=[o];const r=buildMap(Matter,m),e=Matter.Engine.create();e.gravity.y=0;const ball=Matter.Bodies.circle(450,y,8,{frictionAir:0});r.prepare([ball]);Matter.Body.setVelocity(ball,{x:0,y:vy});Matter.Composite.add(e.world,[...r.bodies,ball]);for(let i=0;i<60;i++){r.update(i/120);Matter.Engine.update(e,1000/120);}assert.ok(ball.position.y>410,`${passes?'passing':'blocked'} marble ended at ${ball.position.y}`);
 }
});
test('teleport and path loops jump without sweeping between endpoints',()=>{
 const m=demo(),o=shape('rectangle',100,300,40,20);Object.assign(o.motion,{type:'path',speed:100,playback:'loop',path:[{x:100,y:300},{x:300,y:300}]});m.objects=[o];assert.ok(pose(o,1.99).x>298);assert.equal(pose(o,2).x,100);const r=buildMap(Matter,m);r.update(1.99);r.update(2);assert.equal(r.bodies[0].velocity.x,0);
 o.motion.type='teleport';o.motion.interval=2;validate(m);assert.equal(pose(o,1).x,100);assert.equal(pose(o,2).x,300);assert.equal(pose(o,4).x,100);
});
test('materials reach collision bodies and survive saved shape reuse',()=>{const o=shape('rectangle',200,200);o.material={bounce:.9,friction:.8};o.oneWay='right';const p=savePrefab('Rubber gate',[o]);const m=demo();m.objects=placePrefab(p,300,300);validate(m);const r=buildMap(Matter,m);assert.equal(r.bodies[0].restitution,.9);assert.equal(r.bodies[0].friction,.8);assert.equal(m.objects[0].oneWay,'right');});

test('teleport block exports its destination and teleports marbles without moving the block',()=>{
 const m=demo();const o=shape('teleporter',450,400,100,40);o.destination={x:600,y:800};m.objects=[o];
 assert.deepEqual(validate(JSON.parse(JSON.stringify(m))),m);
 const e=Matter.Engine.create();e.gravity.y=0;const r=buildMap(Matter,m),ball=Matter.Bodies.circle(450,400,8,{frictionAir:0});
 Matter.Body.setVelocity(ball,{x:2,y:3});r.prepare([ball],e);Matter.Composite.add(e.world,[...r.bodies,ball]);Matter.Engine.update(e,1000/60);
 assert.ok(Math.abs(ball.position.x-600)<1e-6);assert.ok(Math.abs(ball.position.y-800)<1e-6);assert.ok(Math.abs(ball.velocity.x-2)<1e-6);assert.ok(Math.abs(ball.velocity.y-3)<1e-6);
 assert.ok(Math.abs(r.bodies[0].position.x-450)<1e-6);assert.equal(r.bodies[0].isSensor,true);r.dispose();
 o.destination.x=0;assert.throws(()=>validate(m),/Destination/);
});
test('teleport block prefab moves destination together with its source',()=>{
 const o=shape('teleporter',300,400,100,40);o.destination={x:600,y:800};
 const saved=savePrefab('Portal',[o]),placed=placePrefab(saved,400,500)[0];
 assert.deepEqual(placed.destination,{x:700,y:900});assert.equal(placed.x,400);assert.equal(placed.y,500);
});
