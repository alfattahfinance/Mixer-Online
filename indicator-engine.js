/* Mixer Online — Definitive Indicator Engine v1
   Functional LEDs/meters: PWR, SIG, PEAK, CLIP for every channel + MASTER,
   plus INPUT L/R, CONNECT, REC and MUSIC status. No decorative-only lamps.
*/
(function(){
  "use strict";
  if(window.__indicatorEngineV1)return;
  window.__indicatorEngineV1=true;

  const css=`
    .indicator-lamps{display:flex;align-items:center;justify-content:center;gap:5px;margin:3px 3px 2px;min-height:18px;padding:2px 4px;border:1px solid #252c30;border-radius:3px;background:#080b0c;box-shadow:inset 0 0 5px #000}
    .indicator-lamps .lamp-item{display:inline-flex;align-items:center;gap:2px;font:700 7px/1 Arial,sans-serif;color:#707a7f;letter-spacing:.2px}
    .indicator-lamps .lamp{display:inline-block;width:8px;height:8px;border-radius:50%;background:#15191b;border:1px solid #42484b;box-shadow:inset 0 0 2px #000;transition:background .04s,box-shadow .04s}
    .indicator-lamps .lamp.active{background:#22d45b;border-color:#73ff9a;box-shadow:0 0 7px #22d45b}
    .indicator-lamps .lamp.peak.active{background:#ffd52b;border-color:#fff09a;box-shadow:0 0 8px #ffd52b}
    .indicator-lamps .lamp.clip.active{background:#ff3030;border-color:#ff9b9b;box-shadow:0 0 10px #ff3030}
    .indicator-lamps .lamp.on.active{background:#18d45a;border-color:#74ff9d;box-shadow:0 0 6px #18d45a}
    .indicator-lamps .lamp.signal.active{background:#20e66a;border-color:#9dffbb;box-shadow:0 0 8px #20e66a}
    .master .indicator-lamps{margin:4px 6px 5px;padding:4px 5px;gap:7px}
    .master .indicator-lamps .lamp{width:10px;height:10px}
    .input-meter .indicator-lamps{margin:5px auto 2px;flex-wrap:wrap;width:76px}
    .input-meter .indicator-lamps .lamp{width:8px;height:8px}
    .input-meter .indicator-lamps .lamp-item{font-size:6px}
    .status-led{display:inline-block;width:8px;height:8px;border-radius:50%;margin-left:4px;background:#2a2f31;border:1px solid #4b5357;vertical-align:middle}
    .status-led.active{background:#21dc58;border-color:#8cffad;box-shadow:0 0 8px #21dc58}
    .status-led.warn{background:#ffd52b;border-color:#fff09a;box-shadow:0 0 8px #ffd52b}
    .status-led.error{background:#ff3030;border-color:#ff9b9b;box-shadow:0 0 9px #ff3030}
    .channel .indicator-lamps{position:relative;z-index:4}
  `;
  const st=document.createElement("style");st.id="definitive-indicator-style";st.textContent=css;document.head.appendChild(st);

  const $=s=>document.querySelector(s);
  const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
  const rmsPeak=analyser=>{
    if(!analyser)return {rms:0,peak:0};
    try{
      const n=analyser.fftSize||1024;
      const data=new Uint8Array(n);
      analyser.getByteTimeDomainData(data);
      let sum=0,peak=0;
      for(let i=0;i<data.length;i++){
        const x=(data[i]-128)/128;
        sum+=x*x;
        const ax=Math.abs(x);
        if(ax>peak)peak=ax;
      }
      return {rms:Math.sqrt(sum/data.length),peak};
    }catch(e){return {rms:0,peak:0};}
  };

  function lampSet(host,kind){
    if(!host)return null;
    let box=host.querySelector(":scope > .indicator-lamps");
    if(!box){
      box=document.createElement("div");
      box.className="indicator-lamps";
      box.setAttribute("aria-label","Audio indicators");
      box.innerHTML=[
        ["on","PWR"],["signal","SIG"],["peak","PK"],["clip","CLIP"]
      ].map(([k,t])=>'<span class="lamp-item"><i class="lamp '+k+'" title="'+t+'"></i><span>'+t+"</span></span>").join("");
      host.prepend(box);
    }
    return {
      root:box,
      on:box.querySelector(".lamp.on"),
      signal:box.querySelector(".lamp.signal"),
      peak:box.querySelector(".lamp.peak"),
      clip:box.querySelector(".lamp.clip")
    };
  }

  const peakHold=new WeakMap();
  function setLamp(el,on){if(el)el.classList.toggle("active",!!on)}

  function channelState(card){
    let lamps=card.__defIndicators;
    if(!lamps){lamps=lampSet(card);card.__defIndicators=lamps}
    const muted=!!card.querySelector(".channel-actions .mute.active");
    setLamp(lamps.on,!muted);

    const a=card._audio?.analyser;
    const v=rmsPeak(a);
    const signal=v.rms>.018 || v.peak>.035;
    const peak=v.peak>.62;
    const clip=v.peak>.94;
    setLamp(lamps.signal,signal);
    setLamp(lamps.peak,peak);

    let hold=peakHold.get(card)||0;
    if(clip)hold=performance.now()+650;
    peakHold.set(card,hold);
    setLamp(lamps.clip,hold>performance.now());
  }

  function masterState(){
    const m=$(".master");
    if(!m)return;
    let lamps=m.__defIndicators;
    if(!lamps){lamps=lampSet(m);m.__defIndicators=lamps}
    setLamp(lamps.on,!m.querySelector(".mute.active"));
    const v=rmsPeak(window.masterAnalyser);
    setLamp(lamps.signal,v.rms>.012||v.peak>.03);
    setLamp(lamps.peak,v.peak>.62);
    let hold=masterState.hold||0;
    if(v.peak>.94)hold=performance.now()+800;
    masterState.hold=hold;
    setLamp(lamps.clip,hold>performance.now());
  }

  function inputState(){
    const box=$(".input-meter");
    if(!box)return;
    let lamps=box.__defInputIndicators;
    if(!lamps){
      const wrap=document.createElement("div");
      wrap.className="indicator-lamps";
      wrap.innerHTML='<span class="lamp-item"><i class="lamp signal" id="inputLedL"></i><span>L</span></span><span class="lamp-item"><i class="lamp signal" id="inputLedR"></i><span>R</span></span>';
      const meter=box.querySelector(".meter-vertical");
      (meter||box).after(wrap);
      lamps={l:wrap.querySelector("#inputLedL"),r:wrap.querySelector("#inputLedR")};
      box.__defInputIndicators=lamps;
    }
    const active=[...document.querySelectorAll(".channel")].some(c=>c._audio&&rmsPeak(c._audio.analyser).rms>.018);
    setLamp(lamps.l,active);setLamp(lamps.r,active);
  }

  function statusLeds(){
    const connect=$("#connectDevice"), top=connect?.querySelector(".top-led");
    if(top){
      const connected=!!window.MixerControl?.state?.connected || !!window.MixerAdapters?.hasTransport?.();
      top.classList.toggle("active",connected);
    }
    const rec=$("#phoneRecorder");
    if(rec&&!rec.querySelector(".status-led")){
      const led=document.createElement("i");led.className="status-led";rec.appendChild(led);
      rec.__indicatorLed=led;
    }
    const playing=$("#playerState"), play=$("#musicPlay");
    if(playing){
      let led=playing.querySelector(".status-led");
      if(!led){led=document.createElement("i");led.className="status-led";playing.appendChild(led)}
      const s=(playing.textContent||"").toUpperCase();
      led.classList.toggle("active",s.includes("PLAYING")||s.includes("READY"));
      led.classList.toggle("warn",s.includes("PAUSED")||s.includes("LOADING"));
      led.classList.toggle("error",s.includes("ERROR")||s.includes("GAGAL"));
    }
    if(play){
      const s=(playing?.textContent||"").toUpperCase();
      play.classList.toggle("is-playing",s.includes("PLAYING"));
    }
  }

  function run(){
    const channels=[...document.querySelectorAll(".channel")];
    channels.forEach(channelState);
    masterState();
    inputState();
    statusLeds();
    requestAnimationFrame(run);
  }

  function boot(n){
    if(document.querySelector(".channel")||n<=0){run();return}
    setTimeout(()=>boot(n-1),100);
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>boot(50),{once:true});
  else boot(50);
})();
