import test from 'node:test';
import assert from 'node:assert/strict';
import {resizeShape,resizeHandles,resizeHit,resizeCursor} from '../src/resize.js';
import {shape,demo,validate} from '../src/map.js';
import {contains,geometry,area} from '../src/geometry.js';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);
test('all rotated resize handles preserve their opposite edge or corner',()=>{
 for(const angle of [0,30,90,135])for(const handle of resizeHandles({...shape('rectangle',200,300,160,80),angle})){
  const o={...shape('rectangle',200,300,160,80),angle},before=structuredClone(o),a=angle*Math.PI/180;
  const delta={x:handle.sx*40*Math.cos(a)-handle.sy*20*Math.sin(a),y:handle.sx*40*Math.sin(a)+handle.sy*20*Math.cos(a)};
  const resized=resizeShape(o,handle,handle,{x:handle.x+delta.x,y:handle.y+delta.y});
  const opposite=resizeHandles(o).find(h=>h.sx===-handle.sx&&h.sy===-handle.sy),after=resizeHandles(resized).find(h=>h.sx===-handle.sx&&h.sy===-handle.sy);
  near(after.x,opposite.x);near(after.y,opposite.y);assert.deepEqual(o,before);
 }
});
test('resize hits edges at any zoom, uses rotated cursors, and clamps shrinking',()=>{
 const o=shape('oval',200,200,100,80);for(const zoom of [.1,.5,2])assert.equal(resizeHit(o,{x:250+3/zoom,y:200},zoom).sx,1);
 assert.equal(resizeCursor({sx:1,sy:0},90),'ns-resize');assert.equal(resizeCursor({sx:1,sy:1},0),'nwse-resize');
 const tiny=resizeShape(o,{sx:1,sy:0},{x:250,y:200},{x:0,y:200});assert.equal(tiny.w,4);near(tiny.x-tiny.w/2,150);
});
test('resize preserves circle proportions, region anchors, polygon vertices and cut/pin map positions',()=>{
 const circle=resizeShape(shape('circle',100,100,80,80),{sx:1,sy:0},{x:140,y:100},{x:180,y:100});assert.equal(circle.w,120);assert.equal(circle.h,120);
 const region=resizeShape({x:10,y:20,w:100,h:80},{sx:-1,sy:-1},{x:10,y:20},{x:30,y:40},true);assert.deepEqual(region,{x:30,y:40,w:80,h:60});
 const o=shape('polygon',200,200,100,100);o.vertices=[{x:-50,y:-50},{x:50,y:-50},{x:0,y:50}];o.cuts=[{type:'oval',x:0,y:0,w:20,h:10,angle:30}];
 const r=resizeShape(o,{sx:1,sy:0},{x:250,y:200},{x:300,y:200});near(r.vertices[1].x,75);near(r.x+r.cuts[0].x,200);near(r.x+r.motion.anchor.x,200);
});
test('oval cuts retain unequal axes, rotation and a collision opening through JSON round trip',()=>{
 const m=demo(),o=shape('rectangle',400,500,300,200);o.cuts=[{type:'oval',x:0,y:0,w:160,h:60,angle:90}];m.objects=[o];
 const restored=validate(JSON.parse(JSON.stringify(m))).objects[0];assert.equal(contains(restored,{x:0,y:60}),false);assert.equal(contains(restored,{x:50,y:0}),true);
 const removed=60000-geometry(restored).reduce((sum,p)=>sum+Math.abs(area(p)),0);assert.ok(Math.abs(removed-Math.PI*80*30)<20);
});
