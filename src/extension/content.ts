// Content script — receives DOM commands from background script via message passing.
// For now this is a stub. DOM commands (click, type, scroll, query) will be added here.

browser.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === "dom-command") {
    // TODO: implement DOM commands (click, type, scroll, query)
    sendResponse({ ok: true });
  }
});
