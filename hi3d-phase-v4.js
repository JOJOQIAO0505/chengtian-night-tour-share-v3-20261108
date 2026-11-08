import * as T from 'three';

// Distances are world metres; all moving characters use this one movement style.
export const PHASE = Object.freeze({distance:1.7, speed:8.5, cooldown:.12, spacing:.28, life:.48, pool:14});

function hologram(clock) {
 return new T.ShaderMaterial({
  transparent:true, depthWrite:false, side:T.DoubleSide, blending:T.AdditiveBlending, toneMapped:false,
  uniforms:{time:clock, opacity:{value:0}, dissolve:{value:0}},
  vertexShader:`
   varying vec3 viewNormal, viewDirection, worldPoint;
   void main(){
    vec4 mv=modelViewMatrix*vec4(position,1.);
    viewNormal=normalize(normalMatrix*normal); viewDirection=-mv.xyz;
    worldPoint=(modelMatrix*vec4(position,1.)).xyz;
    gl_Position=projectionMatrix*mv;
   }`,
  fragmentShader:`
   uniform float time, opacity, dissolve;
   varying vec3 viewNormal, viewDirection, worldPoint;
   float noise(vec3 p){return fract(sin(dot(floor(p*48.),vec3(12.9898,78.233,39.425)))*43758.5453);}
   void main(){
    if(noise(worldPoint)<dissolve)discard;
    float rim=pow(1.-abs(dot(normalize(viewNormal),normalize(viewDirection))),1.6);
    float scan=.5+.5*sin(worldPoint.y*155.-time*28.);
    float band=pow(.5+.5*sin(worldPoint.y*13.-time*8.),14.);
    vec3 color=mix(vec3(.10,.48,.9),vec3(.59,1.,1.),rim*.8+band*.2);
    gl_FragColor=vec4(color*1.45,opacity*(.16+rim*.68+scan*.13+band*.22));
   }`
 });
}

