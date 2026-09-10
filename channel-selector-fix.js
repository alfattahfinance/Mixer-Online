/* Channel selector fix only.
   Scope: selecting a channel card updates the center screen target.
   Does not modify mixer controls, state values, indicators, layout, or audio engine.
*/
(function () {
  "use strict";

  function selectFromCard(card) {
    if (!card) return;
    const raw = card.dataset && card.dataset.ch;
    const ch = Number(raw);
    if (!Number.isInteger(ch) || ch < 1) return;
    if (typeof window.selectScreenChannel !== "function") return;
    window.selectScreenChannel(ch);
  }

  // Capture the channel-card click before control handlers run.
  document.addEventListener("click", function (e) {
    const card = e.target && e.target.closest
      ? e.target.closest(".new-channel-strip[data-ch], .channel-strip[data-ch], .channel[data-ch]")
      : null;
    if (!card) return;

    // Clicking the channel body selects it. Existing input/button behavior remains untouched.
    if (e.target.closest("input, button")) return;
    selectFromCard(card);
  }, true);
})();
