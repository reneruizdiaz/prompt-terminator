(function(){
  var KEY="pt_code";
  function getCode(){ try{ return localStorage.getItem(KEY)||""; }catch(_){ return ""; } }
  function setCode(v){ try{ localStorage.setItem(KEY,v); }catch(_){} }
  var waiting=null;
  function askCode(msg){
    var g=document.getElementById("codeGate"); g.style.display="flex";
    document.getElementById("codeErr").textContent=msg||"";
    var inp=document.getElementById("codeInput"); inp.value=""; setTimeout(function(){ inp.focus(); },50);
    return new Promise(function(res){ waiting=res; });
  }
  function submitCode(){
    var v=document.getElementById("codeInput").value.trim(); if(!v) return;
    setCode(v); document.getElementById("codeGate").style.display="none";
    if(waiting){ var w=waiting; waiting=null; w(); }
  }
  document.getElementById("codeOk").onclick=submitCode;
  document.getElementById("codeInput").addEventListener("keydown",function(e){ if(e.key==="Enter") submitCode(); });
  async function call(prompt,json,signal,retry){
    var r;
    try{
      r=await fetch("/api/claude",{method:"POST",signal:signal,headers:{"Content-Type":"application/json","x-access-code":getCode()},body:JSON.stringify({prompt:prompt,json:json})});
    }catch(e){ if(e&&e.name==="AbortError"){ var x=new Error("aborted"); x.code="aborted"; throw x; } throw e; }
    var d=await r.json().catch(function(){ return {}; });
    if(r.status===401){
      if(retry<3){ await askCode(retry?"C\u00f3digo incorrecto. Intenta de nuevo.":""); return call(prompt,json,signal,retry+1); }
      throw new Error("C\u00f3digo de acceso inv\u00e1lido");
    }
    if(r.status===429){ var y=new Error("rate"); y.code="rate_limited"; throw y; }
    if(!r.ok) throw new Error(d.error||("Error "+r.status));
    return d;
  }
  var sample=async function(prompt,opts){ opts=opts||{}; var d=await call(prompt,false,opts.signal,0); return {text:d.text}; };
  sample.json=async function(prompt,opts){ opts=opts||{}; var d=await call(prompt,true,opts.signal,0); return d.data; };
  window.PT_SAMPLE=sample;
})();

