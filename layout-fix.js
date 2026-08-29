/* v20260830-2 — definitive right-side master menu layout */
(function(){
  const PANELS=["bus-fx-masters","output-routing","scene-panel","history-panel","lock-panel","connection-panel","mapper-panel","hardware-test-panel","esp32-sim-panel","usb-audio-panel"];
  function init(){
    const master=document.querySelector(".master"),rack=document.querySelector("#channels");
    if(!master||!rack||master.dataset.sideMenuReady==="2")return;
    const panels=PANELS.map(c=>master.querySelector("."+c)).filter(Boolean);
    if(!panels.length)return;
    master.dataset.sideMenuReady="2";
    const dock=document.createElement("aside");
    dock.className="master-side-dock";
    dock.setAttribute("aria-label","Menu Master");
    dock.innerHTML='<div class="master-side-menu" role="tablist">'+
      '<button type="button" data-tab="panel" class="active">PANEL</button>'+
      '<button type="button" data-tab="aux">AUX / BUS</button>'+
      '<button type="button" data-tab="fx">FX</button>'+
      '<button type="button" data-tab="scenes">SCENES</button>'+
      '<button type="button" data-tab="setup">SETUP</button>'+
      '</div><div class="master-side-content"></div>';
    rack.appendChild(dock);
    const content=dock.querySelector(".master-side-content");
    panels.forEach(p=>{
      const cls=PANELS.find(x=>p.classList.contains(x));
      p.dataset.sideGroup=cls==="bus-fx-masters"?"panel":cls==="output-routing"?"aux":(cls==="scene-panel"||cls==="history-panel")?"scenes":"setup";
      content.appendChild(p);
    });
    const show=tab=>{
      dock.dataset.tab=tab;
      dock.querySelectorAll(".master-side-menu button").forEach(b=>{
        const active=b.dataset.tab===tab;
        b.classList.toggle("active",active);
        b.setAttribute("aria-selected",active?"true":"false");
      });
      content.querySelectorAll("[data-side-group]").forEach(p=>{
        p.hidden=tab==="fx"?p.dataset.sideGroup!=="panel":p.dataset.sideGroup!==tab;
      });
      content.scrollTop=0;
    };
    dock.querySelectorAll(".master-side-menu button").forEach(b=>b.addEventListener("click",()=>show(b.dataset.tab)));
    show("panel");
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
  setTimeout(init,80);setTimeout(init,300);setTimeout(init,800);
})();