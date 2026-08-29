/* v20260830 — compact master side-menu layout */
(function(){
  const PANEL_CLASSES=["bus-fx-masters","output-routing","scene-panel","history-panel","lock-panel","connection-panel","mapper-panel","hardware-test-panel","esp32-sim-panel","usb-audio-panel"];
  function init(){
    const master=document.querySelector(".master"), rack=document.querySelector("#channels");
    if(!master||!rack||master.dataset.sideMenuReady==="1") return;
    const panels=PANEL_CLASSES.map(c=>master.querySelector("."+c)).filter(Boolean);
    if(!panels.length) return;
    master.dataset.sideMenuReady="1";
    const dock=document.createElement("aside");
    dock.className="master-side-dock";
    dock.innerHTML='<div class="master-side-menu" role="tablist" aria-label="Menu Master">'+
      '<button type="button" data-tab="panel" class="active">PANEL</button>'+
      '<button type="button" data-tab="aux">AUX / BUS</button>'+
      '<button type="button" data-tab="fx">FX</button>'+
      '<button type="button" data-tab="scenes">SCENES</button>'+
      '<button type="button" data-tab="setup">SETUP</button>'+
      '</div><div class="master-side-content"></div>';
    rack.appendChild(dock);
    const content=dock.querySelector(".master-side-content");
    panels.forEach(p=>{
      const c=PANEL_CLASSES.find(x=>p.classList.contains(x));
      p.dataset.sideGroup=(c==="bus-fx-masters"?"panel":c==="output-routing"?"aux":["scene-panel","history-panel"].includes(c)?"scenes":"setup");
      content.appendChild(p);
    });
    function show(tab){
      dock.dataset.open="1"; dock.dataset.tab=tab;
      dock.querySelectorAll("button").forEach(b=>{const on=b.dataset.tab===tab;b.classList.toggle("active",on);b.setAttribute("aria-selected",on?"true":"false")});
      content.querySelectorAll("[data-side-group]").forEach(p=>{
        const g=p.dataset.sideGroup;
        const visible=tab==="fx" ? (g==="panel"||g==="aux") : g===tab;
        p.hidden=!visible;
      });
    }
    dock.querySelectorAll("button").forEach(b=>b.addEventListener("click",()=>show(b.dataset.tab)));
    dock.dataset.open="0";
    content.querySelectorAll("[data-side-group]").forEach(p=>p.hidden=true);
    master.style.height="fit-content";
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
  setTimeout(init,80);setTimeout(init,300);
})();