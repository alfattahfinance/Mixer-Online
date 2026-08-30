/* Mixer Online — UI skin + original audio/ESP32 control layer */
"use strict";
const AudioCtx = window.AudioContext || window.webkitAudioContext;
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const state = { channels: [], channelCount: 16, solo: new Set(), sources: new Map(), audio: null, audioSource: null, ctx: null, masterGain: null, playlist: [], index: 0, playing: false, urls: [] };
window.__mixerState = state;
window.MixerOnline = { state };

function status(msg){ const p=$("#playerState"); if(p) p.textContent=msg; const u=$("#usbState"); if(u) u.textContent=msg; }
function setText(sel,txt){const e=$(sel);if(e)e.textContent=txt}
function pct(v){return Math.max(0,Math.min(100,Number(v)||0))}
function ensureAudio(){
  if(state.audio) return;
  state.ctx = AudioCtx ? new AudioCtx() : null;
  state.audio = new Audio(); state.audio.preload="metadata"; state.audio.crossOrigin="anonymous";
  state.audio.addEventListener("timeupdate", updatePlaybackUI);
  state.audio.addEventListener("loadedmetadata", updatePlaybackUI);
  state.audio.addEventListener("ended", nextTrack);
  if(state.ctx){
    state.audioSource=state.ctx.createMediaElementSource(state.audio);
    state.masterGain=state.ctx.createGain();
    state.masterGain.gain.value=1;
    state.masterGain.connect(state.ctx.destination);
    routeAudioToChannel();
  }
}
function resumeAudio(){if(state.ctx && state.ctx.state!=="running") return state.ctx.resume();return Promise.resolve()}
function formatTime(sec){if(!Number.isFinite(sec))return"00:00";sec=Math.max(0,Math.floor(sec));return String(Math.floor(sec/60)).padStart(2,"0")+":"+String(sec%60).padStart(2,"0")}
function updatePlaybackUI(){
  const a=state.audio;if(!a)return;
  setText("#musicCurrent",formatTime(a.currentTime)); setText("#musicDuration",formatTime(a.duration));
  const bar=$("#musicProgress");if(bar)bar.style.width=(a.duration?Math.min(100,a.currentTime/a.duration*100):0)+"%";
  setText("#screenTime",formatTime(a.currentTime)+" / "+formatTime(a.duration));
  setText("#playerName",state.playlist[state.index]?.name||"NO SIGNAL");
  setText("#playerState",a.paused?"PAUSED":"PLAYING");setText("#usbState",a.paused?"PAUSED":"PLAYING");
}
function renderPlaylist(){
  const q=$("#playlist"); if(!q)return;
  q.innerHTML=state.playlist.length?state.playlist.map((f,i)=>`<button class="playlist-item ${i===state.index?"active":""}" data-i="${i}">${i+1}. ${f.name}</button>`).join(""):"Playlist kosong";
  $$(".playlist-item").forEach(b=>b.onclick=()=>loadTrack(Number(b.dataset.i),true));
}
async function loadTrack(i=state.index,autoPlay=false){
  if(!state.playlist.length)return;
  state.index=(i+state.playlist.length)%state.playlist.length;
  ensureAudio(); const file=state.playlist[state.index];
  if(state.urls[state.index]) URL.revokeObjectURL(state.urls[state.index]);
  const url=URL.createObjectURL(file); state.urls[state.index]=url;
  state.audio.pause(); state.audio.src=url; state.audio.currentTime=0; state.audio.load();
  renderPlaylist(); setText("#musicNowPlaying",file.name); setText("#screenTrack",file.name); setText("#screenPlayState","READY");
  if(autoPlay) await playMusic();
}
async function playMusic(){
  if(!state.playlist.length){status("PILIH MUSIK");return false}
  ensureAudio(); await resumeAudio();
  try{await state.audio.play();state.playing=true;status("PLAYING");return true}catch(e){state.playing=false;status("GAGAL MEMUTAR");setText("#screenPlayState","GAGAL MEMUTAR");return false}
}
function pauseMusic(){if(!state.audio)return;state.audio.pause();state.playing=false;status("PAUSED")}
function nextTrack(){
  if(!state.playlist.length)return;
  const mode=$("#musicMode")?.value||$("#audioPlayMode")?.value||"sequential";
  if(mode==="random" && state.playlist.length>1){let n=state.index;while(n===state.index)n=Math.floor(Math.random()*state.playlist.length);state.index=n}else state.index=(state.index+1)%state.playlist.length;
  loadTrack(state.index,state.playing);
}
function prevTrack(){if(!state.playlist.length)return;state.index=(state.index-1+state.playlist.length)%state.playlist.length;loadTrack(state.index,state.playing)}
function setPlaylist(files){
  state.playlist=[...files].filter(f=>f.type.startsWith("audio/")||/.(mp3|wav|m4a|aac|ogg|flac)$/i.test(f.name));
  state.urls.forEach(u=>{try{URL.revokeObjectURL(u)}catch{}});state.urls=[];state.index=0;renderPlaylist();
  if(state.playlist.length)loadTrack(0,false); else status("PILIH MUSIK");
}
function bindMusic(){
  [$("#musicFile"),$("#audioFile")].filter(Boolean).forEach(input=>input.addEventListener("change",e=>setPlaylist(e.target.files)));
  $("#pickMusic")?.addEventListener("click",()=>$("#musicFile")?.click());
  $("#musicPlay")?.addEventListener("click",()=>state.audio&&!state.audio.paused?pauseMusic():playMusic());
  $("#play")?.addEventListener("click",()=>state.audio&&!state.audio.paused?pauseMusic():playMusic());
  $("#musicNext")?.addEventListener("click",nextTrack); $("#next")?.addEventListener("click",nextTrack);
  $("#musicPrev")?.addEventListener("click",prevTrack); $("#prev")?.addEventListener("click",prevTrack);
  $("#musicStop")?.addEventListener("click",()=>{if(state.audio){state.audio.pause();state.audio.currentTime=0}state.playing=false;status("STOPPED")});
  $("#stopMusic")?.addEventListener("click",()=>{if(state.audio){state.audio.pause();state.audio.currentTime=0}state.playing=false;status("STOPPED")});
  [$("#musicVolume"),$("#masterVol")].filter(Boolean).forEach(x=>x.addEventListener("input",e=>{const v=Number(e.target.value);if(state.audio)state.audio.volume=$("#musicVolume")?Number($("#musicVolume").value):v;if(state.masterGain)state.masterGain.gain.value=v;setText("#musicVolumeValue",Math.round(v*100)+"%")}));
}
function buildChannel(n){
  const c=document.createElement("article"); c.className="channel"; c.dataset.channel=String(n);
  const initial=n===1?80:0;
  c.innerHTML=`<div class="ch-head"><span>CH ${n}</span><i></i></div><button class="ch-btn topmute">MUTE</button><button class="ch-btn solo">SOLO</button><output class="value">${initial}%</output><div class="knobs"><div><div class="knob gainKnob"></div><small>GAIN</small></div><div><div class="knob panKnob"></div><small>PAN</small></div></div><div class="fader-wrap"><div class="scale-y"><span>10</span><span>5</span><span>0</span><span>-5</span><span>-10</span><span>-20</span><span>-30</span><span>-40</span><span>-60</span><span>-∞</span></div><input class="fader ch-fader" type="range" min="0" max="100" value="${initial}"><div class="ch-lamp"></div></div><div class="ch-bottom"><button class="ch-btn mute">MUTE</button><div class="label">CH ${n}</div><div class="status">${n===1?"LIVE":"READY"}</div></div>`;
  const f=c.querySelector(".ch-fader");f.addEventListener("input",()=>{c.querySelector(".value").textContent=Math.round(f.value)+"%";updateChannelAudio(c);sendControl(n,"fader",Number(f.value));updateMetersFromMix()});
  c.querySelector(".gainKnob").addEventListener("pointerdown",e=>knobDrag(e,c,"gain"));
  c.querySelector(".panKnob").addEventListener("pointerdown",e=>knobDrag(e,c,"pan"));
  c.querySelectorAll(".mute,.topmute").forEach(b=>b.addEventListener("click",()=>toggleMute(c)));
  c.querySelector(".solo").addEventListener("click",()=>toggleSolo(c));
  state.channels.push(c); return c;
}
function knobDrag(e,c,type){e.preventDefault();const knob=e.currentTarget;let startY=e.clientY;const start=Number(knob.dataset.value??(type==="gain"?1:0));const move=ev=>{const d=(startY-ev.clientY)/90;const v=type==="gain"?Math.max(0,Math.min(2,start+d)):Math.max(-1,Math.min(1,start+d));knob.dataset.value=v;knob.style.setProperty("--rot",(-135+(type==="gain"?v/2:(v+1)/2)*270)+"deg");sendControl(Number(c.dataset.channel),type,v);updateChannelAudio(c)};const up=()=>{removeEventListener("pointermove",move);removeEventListener("pointerup",up)};addEventListener("pointermove",move);addEventListener("pointerup",up,{once:true});move(e)}
function toggleMute(c){const on=!c.classList.contains("muted");c.classList.toggle("muted",on);c.querySelectorAll(".mute,.topmute").forEach(b=>b.textContent=on?"UNMUTE":"MUTE");updateChannelAudio(c);sendControl(Number(c.dataset.channel),"mute",on?1:0)}
function toggleSolo(c){const n=Number(c.dataset.channel);const on=!c.classList.contains("soloed");c.classList.toggle("soloed",on);if(on)state.solo.add(n);else state.solo.delete(n);state.channels.forEach(updateChannelAudio);sendControl(n,"solo",on?1:0)}
function updateChannelAudio(c){
  const f=Number(c.querySelector(".fader")?.value||0)/100; const muted=c.classList.contains("muted"); const hasSolo=state.solo.size>0; const soloed=c.classList.contains("soloed");
  const gain=(muted||(hasSolo&&!soloed))?0:f;
  if(c._gain)c._gain.gain.value=gain;
}
function buildChannels(n=16){
  n=Math.max(1,Math.min(64,Number(n)||16));state.channelCount=n;state.channels=[];const box=$("#channels");if(!box)return;box.innerHTML="";for(let i=1;i<=n;i++)box.appendChild(buildChannel(i));if(state.ctx&&state.audioSource)routeAudioToChannel();setText("#viewChannelsCount",n);updateMetersFromMix();
}
function routeAudioToChannel(){
  if(!state.ctx||!state.audioSource)return;
  state.channels.forEach(c=>{if(c._gain)c._gain.disconnect();if(c._audio?.analyser)c._audio.analyser.disconnect()});
  const split=state.ctx.createGain();split.gain.value=1;state.audioSource.disconnect();state.audioSource.connect(split);
  state.channels.forEach(c=>{const g=state.ctx.createGain();c._gain=g;split.connect(g);const a=state.ctx.createAnalyser();a.fftSize=256;g.connect(a);a.connect(state.masterGain);c._audio={analyser:a,update:()=>updateChannelAudio(c)};updateChannelAudio(c)});
}
function sendControl(channel,control,value){
  try{if(window.MixerAdapters?.active){const maps=window.MixerProfiles?.get?.().controlMappings||{};window.MixerAdapters.sendMapped({channel:"CH"+channel,control,value},maps)}}catch{}
  try{window.MixerControl?.setControl?.("CH"+channel,control,value)}catch{}
}
function connectSimulator(){
  if(window.MixerAdapters?.simulator){window.MixerAdapters.simulator().then(()=>{const d=$("#connectBtn")?.querySelector("i");if(d)d.classList.add("dot")}).catch(()=>{})}
}
function bindConnection(){
  const b=$("#connectBtn");if(b)b.addEventListener("click",async()=>{try{if(window.MixerAdapters?.active?.type==="simulator"&&navigator.bluetooth){await MixerAdapters.bluetooth();setText("#usbState","CONNECTED")}else if(window.MixerAdapters?.simulator)await MixerAdapters.simulator()}catch{await window.MixerAdapters?.simulator?.()}});
  $("#stopBtn")?.addEventListener("click",()=>{if(state.audio){state.audio.pause();state.audio.currentTime=0}state.playing=false;status("STOPPED")});
}
function updateMetersFromMix(){
  const active=state.playlist.length&&state.audio&&!state.audio.paused;const level=active?Math.max(.03,Number($("#masterFader")?.value||80)/100):.03;
  const l=$("#inL"),r=$("#inR");if(l)l.style.height=pct(level*100)+"%";if(r)r.style.height=pct(level*95)+"%";
  state.channels.forEach(c=>{const fill=c.querySelector(".ch-lamp");if(fill)fill.style.height=pct(Number(c.querySelector(".fader")?.value||0))+"%"});
}
function bindMaster(){const f=$("#masterFader");if(!f)return;f.addEventListener("input",()=>{const v=Number(f.value)/100;if(state.masterGain)state.masterGain.gain.value=v;const o=f.nextElementSibling;if(o)o.value=Math.round(v*100)+"%";updateMetersFromMix()})}
function init(){
  bindMusic();bindConnection();bindMaster();buildChannels(Number($("#channelCount")?.value||16));
  $("#applyChannels")?.addEventListener("click",()=>buildChannels($("#channelCount").value));
  connectSimulator();drawSpectrum();
}
function drawSpectrum(){const cv=$("#specCanvas");if(!cv)return;const ctx=cv.getContext("2d");function resize(){const d=devicePixelRatio||1;cv.width=cv.clientWidth*d;cv.height=cv.clientHeight*d;ctx.setTransform(d,0,0,d,0,0)}resize();addEventListener("resize",resize);let t=0;function frame(){t+=.03;ctx.clearRect(0,0,cv.clientWidth,cv.clientHeight);for(let x=0;x<cv.clientWidth;x+=6){const h=12+Math.abs(Math.sin(x*.028+t))*45+Math.abs(Math.sin(x*.065-t))*35;ctx.fillStyle="#0878c9";ctx.fillRect(x,cv.clientHeight-h,4,h)}requestAnimationFrame(frame)}frame()}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();