export class PhaseEffect {
 constructor(player, visual) {
  this.player=player; this.visual=visual; this.time={value:0}; this.next=0; this.totalSpawned=0;
  this.lastPoint=null; this.trailDistance=0; this.arrival=0; this.active=false;
  // Bake the actual neutral character once. Ghosts share geometry, not 14 skeletons.
  visual.updateWorldMatrix(true,true);
  const inverse=new T.Matrix4().copy(player.matrixWorld).invert();
  const pieces=[]; const vertex=new T.Vector3();
  visual.traverse(o=>{
   if(!o.isMesh)return;
   if(o.isSkinnedMesh)o.skeleton.update();
   const geometry=o.geometry.clone(); const count=geometry.attributes.position.count;
   const positions=new Float32Array(count*3);
   for(let i=0;i<count;i++){o.getVertexPosition(i,vertex);vertex.toArray(positions,i*3);}
   geometry.setAttribute('position',new T.BufferAttribute(positions,3));
   geometry.deleteAttribute('skinIndex'); geometry.deleteAttribute('skinWeight'); geometry.morphAttributes={};
   geometry.applyMatrix4(new T.Matrix4().multiplyMatrices(inverse,o.matrixWorld));
   geometry.computeVertexNormals(); geometry.computeBoundingSphere(); pieces.push(geometry);
  });
  const make=(name)=>{
   const group=new T.Group(); group.name=name; group.visible=false;
   const material=hologram(this.time);
   for(const geometry of pieces){const mesh=new T.Mesh(geometry,material);mesh.renderOrder=3;group.add(mesh);}
   return {group,material,life:1};
  };
  this.core=make('虚影_移动主体'); player.add(this.core.group);
  this.ghosts=Array.from({length:PHASE.pool},(_,i)=>make('虚影_残像_'+i));
  this.rings=Array.from({length:6},(_,i)=>{
   const material=new T.MeshBasicMaterial({color:0x81edff,transparent:true,opacity:0,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false,side:T.DoubleSide});
   const mesh=new T.Mesh(new T.RingGeometry(.36,.395,64),material);
   mesh.name='虚影_落点能量环_'+i;mesh.rotation.x=-Math.PI/2;mesh.visible=false;mesh.renderOrder=2;
   return {mesh,life:1};
  });
  // Short world-space light threads emphasize A -> B without covering the scene.
  const threads=new Float32Array(24*6);
  this.threadPositions=new T.BufferAttribute(threads,3).setUsage(T.DynamicDrawUsage);
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',this.threadPositions);
  this.threads=new T.LineSegments(geometry,new T.LineBasicMaterial({color:0x5ccbe9,transparent:true,opacity:0,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false}));
  this.threads.name='虚影_速度光丝';this.threads.visible=false;this.threads.frustumCulled=false;
  this.originalMaterials=[];
  visual.traverse(o=>{
   if(!o.isMesh)return;
   for(const m of (Array.isArray(o.material)?o.material:[o.material])){
    if(!this.originalMaterials.some(item=>item.material===m))this.originalMaterials.push({material:m,transparent:m.transparent,opacity:m.opacity});
   }
  });
 }
 solid(opacity=1){
  this.visual.visible=opacity>0;
  for(const item of this.originalMaterials){
   const transparent=opacity<1||item.transparent;
   if(item.material.transparent!==transparent){item.material.transparent=transparent;item.material.needsUpdate=true;}
   item.material.opacity=item.opacity*opacity;
  }
 }
 ring(scene,position){
  const r=this.rings.find(r=>r.life>=1)||this.rings[0];r.life=0;
  r.mesh.position.set(position.x,.075,position.z);r.mesh.scale.setScalar(.65);r.mesh.visible=true;scene.add(r.mesh);
 }
 ghost(scene,position,quaternion){
  const g=this.ghosts[this.next++%this.ghosts.length];g.life=0;
  g.group.position.copy(position);g.group.quaternion.copy(quaternion);
  g.group.visible=true;g.material.uniforms.opacity.value=.70;g.material.uniforms.dissolve.value=0;
  scene.add(g.group);this.totalSpawned++;
 }
 depart(scene){
  this.active=true;this.arrival=0;this.core.group.visible=true;this.solid(0);
  this.core.material.uniforms.opacity.value=.90;this.core.material.uniforms.dissolve.value=0;
  this.lastPoint=this.player.position.clone();this.trailDistance=0;
  this.ghost(scene,this.player.position,this.player.quaternion);this.ring(scene,this.player.position);
  scene.add(this.threads);this.threads.visible=true;
 }
 trace(scene){
  const from=this.lastPoint,to=this.player.position;const length=from.distanceTo(to);
  if(length>0){
   let distance=PHASE.spacing-this.trailDistance;
   while(distance<=length){this.ghost(scene,from.clone().lerp(to,distance/length),this.player.quaternion);distance+=PHASE.spacing;}
   this.trailDistance=(this.trailDistance+length)%PHASE.spacing;
   this.lastPoint.copy(to);
  }
  const forward=new T.Vector3(0,0,1).applyQuaternion(this.player.quaternion);
  const right=new T.Vector3(forward.z,0,-forward.x);const array=this.threadPositions.array;
  for(let i=0;i<24;i++){
   const side=Math.sin(i*19.1)*.33,height=.15+(i%9)*.18;
   const length=.35+(i%5)*.12,offset=.08+(i%4)*.11;
   for(let end=0;end<2;end++){
    const back=offset+length*end,index=i*6+end*3;
    array[index]=to.x+right.x*side-forward.x*back;
    array[index+1]=height;
    array[index+2]=to.z+right.z*side-forward.z*back;
   }
  }
  this.threadPositions.needsUpdate=true;this.threads.material.opacity=.42;
 }
 land(scene){
  this.active=false;this.arrival=.14;this.ring(scene,this.player.position);
  this.threads.visible=false;this.lastPoint=null;
 }
 update(dt){
  this.time.value+=dt;
  if(this.arrival>0){
   this.arrival=Math.max(0,this.arrival-dt);
   const t=1-this.arrival/.14;this.solid(T.MathUtils.smoothstep(t,0,1));
   this.core.material.uniforms.opacity.value=.8*(1-t);
   if(!this.arrival){this.core.group.visible=false;this.solid(1);}
  }
  for(const g of this.ghosts){
   if(!g.group.visible)continue;
   g.life+=dt/PHASE.life;const fade=Math.max(0,1-g.life);
   g.material.uniforms.opacity.value=.70*fade*fade;
   g.material.uniforms.dissolve.value=Math.max(0,(g.life-.4)/.6);
   if(g.life>=1)g.group.visible=false;
  }
  for(const r of this.rings){
   if(!r.mesh.visible)continue;
   r.life+=dt/.38;r.mesh.scale.setScalar(.65+r.life*1.5);
   r.mesh.material.opacity=Math.max(0,.55*(1-r.life)**2);
   if(r.life>=1)r.mesh.visible=false;
  }
 }
 clear(){
  this.active=false;this.arrival=0;this.lastPoint=null;this.trailDistance=0;
  this.core.group.visible=false;this.threads.visible=false;this.threads.removeFromParent();this.solid(1);
  for(const g of this.ghosts){g.group.visible=false;g.group.removeFromParent();g.life=1;}
  for(const r of this.rings){r.mesh.visible=false;r.mesh.removeFromParent();r.life=1;}
 }
 inspect(){return {active:this.active,ghosts:this.ghosts.filter(g=>g.group.visible).length,totalSpawned:this.totalSpawned,solidVisible:this.visual.visible,arrival:this.arrival};}
}
