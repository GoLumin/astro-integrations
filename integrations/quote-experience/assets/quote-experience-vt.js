
(() => {
  "use strict";
  const RM = matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---- WebGL raymarched container — MI-BOX daylight livery (VT variant) ---- */
  const FRAG = `
  precision highp float;
  uniform vec2 u_res; uniform float u_time; uniform vec3 u_size; uniform vec2 u_mouse; uniform float u_amber; uniform sampler2D u_logo;
  #define I 100
  mat3 rotY(float a){float c=cos(a),s=sin(a);return mat3(c,0.,-s,0.,1.,0.,s,0.,c);}
  float sdBox(vec3 p, vec3 b, float r){vec3 q=abs(p)-b+vec3(r);return length(max(q,0.0))+min(max(q.x,max(q.y,q.z)),0.0)-r;}
  float mapBox(vec3 p){return sdBox(p,u_size,0.06);}
  float map(vec3 p){float g=p.y+u_size.y+0.002;return min(g, mapBox(p));}
  vec3 nrm(vec3 p){vec2 e=vec2(0.0016,0.);return normalize(vec3(map(p+e.xyy)-map(p-e.xyy),map(p+e.yxy)-map(p-e.yxy),map(p+e.yyx)-map(p-e.yyx)));}
  float shadow(vec3 ro, vec3 rd){float r=1.0,t=0.03;for(int i=0;i<26;i++){float h=map(ro+rd*t);if(h<0.001)return 0.0;r=min(r,11.0*h/t);t+=clamp(h,0.03,0.5);if(t>16.0)break;}return clamp(r,0.0,1.0);}
  float ao(vec3 p, vec3 n){float o=0.,s=1.;for(int i=0;i<5;i++){float h=0.03+0.14*float(i);o+=(h-map(p+n*h))*s;s*=0.72;}return clamp(1.0-1.6*o,0.0,1.0);}
  vec3 sky(vec3 rd){float t=clamp(rd.y*0.5+0.5,0.0,1.0);vec3 c=mix(vec3(0.97,0.965,0.95),vec3(0.72,0.82,0.92),pow(t,0.8));c+=vec3(1.0,0.94,0.72)*pow(max(1.0-abs(rd.y),0.0),8.0)*0.05;return c;}
  vec3 mat(vec3 p, vec3 n){
    // MI-BOX livery: smooth white body, logo decal on the long sides,
    // amber roll-up door on the end face
    vec3 base=vec3(0.93,0.925,0.915);
    base*= (abs(n.y)<0.6)? 0.975 : 0.99;
    // logo on both length faces (|n.z|), aspect 3.5:1 like /logo.png
    float side=step(0.6,abs(n.z));
    float W=min(u_size.y*0.72*3.5, u_size.x*1.72);
    float H=W/3.5;
    vec2 uv=vec2(p.x/W+0.5, (p.y-u_size.y*0.10)/H+0.5);
    uv.x=mix(uv.x, 1.0-uv.x, step(0.0,n.z));           // unmirror per face (screen-right = -x here)
    float inuv=step(0.0,uv.x)*step(uv.x,1.0)*step(0.0,uv.y)*step(uv.y,1.0);
    vec4 logo=texture2D(u_logo, clamp(uv,0.0,1.0));
    base=mix(base, logo.rgb, logo.a*side*inuv);
    // yellow roll-up door on the +x end: horizontal slats inside a white frame
    float end=step(0.6,n.x);
    float doorz=step(abs(p.z),u_size.z*0.84);
    float doory=step(abs(p.y+u_size.y*0.05),u_size.y*0.86);
    float door=end*doorz*doory;
    float slat=0.90+0.10*cos(p.y*46.0);
    base=mix(base, vec3(0.99,0.72,0.10)*slat, door);
    return base;
  }
  void main(){
    vec2 uv=(gl_FragCoord.xy-0.5*u_res)/u_res.y;
    float ry=u_time*0.14 + u_mouse.x*0.5;
    float pit=0.34 - u_mouse.y*0.12;
    vec3 ro=vec3(0.0,0.0,8.8);
    ro=rotY(ry)*ro; ro.y=3.2*sin(pit);
    vec3 ta=vec3(0.0,-0.2,0.0);
    vec3 f=normalize(ta-ro), rgt=normalize(cross(vec3(0,1,0),f)), up=cross(f,rgt);
    vec3 rd=normalize(uv.x*rgt+uv.y*up+1.5*f);
    float t=0.0; float hit=-1.0;
    for(int i=0;i<I;i++){vec3 p=ro+rd*t;float d=map(p);if(d<0.001){hit=t;break;}t+=d;if(t>40.0)break;}
    vec3 col=sky(rd);
    if(hit>0.0){
      vec3 p=ro+rd*hit; vec3 n=nrm(p);
      bool isBox = mapBox(p) < 0.02;
      vec3 alb = isBox ? mat(p,n) : vec3(0.80,0.79,0.77);
      vec3 L=normalize(vec3(-0.5,0.82,0.42));
      float sh=shadow(p+n*0.02,L);
      float dif=max(dot(n,L),0.0)*sh;
      float occ=ao(p,n);
      vec3 lit = alb*(vec3(0.52,0.55,0.60)*occ + dif*vec3(1.05,1.0,0.92));
      // soft warm bounce from behind (was the amber rim)
      vec3 A=normalize(vec3(0.62,0.28,-0.7));
      lit += alb*max(dot(n,A),0.0)*vec3(1.0,0.92,0.70)*0.22*u_amber;
      vec3 h=normalize(L-rd);
      lit += pow(max(dot(n,h),0.0),46.0)*vec3(1.0,0.95,0.8)*sh*(isBox?0.6:0.12);
      float fr=pow(1.0-max(dot(n,-rd),0.0),3.5);
      lit += fr*vec3(0.80,0.87,0.95)*0.28;
      float fog=1.0-exp(-hit*hit*0.0016);
      col=mix(lit, sky(rd)*0.85, fog);
    }
    col += vec3(1.0,0.98,0.92)*pow(max(1.0-length(uv+vec2(0.35,0.1)),0.0),2.4)*0.05;
    float g=fract(sin(dot(gl_FragCoord.xy,vec2(12.99,78.23)))*43758.5)-0.5;
    col+=g*0.012;
    gl_FragColor=vec4(clamp(col,0.0,1.0),1.0);
  }`;
  const VERT = "attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}";

  function makeRenderer(canvas, opts){
    if(!canvas) return null;
    const gl = canvas.getContext("webgl", {antialias:false, alpha:false, powerPreference:"high-performance"});
    if(!gl) return null;
    const sh=(t,s)=>{const o=gl.createShader(t);gl.shaderSource(o,s);gl.compileShader(o);
      if(!gl.getShaderParameter(o,gl.COMPILE_STATUS)) console.warn(gl.getShaderInfoLog(o)); return o;};
    const prog=gl.createProgram();
    gl.attachShader(prog,sh(gl.VERTEX_SHADER,VERT));
    gl.attachShader(prog,sh(gl.FRAGMENT_SHADER,FRAG));
    gl.linkProgram(prog);
    if(!gl.getProgramParameter(prog,gl.LINK_STATUS)){console.warn(gl.getProgramInfoLog(prog));return null;}
    gl.useProgram(prog);
    const buf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buf);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
    const loc=gl.getAttribLocation(prog,"p");gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);
    const U=n=>gl.getUniformLocation(prog,n);
    // MI-BOX logo decal (NPOT: clamp + linear, no mips)
    const tex=gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D,tex);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([0,0,0,0]));
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    const logoImg=new Image();
    logoImg.onload=()=>{gl.bindTexture(gl.TEXTURE_2D,tex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,logoImg);};
    logoImg.src=opts.logo||"/logo.png";
    gl.uniform1i(U("u_logo"),0);
    const u={res:U("u_res"),time:U("u_time"),size:U("u_size"),mouse:U("u_mouse"),amber:U("u_amber")};
    const state={size:opts.size.slice(),tsize:opts.size.slice(),mouse:[0,0],tmouse:[0,0],amber:opts.amber||1,vis:true,t0:performance.now()};
    const dpr=()=>Math.min(devicePixelRatio||1, 1.9);
    function resize(){const r=canvas.getBoundingClientRect();const w=Math.max(1,r.width*dpr()),h=Math.max(1,r.height*dpr());
      if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;gl.viewport(0,0,w,h);}}
    function frame(now){
      if(!state.vis){requestAnimationFrame(frame);return;}
      resize();
      for(let i=0;i<3;i++) state.size[i]+=(state.tsize[i]-state.size[i])*0.12;
      for(let i=0;i<2;i++) state.mouse[i]+=(state.tmouse[i]-state.mouse[i])*0.06;
      gl.uniform2f(u.res,canvas.width,canvas.height);
      gl.uniform1f(u.time, RM?1.4:(now-state.t0)/1000);
      gl.uniform3f(u.size,state.size[0],state.size[1],state.size[2]);
      gl.uniform2f(u.mouse,state.mouse[0],state.mouse[1]);
      gl.uniform1f(u.amber,state.amber);
      gl.drawArrays(gl.TRIANGLES,0,3);
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
    new IntersectionObserver(es=>{state.vis=es[0].isIntersecting;},{threshold:0.02}).observe(canvas);
    return { setSize:(s)=>state.tsize=s.slice(), setMouse:(x,y)=>{state.tmouse=[x,y];} };
  }

  const sizeFor = ft => [ (ft/8)*1.25, 1.25, 1.25 ];

  const boxR = makeRenderer(document.getElementById("gl-box"), {size: sizeFor(16), amber:0.9});

  /* ---------------- pricing model ---------------- */
  // Monthly rent per size comes from the Quoting API (injected as window.__QX_PRICES);
  // falls back to these defaults only if the API was unreachable.
  const API_PRICES = (typeof window!=="undefined" && window.__QX_PRICES) || {};
  const SIZES = {8:{price:API_PRICES[8]??159,cuft:512,dims:"8×8×8",label:"8-foot",holds:"a studio / garage",tag:"MB-08"},
                 16:{price:API_PRICES[16]??239,cuft:1024,dims:"16×8×8",label:"16-foot",holds:"a 3-bed home",tag:"MB-16"},
                 20:{price:API_PRICES[20]??359,cuft:1280,dims:"20×8×8",label:"20-foot",holds:"a 4–5 bed move",tag:"MB-20"}};
  // Relocation & storage are quoted per job — show "call for pricing", not a computed monthly.
  const CALL_SVCS = new Set(["move","indoor","outdoor"]);
  const SVC = {
    keep:   {name:"Keep It · on-site", sku:"KEEP", surcharge:0, sname:null, legs:2, legLabel:"Delivery + final pickup"},
    move:   {name:"Move It · relocation", sku:"MOVE", surcharge:0, sname:null, legs:3, legLabel:"Delivery + relocation + pickup"},
    indoor: {name:"Store It · indoor facility", sku:"IN", surcharge:60, sname:"Indoor climate storage", legs:2, legLabel:"Delivery to + return from facility"},
    outdoor:{name:"Store It · outdoor lot", sku:"OUT", surcharge:20, sname:"Outdoor secure storage", legs:2, legLabel:"Delivery to + return from lot"}
  };
  const LEG = 85;
  // One-time transit legs per service — each shown as its own "starting at" line item.
  const TRANSIT = {
    keep:    [["Initial Delivery","empty container to you"],["Final Pick Up","empty container back"]],
    move:    [["Initial Delivery","to your property"],["Relocation Delivery","to the new address"],["Final Pick Up","empty container back"]],
    indoor:  [["Initial Delivery","to your property"],["Initial Pick Up","loaded, to the facility"],["Final Delivery","facility back to you"],["Final Pick Up","empty container back"]],
    outdoor: [["Initial Delivery","to your property"],["Initial Pick Up","loaded, to the lot"],["Final Delivery","lot back to you"],["Final Pick Up","empty container back"]],
  };
  const money = n => "$"+n.toLocaleString("en-US");
  const $ = id => document.getElementById(id);
  const _cs=document.querySelector('input[name="size"]:checked'), _cv=document.querySelector('input[name="svc"]:checked');
  const state = {size:_cs?+_cs.value:16, svc:_cv?_cv.value:"keep", waiver:true};

  let tweenId=0;
  function tween(el, to){
    const from=parseInt(el.textContent.replace(/[^0-9]/g,""))||0;
    if(RM){el.textContent=to.toLocaleString("en-US");return;}
    const id=++tweenId, t0=performance.now(), dur=520;
    (function step(now){ if(id!==tweenId) return;
      const k=Math.min(1,(now-t0)/dur), e=1-Math.pow(1-k,3);
      el.textContent=Math.round(from+(to-from)*e).toLocaleString("en-US");
      if(k<1) requestAnimationFrame(step);
    })(performance.now());
  }

  const perEl = $("total").parentElement.parentElement.querySelector(".per");
  const qhLab = document.querySelector(".qx .qh .lab");
  const transitSec = document.querySelector(".qx .transit-sec");

  function render(){
    const s=SIZES[state.size], v=SVC[state.svc];
    $("svc-label").textContent=v.name;
    $("sku").textContent=`${s.tag} · ${v.sku}`;
    $("capacity").textContent=`holds ≈ ${s.holds}`;
    $("tag-h").textContent="8'";
    $("tag-l").textContent=state.size+"'";
    $("tag-v").textContent=s.cuft.toLocaleString()+" ft³";
    if(boxR) boxR.setSize(sizeFor(state.size));

    // Relocation & storage: quoted per job — no computed monthly figure.
    if(CALL_SVCS.has(state.svc)){
      if(qhLab) qhLab.textContent="Custom quote";
      $("lines").innerHTML=`<div class="li"><div class="name">${s.label} container<small>${s.dims} · ${s.cuft.toLocaleString()} ft³</small></div><div class="amt">Included</div></div>`+
        `<div class="li"><div class="name">${v.name.split(" · ")[0]}<small>priced per job — we confirm your all-in rate by phone</small></div><div class="amt">Custom</div></div>`;
      if(transitSec) transitSec.style.display="none";
      $("total").textContent="Call";
      if(perEl) perEl.textContent="for pricing";
      return;
    }

    // On-site (Keep It): recurring monthly rent from the API catalog.
    if(qhLab) qhLab.textContent="Monthly recurring";
    if(transitSec) transitSec.style.display="";
    if(perEl) perEl.textContent="/mo";
    const monthly = s.price + (state.waiver?15:0);
    const rows=[];
    rows.push(`<div class="li"><div class="name">${s.label} container<small>${s.dims} · ${s.cuft.toLocaleString()} ft³</small></div><div class="amt">${money(s.price)}<em>/mo</em></div></div>`);
    if(state.waiver) rows.push(`<div class="li"><div class="name">Container Damage Waiver<small>optional protection</small></div><div class="amt">$15<em>/mo</em></div></div>`);
    $("lines").innerHTML=rows.join("");
    const tr=TRANSIT[state.svc]||[];
    $("transit-lines").innerHTML=tr.map(([name,note])=>`<div class="li muted"><div class="name">${name}<small>${note}</small></div><div class="amt">Starting at ${money(LEG)}</div></div>`).join("");
    tween($("total"), monthly);
  }

  document.querySelectorAll('input[name="size"]').forEach(i=>i.addEventListener("change",e=>{state.size=+e.target.value;render();}));
  document.querySelectorAll('input[name="svc"]').forEach(i=>i.addEventListener("change",e=>{state.svc=e.target.value;render();}));
  $("waiver").addEventListener("click",()=>{state.waiver=!state.waiver;$("waiver").setAttribute("aria-pressed",String(state.waiver));render();});

  document.querySelectorAll("[data-count]").forEach(el=>{
    const to=+el.dataset.count, suf=el.dataset.suffix||"";
    if(RM){el.textContent=to.toLocaleString()+suf;return;}
    const io=new IntersectionObserver(es=>{ if(!es[0].isIntersecting) return; io.disconnect();
      const t0=performance.now(), dur=1200;
      (function s(n){const k=Math.min(1,(n-t0)/dur),e=1-Math.pow(1-k,3);
        el.textContent=Math.round(to*e).toLocaleString()+suf; if(k<1)requestAnimationFrame(s);})(performance.now());
    },{threshold:0.6});
    io.observe(el);
  });

  render();
})();
