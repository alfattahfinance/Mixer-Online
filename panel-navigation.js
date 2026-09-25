(() => {
  "use strict";
  const nav = document.getElementById("bottomNav");
  if (!nav) return;
  const buttons = [...nav.querySelectorAll("[data-nav]")];
  const body = document.body;
  const valid = new Set(["mixer", "player", "fx", "aux", "master", "scene", "setup", "system"]);
  function showPanel(name) {
    if (!valid.has(name)) return;
    body.dataset.panel = name;
    buttons.forEach(button => {
      const active = button.dataset.nav === name;
      button.classList.toggle("active", active);
      button.setAttribute("aria-current", active ? "page" : "false");
    });
    if (name === "scene" || name === "setup") {
      const screenTab = document.querySelector('.screen-tabs [data-screen="' + (name === "scene" ? "SCENE" : "SETUP") + '"]');
      if (screenTab) screenTab.click();
    } else if (name === "mixer") {
      const homeTab = document.querySelector('.screen-tabs [data-screen="HOME"]');
      if (homeTab) homeTab.click();
    }
  }
  nav.addEventListener("click", event => {
    const button = event.target.closest("[data-nav]");
    if (!button) return;
    showPanel(button.dataset.nav);
  });
  showPanel("mixer");
})();