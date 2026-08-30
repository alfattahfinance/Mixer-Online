"use strict";
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
let music=[],idx=0,playing=true;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
function makeChannel(n){
 const c=document.createElement("article");c.className="channel";
 const val=n===1?80:clamp(100-(n%5)*15,0,100);
 c.innerHTML='<div class="ch-head"><span>CH '+n+'</span><i></i></div><button class="ch-btn topmute">MUTE</button><button class="ch-btn solo">SOLO</button><output class="value">'+val+'.0</output><div class="knobs"><div><div class="knob"></div><small>GAIN</small></div><div><div class="knob"></div><small>PAN</small></div></div><div class="fader-wrap"><div class="scale-y"><span>10</span><span>5</span><span>0</span><span>-5</span><span>-10</span><span>-20</span><span>-30</span><span>-40</span><span>-60</span><span>-∞</span></div><input class="fader ch-fader" type="range" min="0" max="100" value="'+val+'"><div class="ch-lamp"></div></div><div class="ch-bottom"><button class="ch-btn mute">MUTE</button><div class="label">CH '+n+'</div><div class="status">'+(n===1?'LIVE':'READY')+'</div></div>';
 c.querySelectorAll(".mute,.topmute").forEach(b=>b.addEventListener("click",()=>{c.classList.toggle("muted");c.querySelectorAll(".mute,.topmute").forEach(x=>x.textContent=c.classList.contains("muted")?"UNMUTE":"MUTE")}));
 c.querySelector(".solo").addEventListener("click",()=>c.classList.toggle("soloed"));
 c.querySelector(".ch-fader").addEventListener("input",e=>{c.querySelector(".value").textContent=e.target.value+"%";updateMeter(e.target.value)});
 return c;
}
function build(n){const count=clamp(Math.floor(Number(n)||16),1,32),box=$("#channels");box.innerHTML="";for(let i=1;i<=count;i++)box.appendChild(makeChannel(i))}
function updateMeter(v){const h=clamp(Number(v),3,100);$("#inL").style.height=h+"%";$("#inR").style.height=clamp(h*.94,3,100)+"%"}
function drawSpectrum(){
 const cv=$("#specCanvas"),ctx=cv.getContext("2d");
 function resize(){const d=devicePixelRatio||1;cv.width=cv.clientWidth*d;cv.height=cv.clientHeight*d;ctx.setTransform(d,0,0,d,0,0)} resize();addEventListener("resize",resize);
 let t=0;function draw(){t+=.018;ctx.clearRect(0,0,cv.clientWidth,cv.clientHeight);ctx.fillStyle="#0878c9";for(let x=0;x<cv.clientWidth;x+=6){const y=cv.clientHeight-(28+Math.abs(Math.sin(x*.025+t))*45+Math.abs(Math.sin(x*.061-t))*70+Math.random()*22);ctx.fillRect(x,y,4,cv.clientHeight-y)}requestAnimationFrame(draw)}draw();
}
$$(".tabs").forEach(n=>n.addEventListener("click",e=>{const b=e.target.closest("button");if(!b)return;$$(".tabs button").forEach(x=>x.classList.remove("active"));b.classList.add("active");$$(".view").forEach(x=>x.style.display="none");$("#"+b.dataset.tab+"View").style.display="block"}));
$("#applyChannels").onclick=()=>build($("#channelCount").value);
$("#masterFader").addEventListener("input",e=>e.target.nextElementSibling.value=e.target.value+"%");
$("#masterVol").addEventListener("input",e=>e.target.nextElementSibling.textContent=e.target.value+"%");
$("#stopBtn").onclick=()=>{$("#playerState").textContent="STOPPED";$("#usbState").textContent="READY";playing=false};
$("#recBtn").onclick=()=>$("#recBtn").classList.toggle("recording");
$("#pickMusic").onclick=()=>$("#musicFile").click();
$("#musicFile").addEventListener("change",e=>{music=[...e.target.files];idx=0;renderPlaylist();loadTrack()});
function renderPlaylist(){$("#playlist").innerHTML=music.length?music.map((f,i)=>'<div>'+String(i+1)+'. '+f.name+'</div>').join(""):"Playlist kosong"}
function loadTrack(){if(!music[idx])return;$("#playerName").textContent=music[idx].name;$("#playerState").textContent="READY";$("#usbState").textContent="READY"}
$("#play").onclick=()=>{playing=!playing;$("#play").textContent=playing?"▶ PLAY":"Ⅱ PAUSE";$("#playerState").textContent=playing?"PLAYING":"PAUSED";$("#usbState").textContent=playing?"PLAYING":"PAUSED"};
$("#stopMusic").onclick=()=>{playing=false;$("#play").textContent="▶ PLAY";$("#playerState").textContent="STOPPED";$("#usbState").textContent="READY"};
$("#next").onclick=()=>{if(music.length){idx=(idx+1)%music.length;loadTrack();renderPlaylist()}};
$("#prev").onclick=()=>{if(music.length){idx=(idx-1+music.length)%music.length;loadTrack();renderPlaylist()}};
$("#saveScene").onclick=()=>localStorage.setItem("mixerScene",JSON.stringify({channels:$$(".ch-fader").map(x=>x.value),master:$("#masterFader").value}));
$("#recallScene").onclick=()=>{try{const s=JSON.parse(localStorage.getItem("mixerScene"));s.channels.forEach((v,i)=>{const x=$$(".ch-fader")[i];if(x){x.value=v;x.dispatchEvent(new Event("input"))}});$("#masterFader").value=s.master;$("#masterFader").nextElementSibling.value=s.master+"%"}catch{}};
build(16);drawSpectrum();updateMeter(42);$$(".view").forEach((v,i)=>{if(i>0)v.style.display="none"});