(function(){
"use strict";
const $ = (id) => document.getElementById(id);

const T = {
  en: { unit:"UNIT 5.0", sub:"Describe what you need. I interrogate you, then terminate it into the perfect prompt.",
    mission:"MISSION", rulesLink:"View and edit the rules for this mode", go:"INTERROGATE", direct:"Skip questions, terminate now", interrogation:"INTERROGATION",
    terminate:"TERMINATE", back:"Edit mission", acquired:"PROMPT ACQUIRED", before:"BEFORE", after:"AFTER", execute:"EXECUTE", copy:"COPY",
    save:"SAVE TO ARSENAL", newMission:"New mission", output:"OUTPUT", stop:"STOP", copyOut:"Copy output", refine:"REFINE",
    refineHint:"Say what should change. The prompt is rebuilt as a new version.", reterminate:"RE-TERMINATE", arsenal:"ARSENAL",
    rulesHint:"These rules are added to every prompt built in this mode. Write your own: tone, format, things to always or never do.", saveRules:"SAVE RULES", reset:"Restore default",
    placeholder:"Example: plan a 5-day trip to Rio for two, mid budget, with good food and some beach time.",
    refinePh:"Example: shorter, more formal, add a deadline.", search:"Search the arsenal", answerPh:"Your answer, or tap an option",
    scanning:"SCANNING TARGET", terminating:"TERMINATING", reterminating:"RE-TERMINATING",
    copied:"COPIED", saved:"SAVED TO ARSENAL", rulesSaved:"RULES SAVED", deleted:"DELETED", emptyArsenal:"Nothing saved yet. Terminate a prompt and save it here.",
    del:"Delete", chars:"chars", target:"TARGET", noAnswer:"(no answer)",
    profiles:{ general:"General", trabajo:"Work", creativo:"Creative", estudio:"Study" } },
  es: { unit:"UNIDAD 5.0", sub:"Describe lo que necesitas. Te interrogo y lo convierto en el prompt perfecto.",
    mission:"MISI\u00d3N", rulesLink:"Ver y editar las reglas de este modo", go:"INTERROGAR", direct:"Saltar preguntas, terminar ya", interrogation:"INTERROGATORIO",
    terminate:"TERMINAR", back:"Editar misi\u00f3n", acquired:"PROMPT ADQUIRIDO", before:"ANTES", after:"DESPU\u00c9S", execute:"EJECUTAR", copy:"COPIAR",
    save:"GUARDAR EN ARSENAL", newMission:"Nueva misi\u00f3n", output:"RESULTADO", stop:"DETENER", copyOut:"Copiar resultado", refine:"REFINAR",
    refineHint:"Di qu\u00e9 debe cambiar. El prompt se reconstruye como una nueva versi\u00f3n.", reterminate:"RE-TERMINAR", arsenal:"ARSENAL",
    rulesHint:"Estas reglas se agregan a cada prompt creado en este modo. Escribe las tuyas: tono, formato, cosas que siempre o nunca debe hacer.", saveRules:"GUARDAR REGLAS", reset:"Restaurar original",
    placeholder:"Ejemplo: planifica un viaje de 5 d\u00edas a R\u00edo para dos personas, presupuesto medio, con buena comida y algo de playa.",
    refinePh:"Ejemplo: m\u00e1s corto, m\u00e1s formal, agrega un plazo.", search:"Buscar en el arsenal", answerPh:"Tu respuesta, o toca una opci\u00f3n",
    scanning:"ESCANEANDO OBJETIVO", terminating:"TERMINANDO", reterminating:"RE-TERMINANDO",
    copied:"COPIADO", saved:"GUARDADO EN ARSENAL", rulesSaved:"REGLAS GUARDADAS", deleted:"ELIMINADO", emptyArsenal:"Todav\u00eda no hay nada guardado. Termina un prompt y gu\u00e1rdalo aqu\u00ed.",
    del:"Eliminar", chars:"caract.", target:"OBJETIVO", noAnswer:"(sin respuesta)",
    profiles:{ general:"General", trabajo:"Trabajo", creativo:"Creativo", estudio:"Estudio" } }
};

const DEFAULT_RULES = {
  general: "",
  trabajo: "- Tono profesional, claro y directo, sin relleno.\n- Si es un email: asunto concreto, saludo breve, pedidos numerados cuando hay varios, y un cierre con el siguiente paso.\n- Prioriza lo accionable: decisiones, responsables y plazos.",
  creativo: "- Voz original; evita clich\u00e9s y frases hechas.\n- Usa im\u00e1genes concretas y detalles sensoriales.\n- Ofrece dos o tres variaciones con enfoques distintos.",
  estudio: "- Explica paso a paso, de lo simple a lo complejo.\n- Incluye ejemplos concretos y un breve resumen al final.\n- Se\u00f1ala qu\u00e9 datos conviene verificar en fuentes confiables."
};
const PROFILES = ["general","trabajo","creativo","estudio"];

const S = { lang:"es", profile:"general", questions:[], answers:{}, read:"", versions:[], vIdx:0, lastOutput:"", busy:false, arsenal:[], rules:Object.assign({},DEFAULT_RULES), ctl:null };
const sample = window.PT_SAMPLE;
try{ const p=JSON.parse(localStorage.getItem("ptn_prefs")||"{}"); if(p.lang) S.lang=p.lang; if(p.profile && PROFILES.includes(p.profile)) S.profile=p.profile; }catch(_){}
const savePrefs=()=>{ try{ localStorage.setItem("ptn_prefs", JSON.stringify({lang:S.lang, profile:S.profile})); }catch(_){} };
const t=(k)=>T[S.lang][k];

const score = {
  on:false, ctx:null, master:null, filt:null, intensity:.12, target:.12, step:0, next:0, timer:null, noise:null,
  start(){
    const AC=window.AudioContext||window.webkitAudioContext; if(!AC) return false;
    if(!this.ctx){
      const c=this.ctx=new AC();
      this.master=c.createGain(); this.master.gain.value=0; this.master.connect(c.destination);
      const comp=c.createDynamicsCompressor(); comp.connect(this.master);
      this.bus=comp;
      this.filt=c.createBiquadFilter(); this.filt.type="lowpass"; this.filt.frequency.value=200; this.filt.Q.value=7;
      const dg=c.createGain(); dg.gain.value=.05; this.filt.connect(dg); dg.connect(comp);
      [41.2,41.6,82.4].forEach((f,i)=>{ const o=c.createOscillator(); o.type="sawtooth"; o.frequency.value=f; const g=c.createGain(); g.gain.value=i===2?.4:1; o.connect(g); g.connect(this.filt); o.start(); });
      const lfo=c.createOscillator(); lfo.frequency.value=.06; const lg=c.createGain(); lg.gain.value=70; lfo.connect(lg); lg.connect(this.filt.frequency); lfo.start();
      const sub=c.createOscillator(); sub.type="sine"; sub.frequency.value=41.2; const sg=c.createGain(); sg.gain.value=.07; sub.connect(sg); sg.connect(comp); sub.start();
      const len=c.sampleRate*.5, buf=c.createBuffer(1,len,c.sampleRate), d=buf.getChannelData(0);
      for(let i=0;i<len;i++) d[i]=Math.random()*2-1; this.noise=buf;
    }
    this.ctx.resume();
    this.master.gain.cancelScheduledValues(this.ctx.currentTime);
    this.master.gain.setTargetAtTime(.9,this.ctx.currentTime,.6);
    this.next=this.ctx.currentTime+.1; this.step=0;
    clearInterval(this.timer); this.timer=setInterval(()=>this.tick(),25);
    this.on=true; return true;
  },
  stop(){ if(!this.ctx) return; this.on=false; clearInterval(this.timer);
    this.master.gain.setTargetAtTime(0,this.ctx.currentTime,.25); setTimeout(()=>{ if(!this.on) this.ctx.suspend(); },900); },
  set(x){ this.target=x; },
  tick(){
    const c=this.ctx; this.intensity+= (this.target-this.intensity)*.03;
    const I=this.intensity, bpm=62+52*I, stepDur=60/bpm/4;
    this.filt.frequency.setTargetAtTime(160+900*I, c.currentTime, .4);
    while(this.next < c.currentTime+.12){
      const s=this.step%16, tm=this.next;
      if(s===0||s===8) this.thump(tm, 1);
      if(s===10 && I>.4) this.thump(tm,.5);
      if(s===4||s===12) this.metal(tm,.7,2600);
      if(s===14) this.metal(tm,.25,3400);
      if(I>.55 && s%2===1) this.metal(tm,.12+.2*(I-.55),6000);
      this.next+=stepDur; this.step++;
    }
  },
  thump(tm,v){ const c=this.ctx,o=c.createOscillator(),g=c.createGain(); o.type="sine";
    o.frequency.setValueAtTime(140,tm); o.frequency.exponentialRampToValueAtTime(38,tm+.16);
    g.gain.setValueAtTime(.32*v,tm); g.gain.exponentialRampToValueAtTime(.001,tm+.3); o.connect(g); g.connect(this.bus); o.start(tm); o.stop(tm+.32); },
  metal(tm,v,f){ const c=this.ctx,s=c.createBufferSource(),bp=c.createBiquadFilter(),g=c.createGain(); s.buffer=this.noise;
    bp.type="bandpass"; bp.frequency.value=f; bp.Q.value=14; g.gain.setValueAtTime(.5*v,tm); g.gain.exponentialRampToValueAtTime(.001,tm+.14);
    s.connect(bp); bp.connect(g); g.connect(this.bus); s.start(tm); s.stop(tm+.16); },
  stab(){ if(!this.on) return; const c=this.ctx, tm=c.currentTime+.02, lp=c.createBiquadFilter(), g=c.createGain();
    lp.type="lowpass"; lp.frequency.setValueAtTime(2400,tm); lp.frequency.exponentialRampToValueAtTime(220,tm+1.8);
    g.gain.setValueAtTime(.09,tm); g.gain.exponentialRampToValueAtTime(.001,tm+2.4); lp.connect(g); g.connect(this.bus);
    [82.4,123.5,164.8,196].forEach(f=>{ const o=c.createOscillator(); o.type="sawtooth"; o.frequency.value=f; o.detune.value=(Math.random()-.5)*14; o.connect(lp); o.start(tm); o.stop(tm+2.5); }); },
  blip(f=880){ if(!this.on) return; const c=this.ctx,o=c.createOscillator(),g=c.createGain(),tm=c.currentTime;
    o.type="square"; o.frequency.value=f; g.gain.setValueAtTime(.025,tm); g.gain.exponentialRampToValueAtTime(.0005,tm+.07); o.connect(g); g.connect(this.bus); o.start(tm); o.stop(tm+.08); }
};
document.addEventListener("visibilitychange",()=>{ if(!score.ctx) return; if(document.hidden) score.ctx.suspend(); else if(score.on) score.ctx.resume(); });

(function ticks(){ const g=$("ticks"), ns="http://www.w3.org/2000/svg";
  for(let i=0;i<120;i++){ const a=i*3*Math.PI/180, long=i%10===0, r1=long?166:172, r2=180; const l=document.createElementNS(ns,"line");
    l.setAttribute("x1",Math.cos(a)*r1); l.setAttribute("y1",Math.sin(a)*r1); l.setAttribute("x2",Math.cos(a)*r2); l.setAttribute("y2",Math.sin(a)*r2);
    l.setAttribute("stroke", long?"#ff1f1f":"#6a1414"); l.setAttribute("stroke-width", long?2:1); g.appendChild(l); } })();
const MODES={ idle:["IDLE",.12], scan:["SCAN",.5], ask:["INTERROGATE",.28], terminate:["TERMINATE",.95], exec:["EXECUTE",.6], lock:["LOCKED",.15] };
function eye(state){ $("eye").dataset.state=state; score.set(MODES[state][1]); renderReadouts(); if(state==="lock") score.stab(); }
function renderReadouts(){
  const st=$("eye").dataset.state, prof=T[S.lang].profiles[S.profile];
  $("roL").textContent=""; $("roR").textContent="";
  const add=(el,parts)=>parts.forEach((p,i)=>{ if(i) el.appendChild(document.createElement("br")); el.appendChild(document.createTextNode(p[0])); if(p[1]!==undefined){ const e=document.createElement("em"); e.textContent=p[1]; el.appendChild(e);} });
  add($("roL"),[["SYS ","ONLINE"],["MODE: "+MODES[st][0]],["RULESET: "+prof.toUpperCase()]]);
  const tgt=(S.versions[S.vIdx]&&S.versions[S.vIdx].title)||"--";
  add($("roR"),[[t("target")+": "+(tgt.length>22?tgt.slice(0,22)+"\u2026":tgt)],["ARSENAL: "+S.arsenal.length],["BUILD 5.0"]]);
  $("count").textContent=S.arsenal.length;
}

function renderLang(){
  document.documentElement.lang=S.lang; $("langBtn").textContent=S.lang.toUpperCase();
  document.querySelectorAll("[data-i]").forEach(el=>{ const v=t(el.dataset.i); if(typeof v==="string") el.textContent=v; });
  $("task").placeholder=t("placeholder"); $("refineTxt").placeholder=t("refinePh"); $("search").placeholder=t("search");
  document.querySelectorAll("#qs textarea").forEach(x=>x.placeholder=t("answerPh"));
  renderProfiles(); renderReadouts(); renderArsenal();
}
function renderProfiles(){
  const wrap=$("profiles"); wrap.textContent="";
  PROFILES.forEach(p=>{ const b=document.createElement("button"); b.className="prof"; b.textContent=T[S.lang].profiles[p];
    b.setAttribute("aria-pressed", String(S.profile===p)); b.onclick=()=>{ S.profile=p; score.blip(660); savePrefs(); renderProfiles(); renderReadouts(); }; wrap.appendChild(b); });
}

const LS="ptn_store";
const local={ load(){ try{ return JSON.parse(localStorage.getItem(LS)||'{"items":[],"rules":{}}'); }catch(_){ return {items:[],rules:{}}; } },
  write(o){ try{ localStorage.setItem(LS, JSON.stringify(o)); }catch(_){} } };
const store={ save(item){ const o=local.load(); o.items=(o.items||[]).filter(x=>x.id!==item.id); o.items.push(item); local.write(o); },
  remove(id){ const o=local.load(); o.items=(o.items||[]).filter(x=>x.id!==id); local.write(o); },
  saveRules(r){ const o=local.load(); o.rules=r; local.write(o); } };

const rulesBlock=()=>{ const r=(S.rules[S.profile]||"").trim(); return r ? "\n<reglas>\n"+r+"\n</reglas>\n" : ""; };
const P_INTERVIEW=(task)=>"Eres un ingeniero de prompts de \u00e9lite. Vas a entrevistar al usuario sobre una tarea antes de escribirle el mejor prompt posible para Claude.\n\nDecide cu\u00e1ntas preguntas hacen falta: 0 si la tarea ya es clara, hasta 5 si es compleja. Pregunta solo lo que realmente cambia el prompt (formato de salida, audiencia, contexto faltante, tono, restricciones, criterio de \u00e9xito). No preguntes nada que ya est\u00e9 resuelto en la tarea o en las reglas.\nPara cada pregunta, sugiere de 2 a 4 respuestas cortas y probables (m\u00e1ximo 8 palabras cada una) que el usuario pueda tocar en vez de escribir.\nEscribe todo en el idioma de la tarea; si no est\u00e1 claro, usa espa\u00f1ol neutro.\n"+rulesBlock()+"\n<tarea>\n"+task+"\n</tarea>\n\nResponde SOLO con JSON v\u00e1lido:\n{\"read\":\"una l\u00ednea: qu\u00e9 entendiste que es el objetivo\",\"questions\":[{\"id\":\"q1\",\"question\":\"...\",\"why\":\"raz\u00f3n breve\",\"options\":[\"...\",\"...\"]}]}";
const P_BUILD=(task,qa)=>"Eres un ingeniero de prompts de clase mundial. Escribe el mejor prompt posible para Claude (Anthropic) a partir de la tarea del usuario y sus respuestas.\n\nEl prompt debe:\n- Abrir con una oraci\u00f3n clara de rol o contexto\n- Declarar la tarea con precisi\u00f3n\n- Incorporar las reglas que apliquen a esta tarea, redactadas como instrucciones concretas\n- Incluir audiencia, tono, restricciones y criterio de \u00e9xito\n- Usar etiquetas XML donde ayude (<contexto>, <tarea>, <reglas>, <formato>)\n- Terminar con la especificaci\u00f3n exacta del formato de salida\n- Estar en segunda persona, dirigido a Claude, listo para usar sin edici\u00f3n\nEscribe el prompt en el idioma de la tarea; si no est\u00e1 claro, usa espa\u00f1ol neutro.\n"+rulesBlock()+"\n<tarea>\n"+task+"\n</tarea>\n\n<respuestas>\n"+(qa||"(sin preguntas)")+"\n</respuestas>\n\nResponde SOLO con JSON v\u00e1lido:\n{\"title\":\"t\u00edtulo corto de 3 a 6 palabras\",\"prompt\":\"el prompt completo\",\"why\":\"2 o 3 oraciones sobre las decisiones clave\"}";
const P_REFINE=(task,prev,fb,out)=>"Eres un ingeniero de prompts de clase mundial. Mejora este prompt para Claude seg\u00fan el comentario del usuario. Mant\u00e9n lo que funciona y cambia lo que pide. Escribe en el idioma del prompt actual.\n"+rulesBlock()+"\n<tarea_original>\n"+task+"\n</tarea_original>\n\n<prompt_actual>\n"+prev+"\n</prompt_actual>\n"+(out?"\n<ultimo_resultado_obtenido>\n"+out.slice(0,3500)+"\n</ultimo_resultado_obtenido>\n":"")+"\n<comentario>\n"+fb+"\n</comentario>\n\nResponde SOLO con JSON v\u00e1lido:\n{\"title\":\"t\u00edtulo corto de 3 a 6 palabras\",\"prompt\":\"el prompt mejorado completo\",\"why\":\"2 o 3 oraciones sobre qu\u00e9 cambiaste y por qu\u00e9\"}";

function errText(e){
  const c=e&&e.code;
  if(c==="rate_limited") return S.lang==="es"?"Demasiadas solicitudes. Espera un minuto.":"Too many requests. Wait a minute.";
  if(c==="aborted") return S.lang==="es"?"Detenido.":"Stopped.";
  return (S.lang==="es"?"Falla del sistema: ":"System failure: ")+((e&&e.message)||"error");
}

function show(id,on){ $(id).hidden=!on; }
function working(on,title){ show("working",on); if(title) $("wTitle").textContent=title; }
function setBusy(b){ S.busy=b; refresh(); }
function refresh(){
  $("goBtn").disabled = S.busy || !$("task").value.trim();
  $("directBtn").disabled = $("goBtn").disabled;
  $("buildBtn").disabled = S.busy;
  $("refineBtn").disabled = S.busy || !$("refineTxt").value.trim();
  $("execBtn").disabled = S.busy;
  $("task").disabled = S.busy || !$("sAsk").hidden || !$("sResult").hidden;
}

async function interrogate(){
  const task=$("task").value.trim(); if(!task||S.busy) return;
  $("err1").textContent=""; setBusy(true); eye("scan"); working(true,t("scanning")); score.blip(520);
  try{
    const r=await sample.json(P_INTERVIEW(task),{});
    S.read=String(r&&r.read||""); S.questions=(Array.isArray(r&&r.questions)?r.questions:[]).slice(0,5).map((q,i)=>({
      id:String(q.id||"q"+(i+1)), question:String(q.question||""), why:String(q.why||""), options:(Array.isArray(q.options)?q.options:[]).slice(0,4).map(String) }));
    S.answers={};
    working(false);
    if(!S.questions.length){ setBusy(false); return terminate(true); }
    renderQuestions(); show("sAsk",true); eye("ask");
    $("sAsk").scrollIntoView({behavior:"smooth",block:"start"});
  }catch(e){ working(false); eye("idle"); $("err1").textContent=errText(e); }
  setBusy(false);
}

function renderQuestions(){
  const rl=$("readLine"); rl.textContent=""; const em=document.createElement("em"); em.textContent=t("target")+": "; rl.append(em, document.createTextNode(S.read||"--"));
  const wrap=$("qs"); wrap.textContent="";
  S.questions.forEach((q,i)=>{
    const box=document.createElement("div"); box.className="q";
    const h=document.createElement("div"); h.className="q-t"; const n=document.createElement("span"); n.textContent=String(i+1).padStart(2,"0");
    const l=document.createElement("label"); l.htmlFor="a_"+q.id; l.textContent=q.question; h.append(n,l);
    const w=document.createElement("div"); w.className="q-why"; w.textContent=q.why;
    const chips=document.createElement("div"); chips.className="chips";
    const ta=document.createElement("textarea"); ta.id="a_"+q.id; ta.placeholder=t("answerPh"); ta.value=S.answers[q.id]||"";
    const sync=()=>chips.querySelectorAll(".chip").forEach(c=>c.setAttribute("aria-pressed", String(c.textContent===ta.value)));
    q.options.forEach(o=>{ const c=document.createElement("button"); c.className="chip"; c.textContent=o; c.setAttribute("aria-pressed","false");
      c.onclick=()=>{ ta.value = ta.value===o ? "" : o; S.answers[q.id]=ta.value; sync(); score.blip(990); }; chips.appendChild(c); });
    ta.oninput=()=>{ S.answers[q.id]=ta.value; sync(); };
    box.append(h,w); if(q.options.length) box.append(chips); box.append(ta); wrap.appendChild(box);
  });
}

async function terminate(direct){
  const task=$("task").value.trim(); if(!task||S.busy) return;
  const qa = direct ? "" : S.questions.map(q=>"P: "+q.question+"\nR: "+((S.answers[q.id]||"").trim()||t("noAnswer"))).join("\n\n");
  $("err1").textContent=""; $("err2").textContent=""; setBusy(true); eye("terminate"); working(true,t("terminating")); score.blip(440);
  try{
    const r=await sample.json(P_BUILD(task,qa),{});
    if(!r||typeof r.prompt!=="string") throw new Error("no prompt");
    S.versions=[{title:String(r.title||""),prompt:r.prompt,why:String(r.why||"")}]; S.vIdx=0; S.lastOutput="";
    working(false); show("sAsk",false); show("sExec",false); renderResult(); show("sResult",true); eye("lock");
    $("sResult").scrollIntoView({behavior:"smooth",block:"start"});
  }catch(e){ working(false); eye(S.questions.length&&!direct?"ask":"idle"); (direct||!S.questions.length?$("err1"):$("err2")).textContent=errText(e); }
  setBusy(false);
}

function renderResult(){
  const v=S.versions[S.vIdx]; const task=$("task").value.trim();
  $("beforeTxt").textContent=task; $("beforeCount").textContent=task.length+" "+t("chars");
  $("promptTxt").textContent=v.prompt; $("afterCount").textContent=v.prompt.length+" "+t("chars");
  $("whyTxt").textContent=v.why;
  const vs=$("versions"); vs.textContent="";
  if(S.versions.length>1) S.versions.forEach((x,i)=>{ const b=document.createElement("button"); b.className="ver"; b.textContent="v"+(i+1);
    b.setAttribute("aria-pressed",String(i===S.vIdx)); b.onclick=()=>{ S.vIdx=i; renderResult(); score.blip(770); }; vs.appendChild(b); });
  renderReadouts();
}

async function execute(){
  if(S.busy) return; const v=S.versions[S.vIdx];
  show("sExec",true); const out=$("out"); out.classList.remove("empty"); out.textContent=S.lang==="es"?"Pensando...":"Thinking...";
  $("copyOutBtn").hidden=true; $("stopBtn").hidden=false; setBusy(true); eye("exec"); score.blip(330);
  $("sExec").scrollIntoView({behavior:"smooth",block:"start"});
  S.ctl=new AbortController();
  try{
    const r=await sample(v.prompt,{signal:S.ctl.signal});
    out.textContent=r.text; S.lastOutput=r.text; $("copyOutBtn").hidden=false; eye("lock");
  }catch(e){ out.textContent=errText(e); eye("lock"); }
  $("stopBtn").hidden=true; S.ctl=null; setBusy(false);
}

async function refine(){
  const fb=$("refineTxt").value.trim(); if(!fb||S.busy) return;
  $("err3").textContent=""; setBusy(true); eye("terminate"); working(true,t("reterminating")); score.blip(440);
  $("working").scrollIntoView({behavior:"smooth",block:"center"});
  try{
    const prev=S.versions[S.vIdx].prompt;
    const r=await sample.json(P_REFINE($("task").value.trim(),prev,fb,S.lastOutput),{});
    if(!r||typeof r.prompt!=="string") throw new Error("no prompt");
    S.versions.push({title:String(r.title||S.versions[0].title),prompt:r.prompt,why:String(r.why||"")}); S.vIdx=S.versions.length-1;
    $("refineTxt").value=""; working(false); renderResult(); eye("lock"); $("sResult").scrollIntoView({behavior:"smooth",block:"start"});
  }catch(e){ working(false); eye("lock"); $("err3").textContent=errText(e); }
  setBusy(false);
}

function save(){
  const v=S.versions[S.vIdx];
  const item={ id:"p"+Date.now().toString(36), title:v.title||($("task").value.trim().slice(0,40)), prompt:v.prompt, why:v.why,
    request:$("task").value.trim(), profile:S.profile, createdAt:Date.now() };
  store.save(item); S.arsenal.unshift(item); renderArsenal(); renderReadouts(); toast(t("saved")); score.stab();
}

function reset(){
  if(S.ctl) S.ctl.abort();
  S.questions=[]; S.answers={}; S.versions=[]; S.lastOutput="";
  ["sAsk","sResult","sExec"].forEach(id=>show(id,false)); $("task").value=""; $("refineTxt").value="";
  ["err1","err2","err3"].forEach(id=>$(id).textContent=""); eye("idle"); refresh();
  window.scrollTo({top:0,behavior:"smooth"}); setTimeout(()=>$("task").focus(),300);
}

function renderArsenal(){
  const q=($("search").value||"").toLowerCase(), list=$("list"); list.textContent="";
  const items=S.arsenal.filter(x=>!q || (x.title+" "+x.request+" "+x.prompt).toLowerCase().includes(q));
  if(!items.length){ const e=document.createElement("p"); e.className="empty-list"; e.textContent=t("emptyArsenal"); list.appendChild(e); return; }
  items.forEach(x=>{
    const b=document.createElement("div"); b.className="item"; b.setAttribute("role","button"); b.tabIndex=0;
    const ti=document.createElement("b"); ti.textContent=x.title||"--";
    const row=document.createElement("div"); row.className="row";
    const tag=document.createElement("span"); tag.className="tag"; tag.textContent=(T[S.lang].profiles[x.profile]||"").toUpperCase();
    const dt=document.createElement("small"); dt.textContent=new Date(x.createdAt||Date.now()).toLocaleDateString(S.lang==="es"?"es":"en-US",{day:"numeric",month:"short",year:"numeric"});
    const del=document.createElement("button"); del.className="del"; del.textContent=t("del");
    del.onclick=(ev)=>{ ev.stopPropagation(); store.remove(x.id); S.arsenal=S.arsenal.filter(y=>y.id!==x.id); renderArsenal(); renderReadouts(); toast(t("deleted")); };
    row.append(tag,dt,del); b.append(ti,row);
    const open=()=>{ closeSheets(); $("task").value=x.request||""; S.profile=PROFILES.includes(x.profile)?x.profile:S.profile; renderProfiles();
      S.versions=[{title:x.title,prompt:x.prompt,why:x.why||""}]; S.vIdx=0; S.lastOutput="";
      show("sAsk",false); show("sExec",false); renderResult(); show("sResult",true); eye("lock"); refresh();
      setTimeout(()=>$("sResult").scrollIntoView({behavior:"smooth",block:"start"}),50); };
    b.onclick=open; b.onkeydown=(e)=>{ if(e.key==="Enter") open(); };
    list.appendChild(b);
  });
}

function openSheet(id){ $("scrim").hidden=false; $(id).hidden=false; score.blip(600); }
function closeSheets(){ $("scrim").hidden=true; $("arsenalSheet").hidden=true; $("rulesSheet").hidden=true; }
let toastT; function toast(m){ const el=$("toast"); el.textContent=m; el.classList.add("on"); clearTimeout(toastT); toastT=setTimeout(()=>el.classList.remove("on"),1800); }
async function copyText(text){
  let ok=false; try{ await navigator.clipboard.writeText(text); ok=true; }catch(_){}
  if(!ok){ const ta=document.createElement("textarea"); ta.value=text; ta.style.position="fixed"; ta.style.opacity="0"; document.body.appendChild(ta); ta.select(); try{ ok=document.execCommand("copy"); }catch(_){} ta.remove(); }
  toast(ok?t("copied"):"SELECT + COPY"); score.blip(1200);
}

$("task").addEventListener("input",refresh);
$("task").addEventListener("keydown",e=>{ if((e.metaKey||e.ctrlKey)&&e.key==="Enter") interrogate(); });
$("refineTxt").addEventListener("input",refresh);
$("refineTxt").addEventListener("keydown",e=>{ if((e.metaKey||e.ctrlKey)&&e.key==="Enter") refine(); });
$("goBtn").onclick=interrogate;
$("directBtn").onclick=()=>terminate(true);
$("buildBtn").onclick=()=>terminate(false);
$("backBtn").onclick=()=>{ show("sAsk",false); eye("idle"); refresh(); $("task").focus(); };
$("execBtn").onclick=execute;
$("stopBtn").onclick=()=>{ if(S.ctl) S.ctl.abort(); };
$("copyBtn").onclick=()=>copyText(S.versions[S.vIdx].prompt);
$("copyOutBtn").onclick=()=>copyText(S.lastOutput);
$("saveBtn").onclick=save;
$("newBtn").onclick=reset;
$("refineBtn").onclick=refine;
$("arsenalBtn").onclick=()=>{ renderArsenal(); openSheet("arsenalSheet"); };
$("rulesBtn").onclick=()=>{ $("rulesTitle").textContent=T[S.lang].profiles[S.profile].toUpperCase(); $("rulesTxt").value=S.rules[S.profile]||""; openSheet("rulesSheet"); };
$("rulesSave").onclick=()=>{ S.rules[S.profile]=$("rulesTxt").value; const custom={}; PROFILES.forEach(p=>{ if(S.rules[p]!==DEFAULT_RULES[p]) custom[p]=S.rules[p]; }); store.saveRules(custom); toast(t("rulesSaved")); closeSheets(); };
$("rulesReset").onclick=()=>{ $("rulesTxt").value=DEFAULT_RULES[S.profile]; };
$("scrim").onclick=closeSheets;
document.querySelectorAll("[data-close]").forEach(b=>b.onclick=closeSheets);
document.addEventListener("keydown",e=>{ if(e.key==="Escape") closeSheets(); });
$("search").addEventListener("input",renderArsenal);
$("langBtn").onclick=()=>{ S.lang=S.lang==="es"?"en":"es"; savePrefs(); renderLang(); if(!$("sAsk").hidden) renderQuestions(); if(!$("sResult").hidden) renderResult(); score.blip(700); };
$("soundBtn").onclick=()=>{
  if(score.on){ score.stop(); } else { score.start(); score.set(MODES[$("eye").dataset.state][1]); }
  $("soundBtn").setAttribute("aria-pressed",String(score.on)); $("waves").setAttribute("opacity", score.on?"1":".35");
};

try{ const d=local.load(); S.arsenal=(d.items||[]).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0)); Object.assign(S.rules,d.rules||{}); }catch(_){}
renderLang(); eye("idle"); refresh();
})();
