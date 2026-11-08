import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {PhaseEffect, PHASE} from './hi3d-phase-v4.js';
const clamp=T.MathUtils.clamp;
export class World {
 constructor(canvas,onProgress){
  this.renderer=new T.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));this.renderer.setSize(innerWidth,innerHeight);this.renderer.outputColorSpace=T.SRGBColorSpace;this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.4;
  this.camera=new T.PerspectiveCamera(48,innerWidth/innerHeight,.1,120);this.worlds={};this.assets={};this.current='temple';this.yaw=0;this.pitch=.40;this.distance=6.1;this.keys=new Set();this.clock=new T.Clock();this.elapsed=0;this.playing=false;this.blocked=false;this.onProgress=onProgress;this.markers=[];this.sparks=[];this.rotators=[];this.activeAction=null;this.stats={};this.npcTimes=[];this.autoPath=null;
  window.addEventListener('resize',()=>{this.renderer.setSize(innerWidth,innerHeight);this.camera.aspect=innerWidth/innerHeight;this.camera.updateProjectionMatrix()});
  canvas.addEventListener('pointerdown',e=>{if(e.button!==0||this.blocked||!this.playing)return;this.drag={x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId)});
  canvas.addEventListener('pointermove',e=>{if(!this.drag)return;this.yaw-=(e.clientX-this.drag.x)*.006;this.pitch=clamp(this.pitch+(e.clientY-this.drag.y)*.004,.14,.85);this.drag={x:e.clientX,y:e.clientY}});
  canvas.addEventListener('pointerup',()=>this.drag=null);canvas.addEventListener('pointercancel',()=>this.drag=null);canvas.addEventListener('wheel',e=>{if(this.playing)this.distance=clamp(this.distance+e.deltaY*.004,3.8,8)},{passive:true});
  addEventListener('keydown',e=>{if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key)&&!['INPUT','TEXTAREA'].includes(e.target.tagName))e.preventDefault();this.keys.add(e.code)});addEventListener('keyup',e=>this.keys.delete(e.code));addEventListener('blur',()=>{this.keys.clear();this.drag=null});document.addEventListener('visibilitychange',()=>{this.keys.clear();this.clock.getDelta()});
 }
 async load(){
  const names=['player-rig-v3','librarian','monk','hall','temple','bamboo','tree','bookshelf','scroll','book','bucket','incense','buddha','cushion','platform','candle','gate','yellow-moon'];let done=0;const loader=new GLTFLoader();
  // Two simultaneous decodes keep initial memory use bounded.
  const queue=[...names];const worker=async()=>{while(queue.length){const n=queue.shift();const gltf=await loader.loadAsync(`./assets/hi3d-${n}.glb`);gltf.scene.traverse(o=>{if(o.isMesh){o.castShadow=false;o.receiveShadow=false;const mats=Array.isArray(o.material)?o.material:[o.material];for(const m of mats){m.metalness=0;m.roughness=.82;m.metalnessMap=null;m.roughnessMap=null;if(m.map)m.map.anisotropy=4;}}});if(n==='monk'||n==='librarian')this.addNPCMotion(gltf.scene);this.assets[n]=gltf;this.onProgress(++done,names.length,n)}};await Promise.all([worker(),worker()]);
  this.buildTemple();this.buildFuture();this.buildRooms();this.player=new T.Group();this.visual=this.assets['player-rig-v3'].scene;this.player.add(this.visual);this.mixer=new T.AnimationMixer(this.visual);this.actions={};for(const a of this.assets['player-rig-v3'].animations)this.actions[a.name]=this.mixer.clipAction(a);this.changeAction('Idle');this.mixer.update(0);this.phase=new PhaseEffect(this.player,this.visual);this.dash=null;this.dashCooldown=0;this.setScene('temple',[0,7.5]);this.stats.assets=names;this.stats.animations=this.assets['player-rig-v3'].animations.map(a=>({name:a.name,duration:a.duration,tracks:a.tracks.length}));this.stats.movement='phase';
 }
 material(color,roughness=.85,metalness=0){return new T.MeshStandardMaterial({color,roughness,metalness})}
 box(g,x,y,z,w,h,d,color){const o=new T.Mesh(new T.BoxGeometry(w,h,d),typeof color==='object'?color:this.material(color));o.position.set(x,y,z);g.add(o);return o}
 asset(g,name,x,y,z,s=1,r=0){const a=this.assets[name].scene.clone(true);a.position.set(x,y,z);a.scale.setScalar(s);a.rotation.y=r;g.add(a);return a}
 base(id,bg){const scene=new T.Scene();scene.background=new T.Color(bg);scene.fog=new T.FogExp2(bg,id==='temple'?.022:.027);scene.add(new T.HemisphereLight(id==='temple'?0xa3d8ed:0xb9e6e4,0x253139,id==='temple'?2.1:2.5));const key=new T.DirectionalLight(id==='temple'?0xb8d9f5:0xf4d6ad,id==='temple'?2.8:2.3);key.position.set(5,12,7);scene.add(key);const fill=new T.DirectionalLight(0x729fb1,.7);fill.position.set(-8,4,3);scene.add(fill);this.worlds[id]={scene,colliders:[],hotspots:[],npcs:{}};return scene}
 floorTexture(){const c=document.createElement('canvas');c.width=c.height=512;const q=c.getContext('2d');q.fillStyle='#78858a';q.fillRect(0,0,512,512);let seed=39;const rnd=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296};for(let y=0;y<4;y++)for(let x=0;x<4;x++){const n=109+rnd()*24;q.fillStyle=`rgb(${n-5},${n+5},${n+9})`;q.fillRect(x*128+2,y*128+2,124,124);q.strokeStyle='#c9cdbb44';q.strokeRect(x*128+3,y*128+3,122,122)}for(let i=0;i<5000;i++){q.fillStyle=rnd()>.5?'#162b3411':'#d4ddd817';q.fillRect(rnd()*512,rnd()*512,1+rnd()*3,1+rnd()*2)}const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;tex.wrapS=tex.wrapT=T.RepeatWrapping;tex.repeat.set(5,6);return tex}
 light(g,x,y,z,color=0xffb45f,intensity=9,range=6){const l=new T.PointLight(color,intensity,range,2);l.position.set(x,y,z);g.add(l);return l}
 lantern(g,x,z,h=1.5){this.box(g,x,h/2,z,.12,h,.12,0x353e3c);const mat=new T.MeshStandardMaterial({color:0xffd19a,emissive:0xf2a24c,emissiveIntensity:1.1,roughness:1});this.box(g,x,h,z,.34,.5,.34,mat);this.box(g,x,h+.3,z,.52,.09,.52,0x434346);this.box(g,x,h-.29,z,.45,.07,.45,0x444039);for(const sx of [-1,1])for(const sz of [-1,1])this.box(g,x+sx*.17,h,z+sz*.17,.035,.55,.035,0x514236);this.light(g,x,h+.1,z,0xffb65e,12,6)}
 hotspot(id,scene,label,x,z,h=1.3,radius=2){const data={id,label,pos:new T.Vector3(x,h,z),radius};this.worlds[scene].hotspots.push(data);return data}
 collider(scene,x,z,w,d){this.worlds[scene].colliders.push({x,z,w,d})}
 portal(g,x,z,color){const group=new T.Group();group.position.set(x,0,z);g.add(group);const mat=new T.MeshStandardMaterial({color,emissive:color,emissiveIntensity:2,metalness:.7,roughness:.3});for(const r of [1.05,1.18]){const ring=new T.Mesh(new T.TorusGeometry(r,.022,8,80),mat);ring.position.y=1.4;group.add(ring)}for(let i=0;i<8;i++){const a=i*Math.PI/4;this.box(group,Math.sin(a)*1.18,1.4+Math.cos(a)*1.18,0,.09,.09,.04,mat)}this.box(group,0,.1,0,2.6,.2,1.4,0x304550);this.light(group,0,1.5,.2,color,7,6);return group}
 buildTemple(){
  const g=this.base('temple',0x182d3d);const stone=this.material(0x9ea9a3);stone.map=this.floorTexture();this.box(g,0,-.16,1,28,.3,28,stone);this.asset(g,'temple',0,-.02,-10.5);this.asset(g,'hall',-11.3,0,-1,.78,Math.PI/2);this.asset(g,'hall',11.4,0,2.2,.62,-Math.PI/2);
  for(const x of [-9.2,9.2]){const doorZ=x<0?-1:2.2;for(const [a,b] of [[-5.5,doorZ-1.5],[doorZ+1.5,11.5]]){const z=(a+b)/2,d=b-a;this.box(g,x,.65,z,.28,1.3,d,0x63787b);this.box(g,x,1.34,z,.5,.12,d,0x334b56)}}
  this.box(g,0,.48,11,18.5,.96,.3,0x607178);this.box(g,0,1.03,11,18.8,.14,.55,0x394e58);
  for(const [x,z,s,r] of [[6.5,-1.5,1,0],[7.4,1,.8,1],[6,-2.7,.9,2],[-8,6,.85,1]])this.asset(g,'bamboo',x,0,z,s,r);
  for(const [x,z,s,r] of [[7.5,-6,1.2,0],[-8,-7,1.4,.7],[-14,-13,1.5,1],[14,-13,1.8,2],[-13,10,1,1],[13,9,1.2,0]])this.asset(g,'tree',x,0,z,s,r);
  this.worlds.temple.npcs.monk=this.asset(g,'monk',-5.5,0,3.2);this.collider('temple',-5.5,3.2,.7,.65);this.asset(g,'bucket',-6.1,0,-.2);this.collider('temple',-6.1,-.2,1,1);this.asset(g,'incense',0,.03,-4.5,1.2);this.collider('temple',0,-4.5,1.6,1.4);
  for(const [x,z] of [[-7,7],[7,7],[-6,-3],[6,-3],[-3.4,-5.7],[3.4,-5.7]])this.lantern(g,x,z);
  this.portal(g,0,9.6,0x77c4c7);this.collider('temple',0,9.6,2.6,.6);
  const brass=this.material(0xb09a62,.45,.6);this.box(g,5.5,.62,5.4,.75,1.24,.65,0x385563);this.box(g,5.5,1.27,5.4,1.1,.1,.9,brass);const orb=new T.Mesh(new T.OctahedronGeometry(.19),new T.MeshStandardMaterial({color:0xe7d9a2,emissive:0xc3a75b,emissiveIntensity:1}));orb.position.set(5.5,1.7,5.4);g.add(orb);this.rotators.push(orb);this.collider('temple',5.5,5.4,.85,.8);
  const shadowCanvas=document.createElement('canvas');shadowCanvas.width=shadowCanvas.height=1024;const q=shadowCanvas.getContext('2d');q.strokeStyle='#07151ce8';q.fillStyle='#07151ce8';q.lineCap='round';
  let seed=19;const rand=()=>{seed=(seed*16807)%2147483647;return seed/2147483647};
  for(let i=0;i<9;i++){const bx=950-rand()*220,by=950;const tx=100+rand()*600,ty=rand()*400;q.lineWidth=5+rand()*8;q.beginPath();q.moveTo(bx,by);q.quadraticCurveTo(bx-50,500,tx,ty);q.stroke();for(let j=0;j<7;j++){const t=.2+j*.095;const x=bx+(tx-bx)*t,y=by+(ty-by)*t;for(const sign of [-1,1]){const ex=x+sign*(50+rand()*70),ey=y-60-rand()*60;q.lineWidth=2;q.beginPath();q.moveTo(x,y);q.lineTo(ex,ey);q.stroke();for(let k=0;k<3;k++){const a=.4+k*.2;q.save();q.translate(x+(ex-x)*a,y+(ey-y)*a);q.rotate(sign*.7+rand()*.5);q.beginPath();q.ellipse(0,-17,4+rand()*4,24,0,0,Math.PI*2);q.fill();q.restore()}}}}
  this.shadowLayer=new T.Mesh(new T.PlaneGeometry(10.5,9),new T.MeshBasicMaterial({map:new T.CanvasTexture(shadowCanvas),transparent:true,opacity:.65,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2}));this.shadowLayer.rotation.x=-Math.PI/2;this.shadowLayer.position.set(1.2,.014,1.1);g.add(this.shadowLayer);
  this.water=new T.Mesh(new T.PlaneGeometry(9.2,8,48,48),new T.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{time:{value:0}},vertexShader:`uniform float time; varying vec2 vUv; void main(){vUv=uv;vec3 p=position;p.z+=sin(p.x*3.+time)*.008;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,fragmentShader:`uniform float time;varying vec2 vUv;void main(){float a=sin(vUv.x*70.+vUv.y*12.+time*.7)*sin(vUv.y*80.-time*.8);float b=pow(max(0.,sin(vUv.x*24.+vUv.y*28.+time*.5)),16.);float edge=smoothstep(0.,.04,vUv.x)*smoothstep(0.,.04,vUv.y)*smoothstep(0.,.04,1.-vUv.x)*smoothstep(0.,.04,1.-vUv.y);gl_FragColor=vec4(vec3(.12,.42,.53)+a*.035+b*.24,(.34+b*.2)*edge);}`}));this.water.rotation.x=-Math.PI/2;this.water.position.set(0,.055,1.4);g.add(this.water);
  this.ripples=[];for(let i=0;i<6;i++){const r=new T.Mesh(new T.RingGeometry(.18,.20,40),new T.MeshBasicMaterial({color:0xb9e6ed,transparent:true,opacity:0,side:T.DoubleSide,depthWrite:false}));r.rotation.x=-Math.PI/2;r.position.y=.075;g.add(r);this.ripples.push({mesh:r,life:2})}
  this.normalMoon=new T.Mesh(new T.SphereGeometry(1.5,32,16),new T.MeshBasicMaterial({color:0xd7e5df}));this.normalMoon.position.set(8,12,-23);g.add(this.normalMoon);this.skyBottle=this.asset(g,'yellow-moon',8,8.7,-23,2.35,-.30);this.skyBottle.rotation.z=-.16;this.skyBottle.name='异常_黄月亮洗衣液';this.skyBottle.traverse(o=>{if(o.isMesh){if(o.material.map)o.material=new T.MeshBasicMaterial({map:o.material.map,color:0xffffff,toneMapped:false,side:T.DoubleSide,fog:false});else{o.material=o.material.clone();o.material.fog=false;o.material.emissive=new T.Color(0x655520);o.material.emissiveIntensity=.24;}}});this.normalMoon.visible=false;this.light(g,8,12,-19,0xffed9e,220,30);
  const starPos=[];for(let i=0;i<180;i++)starPos.push((rand()-.5)*100,15+rand()*35,-25-rand()*40);const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(starPos,3));g.add(new T.Points(geo,new T.PointsMaterial({size:.07,color:0xbcd4df,transparent:true,opacity:.7})));
  this.hotspot('monk','temple','庭院僧人',-5.5,3.2,2.15,2);this.hotspot('water','temple','庭中地面',-1.7,3.6,.55,2.1);this.hotspot('shadow','temple','竹柏暗纹',3.3,.3,.8,2);this.hotspot('bucket','temple','木桶与扫帚',-6.1,-.2,1.65,1.8);this.hotspot('return','temple','回到未来',0,8.9,2.8,2);this.hotspot('repair','temple','修复台',5.5,5.4,2.1,2);this.hotspot('enter_shrine','temple','进入主殿',0,-3.6,2.5,2);this.hotspot('enter_westhall','temple','进入西偏殿',-7.7,-1.5,2,1.8);this.hotspot('enter_easthall','temple','进入经卷间',7.7,2.4,2,1.8);
 }
 buildFuture(){
  const g=this.base('future',0x152a38);const floor=this.material(0x364952,.37,.25);this.box(g,0,-.15,1,19,.3,20,floor);
  for(const x of [-8,8]){this.box(g,x,2.2,0,.3,4.4,18,0x263c47);this.box(g,x-.12*Math.sign(x),2.4,0,.06,.04,18,0xb6a370)}this.box(g,0,2.5,-8,16,5,.3,0x1f3946);
  const brass=this.material(0xa18d5a,.43,.55);for(const x of [-7.5,7.5])for(const z of [-7,-2,3,8]){this.box(g,x,2.45,z,.28,4.9,.28,0x4d4741);this.box(g,x,4.9,z,.5,.2,.5,brass)}
  for(const z of [-6.3,-3.7,-1.1]){this.asset(g,'bookshelf',-7.05,0,z,1.22,Math.PI/2);this.asset(g,'bookshelf',7.05,0,z,1.22,-Math.PI/2)}
  for(const x of [-4.6,-2.3,0,2.3,4.6])this.asset(g,'bookshelf',x,0,-7.35,1.28);
  for(const x of [-5,5])this.box(g,x,.012,0,.028,.024,17,brass);for(const z of [-5,4.5])this.box(g,0,.012,z,10,.024,.028,brass);
  this.box(g,-3.2,.53,-3,2.8,1.06,1.3,0x3c4748);this.box(g,-3.2,1.1,-3,3,.12,1.5,brass);this.asset(g,'scroll',-3.5,1.17,-3.1,1.2);this.asset(g,'book',-2.45,1.17,-2.9,1.2,.3);this.collider('future',-3.2,-3,3,1.5);
  this.worlds.future.npcs.librarian=this.asset(g,'librarian',-3.2,0,-4.9);this.collider('future',-3.2,-4.9,.7,.65);
  this.portal(g,3.8,-.5,0x65ccd9);this.collider('future',3.8,-.5,2.6,.7);this.box(g,3.8,.6,1,1.1,1.2,.65,0x34505b);this.box(g,3.8,1.23,1,1.15,.08,.7,brass);this.collider('future',3.8,1,1.15,.7);
  for(const [x,z] of [[-5.8,4.8],[5.8,4.8],[-5.8,-5.5],[5.8,-5.5]]){this.lantern(g,x,z,2.5);this.light(g,x,3,z,0xf8c891,14,8)}
  for(const x of [-4,0,4]){const ring=new T.Mesh(new T.TorusGeometry(1.4,.014,6,64),new T.MeshBasicMaterial({color:0x9ecfcd,transparent:true,opacity:.4}));ring.rotation.x=Math.PI/2;ring.position.set(x,5,-1);g.add(ring)}
  for(let i=0;i<12;i++){const page=new T.Mesh(new T.PlaneGeometry(.18,.28),new T.MeshBasicMaterial({color:0xc6dfce,side:T.DoubleSide,transparent:true,opacity:.35}));page.position.set(3.8+Math.sin(i)*1.5,1+i*.17,-.6+Math.cos(i)*.7);page.rotation.y=i;g.add(page);this.rotators.push(page)}
  this.light(g,0,4,2,0x8fcdda,16,15);this.hotspot('librarian','future','馆员',-3.2,-4.9,2.2,2.3);this.hotspot('archive','future','原作阅览台',-3.2,-2,1.65,2);this.hotspot('travel','future','穿梭终端',3.8,1.2,2.4,2);
 }
 buildRooms(){
  for(const id of ['shrine','westhall','easthall']){
   const g=this.base(id,0x1c2c35);this.box(g,0,-.13,0,10.5,.26,12,0x756f60);this.box(g,0,2.6,-5.5,10.5,5.2,.3,0x514339);
   for(const x of [-5.2,5.2]){this.box(g,x,2.6,0,.3,5.2,11.3,0x4b4037);for(const z of [-3,1,4.8])this.box(g,x*.94,2.7,z,.24,5.4,.24,0x322d29)}
   for(const z of [-4.8,-.5,4.8])this.box(g,0,5.3,z,10.4,.24,.24,0x3c3028);
   for(const [x,z] of [[-3.7,-3.8],[3.7,-3.8],[-3.7,3.8],[3.7,3.8]]){this.asset(g,'candle',x,0,z,1.1);this.light(g,x,1.6,z,0xffb758,14,7);}
   this.box(g,-3.1,2.3,5.7,3.7,4.6,.3,0x443b34);this.box(g,3.1,2.3,5.7,3.7,4.6,.3,0x443b34);this.box(g,0,4.55,5.7,2.5,.2,.35,0x8d7550);
   this.asset(g,'gate',-.1,0,7.3,1.05,Math.PI);this.hotspot('exit_room',id,'返回庭院',0,4.8,2.2,1.9);
   if(id==='shrine'){
    const base=this.asset(g,'platform',0,0,-3);base.scale.set(1.8,.91,1.95);this.asset(g,'buddha',0,.5,-3);this.collider(id,0,-3,3.7,3.5);this.asset(g,'incense',0,0,-.7,.8);this.collider(id,0,-.7,1.3,1);
    this.light(g,0,4.5,-1,0xffd89b,24,10);this.hotspot('buddha',id,'莲座佛像',0,-.2,2.7,2.4);
    for(const x of [-2,0,2]){const cushion=this.asset(g,'cushion',x,.015,2,1.1);cushion.name='蒲团_'+x;}
   }else{
    for(const x of [-3.6,3.6])this.asset(g,'bookshelf',x,0,-4.8,.95);
    const table=this.asset(g,'platform',0,0,-1.8);table.scale.set(1.7,1.8,.90);this.asset(g,'scroll',-.55,1,-1.8,1.3);this.asset(g,'book',.65,1,-1.65,1.3,.2);this.collider(id,0,-1.8,3.4,1.6);
    this.hotspot(id==='westhall'?'duty':'staging',id,id==='westhall'?'值夜簿':'布景札记',0,-.5,1.6,1.9);this.light(g,0,3,-1.5,0xffcf95,15,9);
   }
  }
 }
 setScene(id,pos){this.cancelAuto();this.stopPhase();this.current=id;const w=this.worlds[id];w.scene.add(this.player);const inside=!['future','temple'].includes(id);const p=pos||(id==='future'?[0,5.6]:inside?[0,3.5]:[0,7.2]);this.player.position.set(clamp(p[0],inside?-4.5:-7.2,inside?4.5:7.2),0,clamp(p[1],inside?-4.7:id==='future'?-5.7:-3.2,inside?4.5:8.5));this.player.rotation.y=Math.PI;this.yaw=0;this.pitch=inside?.14:.4;this.keys.clear();this.updateCamera(true)}
 applyRepair(a){this.normalMoon.visible=!!a;this.skyBottle.visible=!a;this.water.visible=a?a.water:true;this.shadowLayer.visible=a?a.shadow:true;if(!this.water.visible)for(const r of this.ripples)r.mesh.material.opacity=0}
 changeAction(name){const action=this.actions?.[name]||Object.entries(this.actions||{}).find(([k])=>k.includes(name))?.[1];if(!action||this.activeAction===action)return;action.reset().setEffectiveTimeScale(name==='Walk'?1.42:1).fadeIn(.18).play();if(this.activeAction)this.activeAction.fadeOut(.18);this.activeAction=action;this.actionName=name}
 blockedAt(x,z){const inside=!['future','temple'].includes(this.current);const minZ=inside?-4.9:this.current==='future'?-6.2:-3.5,maxZ=inside?5.1:this.current==='future'?8.5:10.1;const maxX=inside?4.7:7.9;if(x< -maxX||x>maxX||z<minZ||z>maxZ)return true;return this.worlds[this.current].colliders.some(c=>Math.abs(x-c.x)<c.w/2+.24&&Math.abs(z-c.z)<c.d/2+.24)}
 addNPCMotion(scene){scene.traverse(o=>{if(!o.isMesh)return;const materials=Array.isArray(o.material)?o.material:[o.material];o.material=materials.map(m=>{const n=m.clone();const time={value:0};this.npcTimes.push(time);n.onBeforeCompile=shader=>{shader.uniforms.npcTime=time;shader.vertexShader='uniform float npcTime;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
 float breath=sin(npcTime*1.7);float chest=smoothstep(.85,1.3,position.y)*(1.-smoothstep(1.48,1.65,position.y));
 transformed.z+=breath*.0055*chest;transformed.x+=sin(npcTime*.63)*.006*smoothstep(.25,1.4,position.y);
 float head=smoothstep(1.48,1.62,position.y);float turn=sin(npcTime*.47)*.035*head;vec2 hz=transformed.xz;transformed.x=hz.x*cos(turn)-hz.y*sin(turn);transformed.z=hz.x*sin(turn)+hz.y*cos(turn);
 `);};n.customProgramCacheKey=()=> 'npc-breath-v3';return n});if(!Array.isArray(o.material)||materials.length===1)o.material=o.material[0];});}
 cancelAuto(){if(this.dash?.auto)this.stopPhase();this.autoPath=null;this.autoArrival=null;}
 stopPhase(){this.dash=null;this.dashCooldown=0;this.phase?.clear();if(this.activeAction)this.activeAction.paused=false;this.actionName='Idle';}
 clearSegment(from,to){const length=Math.hypot(to.x-from.x,to.z-from.z),steps=Math.max(1,Math.ceil(length/.05));for(let i=1;i<=steps;i++){const t=i/steps;if(this.blockedAt(from.x+(to.x-from.x)*t,from.z+(to.z-from.z)*t))return false;}return true;}
 beginPhase(target,auto=false){
  const from=this.player.position.clone(),to=new T.Vector3(target.x,0,target.z),distance=from.distanceTo(to);
  if(distance<.045||!this.clearSegment(from,to))return false;
  this.player.rotation.y=Math.atan2(to.x-from.x,to.z-from.z);
  this.dash={from,to,time:0,duration:Math.max(.10,distance/PHASE.speed),auto};
  this.activeAction.paused=true;this.actionName='Phase';this.phase.depart(this.worlds[this.current].scene);return true;
 }
 navigate(x,z,onArrival){const step=.35;const node=(x,z)=>[Math.round(x/step),Math.round(z/step)];const key=(x,z)=>x+','+z;const start=node(this.player.position.x,this.player.position.z),target=node(x,z);const queue=[{p:start,g:0,f:0}],best=new Map([[key(...start),0]]),parents=new Map();let final=null;const dirs=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
  for(let i=0;queue.length&&i<7000;i++){queue.sort((a,b)=>a.f-b.f);const a=queue.shift();if(Math.hypot(a.p[0]-target[0],a.p[1]-target[1])<1.3){final=a.p;break;}for(const d of dirs){const p=[a.p[0]+d[0],a.p[1]+d[1]];if(this.blockedAt(p[0]*step,p[1]*step)||this.blockedAt((p[0]-.5*d[0])*step,(p[1]-.5*d[1])*step))continue;const g=a.g+Math.hypot(...d),k=key(...p);if(g>=(best.get(k)??Infinity))continue;best.set(k,g);parents.set(k,a.p);queue.push({p,g,f:g+Math.hypot(p[0]-target[0],p[1]-target[1])});}}
  if(!final)return false;const path=[];let p=final;while(key(...p)!==key(...start)){path.push({x:p[0]*step,z:p[1]*step});p=parents.get(key(...p));if(!p)break;}this.autoPath=path.reverse();this.autoArrival=onArrival;return true;}
 move(dt){
  if(this.blocked||!this.playing){if(this.dash||this.phase.active||this.phase.arrival)this.stopPhase();return false;}
  let x=0,z=0;const k=this.keys;
  if(k.has('KeyW')||k.has('ArrowUp'))z--;if(k.has('KeyS')||k.has('ArrowDown'))z++;
  if(k.has('KeyA')||k.has('ArrowLeft'))x--;if(k.has('KeyD')||k.has('ArrowRight'))x++;
  if((x||z)&&this.autoPath)this.cancelAuto();
  this.dashCooldown=Math.max(0,this.dashCooldown-dt);
  if(!this.dash&&this.dashCooldown===0){
   const p=this.player.position;
   if(this.autoPath){
    while(this.autoPath.length&&Math.hypot(this.autoPath[0].x-p.x,this.autoPath[0].z-p.z)<.12)this.autoPath.shift();
    if(!this.autoPath.length){const callback=this.autoArrival;this.cancelAuto();callback?.();return false;}
    let index=-1;
    for(let i=0;i<this.autoPath.length;i++){
     const candidate=this.autoPath[i];
     if(Math.hypot(candidate.x-p.x,candidate.z-p.z)>PHASE.distance)break;
     if(!this.clearSegment(p,candidate))break;index=i;
    }
    if(index<0||!this.beginPhase(this.autoPath[index],true)){this.cancelAuto();return false;}
    this.autoPath.splice(0,index);
   }else if(x||z){
    const n=Math.hypot(x,z),dx=(x*Math.cos(this.yaw)+z*Math.sin(this.yaw))/n,dz=(-x*Math.sin(this.yaw)+z*Math.cos(this.yaw))/n;
    // Sweep the entire burst, including a small clearance before each obstacle.
    let distance=0;for(let d=.05;d<=PHASE.distance+.0001;d+=.05){if(this.blockedAt(p.x+dx*d,p.z+dz*d))break;distance=d;}
    if(distance>=.05)this.beginPhase({x:p.x+dx*distance,z:p.z+dz*distance});
   }
  }
  if(!this.dash)return false;
  const d=this.dash;d.time=Math.min(d.duration,d.time+dt);const t=d.time/d.duration;
  const progress=t*t*(3-2*t);this.player.position.lerpVectors(d.from,d.to,progress);
  this.phase.trace(this.worlds[this.current].scene);
  if(t>=1){this.dash=null;this.dashCooldown=PHASE.cooldown;this.phase.land(this.worlds[this.current].scene);this.activeAction.paused=false;this.actionName='Idle';}
  return true;
 }

 updateCamera(immediate=false){if(!this.player)return;const target=this.player.position.clone().add(new T.Vector3(0,!['future','temple'].includes(this.current)?1.95:1.28,0));const desired=target.clone().add(new T.Vector3(Math.sin(this.yaw)*this.distance*Math.cos(this.pitch),Math.sin(this.pitch)*this.distance,Math.cos(this.yaw)*this.distance*Math.cos(this.pitch)));const inside=!['future','temple'].includes(this.current);desired.x=clamp(desired.x,inside?-4.9:-8.6,inside?4.9:8.6);desired.z=clamp(desired.z,inside?-5.1:this.current==='future'?-6.8:-3.9,inside?5.35:this.current==='future'?9.2:10.6);const w=this.worlds[this.current];for(const c of w.colliders){if(Math.abs(desired.x-c.x)<c.w/2+.15&&Math.abs(desired.z-c.z)<c.d/2+.15)desired.lerp(target,.38)}if(immediate)this.camera.position.copy(desired);else this.camera.position.lerp(desired,.14);this.camera.lookAt(target)}
 nearest(){let nearest=null,best=Infinity;for(const h of this.worlds[this.current].hotspots){const d=Math.hypot(h.pos.x-this.player.position.x,h.pos.z-this.player.position.z);if(d<h.radius&&d<best){nearest=h;best=d}}return nearest}
 faceNPC(id){const obj=this.worlds[this.current].npcs[id];if(obj)obj.lookAt(this.player.position.x,0,this.player.position.z)}
 render(onFrame){this.renderer.setAnimationLoop(()=>{const dt=Math.min(this.clock.getDelta(),.045);if(document.hidden)return;this.elapsed+=dt;for(const t of this.npcTimes)t.value=this.elapsed;if(this.player){const moving=this.move(dt);this.mixer.update(dt);this.phase.update(dt);if(this.skyIntro){this.camera.position.set(0,4.5,9);this.camera.lookAt(6,9,-20);}else if(this.playing)this.updateCamera();else{const t=this.elapsed*.012;this.camera.position.set(9+Math.sin(t)*1.3,6.1,12);this.camera.lookAt(-.5,4.6,-5.5)}if(moving&&this.current==='temple'&&this.water.visible&&Math.abs(this.player.position.x)<4.6&&this.player.position.z> -2.6&&this.player.position.z<5.4&&this.elapsed-(this.lastRipple||0)>.3){const r=this.ripples.find(r=>r.life>1);if(r){r.life=0;r.mesh.position.x=this.player.position.x;r.mesh.position.z=this.player.position.z;this.lastRipple=this.elapsed}}for(const r of this.ripples){r.life+=dt;const s=.5+r.life*2;r.mesh.scale.setScalar(s);r.mesh.material.opacity=this.water.visible?Math.max(0,.45*(1-r.life)):0;}this.water.material.uniforms.time.value=this.elapsed;this.shadowLayer.rotation.z=Math.sin(this.elapsed*.5)*.006;for(const r of this.rotators)r.rotation.y+=dt*.25;onFrame(dt);}this.renderer.render(this.worlds[this.current].scene,this.camera)});}
 screenPoint(pos){const v=pos.clone().project(this.camera);return{x:(v.x*.5+.5)*innerWidth,y:(-.5*v.y+.5)*innerHeight,visible:v.z<1&&v.z> -1&&Math.abs(v.x)<.96&&Math.abs(v.y)<.95}}
}
