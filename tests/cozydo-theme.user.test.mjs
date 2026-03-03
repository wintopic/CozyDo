import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SCRIPT_PATH = path.resolve(__dirname, "..", "cozydo-theme.user.js");
const SCRIPT_SOURCE = readFileSync(SCRIPT_PATH, "utf8");

function createElement(tagName, doc) {
  const element = {
    tagName: String(tagName || "div").toUpperCase(),
    id: "",
    className: "",
    hidden: false,
    textContent: "",
    innerHTML: "",
    parentNode: null,
    children: [],
    style: {},
    dataset: {},
    attributes: new Map(),
    classList: {
      add() {},
      remove() {},
      toggle() {},
      contains() {
        return false;
      },
    },
    appendChild(child) {
      child.parentNode = element;
      element.children.push(child);
      if (child.id) doc._elementsById.set(child.id, child);
      return child;
    },
    prepend(child) {
      child.parentNode = element;
      element.children.unshift(child);
      if (child.id) doc._elementsById.set(child.id, child);
      return child;
    },
    remove() {
      if (element.parentNode) {
        const idx = element.parentNode.children.indexOf(element);
        if (idx >= 0) element.parentNode.children.splice(idx, 1);
      }
      if (element.id) doc._elementsById.delete(element.id);
      element.parentNode = null;
    },
    setAttribute(name, value) {
      element.attributes.set(name, String(value));
      if (name === "id") {
        if (element.id) doc._elementsById.delete(element.id);
        element.id = String(value);
        doc._elementsById.set(element.id, element);
      }
      if (name === "class") element.className = String(value);
    },
    removeAttribute(name) {
      element.attributes.delete(name);
      if (name === "id" && element.id) {
        doc._elementsById.delete(element.id);
        element.id = "";
      }
    },
    addEventListener() {},
    querySelector() {
      return null;
    },
    querySelectorAll() {
      return [];
    },
    closest() {
      return null;
    },
  };
  return element;
}

function createMockDocument({ withHeaderIcons = false } = {}) {
  const doc = {
    readyState: "complete",
    cookie: "",
    _elementsById: new Map(),
    _headerIcons: null,
    addEventListener() {},
    createElement(tagName) {
      return createElement(tagName, doc);
    },
    getElementById(id) {
      return doc._elementsById.get(id) || null;
    },
    querySelector(selector) {
      if (selector === ".d-header-icons") return doc._headerIcons;
      return null;
    },
    querySelectorAll() {
      return [];
    },
  };

  doc.documentElement = createElement("html", doc);
  doc.head = createElement("head", doc);
  doc.body = createElement("body", doc);

  if (withHeaderIcons) {
    doc._headerIcons = createElement("ul", doc);
    doc._headerIcons.className = "d-header-icons";
  }

  return doc;
}

function loadRuntime({ withDiscourse = false, withHeaderIcons = false, localStorageGetThrows = false } = {}) {
  const document = createMockDocument({ withHeaderIcons });
  const windowEventTypes = [];

  const appEventsCalls = { on: [], off: [] };
  const appEventHandlers = new Map();
  const appEvents = {
    on(eventName, handler) {
      appEventsCalls.on.push([eventName, handler]);
      const handlers = appEventHandlers.get(eventName) || [];
      handlers.push(handler);
      appEventHandlers.set(eventName, handlers);
    },
    off(eventName, handler) {
      appEventsCalls.off.push([eventName, handler]);
      const handlers = appEventHandlers.get(eventName);
      if (!handlers) return;
      appEventHandlers.set(
        eventName,
        handlers.filter((item) => item !== handler)
      );
    },
    trigger(eventName, payload) {
      const handlers = appEventHandlers.get(eventName) || [];
      handlers.forEach((handler) => handler(payload));
    },
  };

  const interfaceColorCalls = { dark: 0, light: 0 };
  const interfaceColor = {
    forceDarkMode() {
      interfaceColorCalls.dark += 1;
    },
    forceLightMode() {
      interfaceColorCalls.light += 1;
    },
  };

  const history = {
    pushState() {},
    replaceState() {},
  };

  const windowObj = {
    matchMedia() {
      return { matches: false };
    },
    addEventListener(type) {
      windowEventTypes.push(type);
    },
    removeEventListener() {},
    dispatchEvent() {},
  };

  if (withDiscourse) {
    windowObj.Discourse = {
      lookup(pathName) {
        if (pathName === "service:app-events") return appEvents;
        if (pathName === "service:interface-color") return interfaceColor;
        return null;
      },
    };
  }

  const localStorageMap = new Map();
  const localStorage = {
    getItem(key) {
      if (localStorageGetThrows) throw new Error("localStorage.getItem failed");
      return localStorageMap.has(key) ? localStorageMap.get(key) : null;
    },
    setItem(key, value) {
      localStorageMap.set(key, String(value));
    },
  };

  class MockMutationObserver {
    constructor(callback) {
      this.callback = callback;
      this.target = null;
    }
    observe(target) {
      this.target = target;
    }
    disconnect() {
      this.target = null;
    }
  }

  const context = {
    __LDT_TEST_MODE__: true,
    __LDT_TEST_API__: undefined,
    window: windowObj,
    document,
    location: { pathname: "/latest" },
    navigator: { clipboard: { writeText: async () => {} } },
    localStorage,
    MutationObserver: MockMutationObserver,
    getComputedStyle() {
      return {
        getPropertyValue(name) {
          return name === "--scheme-type" ? "light" : "";
        },
      };
    },
    history,
    Event: class Event {
      constructor(type) {
        this.type = type;
      }
    },
    setTimeout() {
      return 1;
    },
    clearTimeout() {},
    console,
    Date,
    Math,
    JSON,
    Number,
    String,
    Boolean,
    RegExp,
    Array,
    Object,
    Set,
    Map,
    Promise,
    parseInt,
    encodeURIComponent,
    decodeURIComponent,
  };

  context.window.document = document;
  context.window.location = context.location;
  context.window.history = history;
  context.window.setTimeout = context.setTimeout;
  context.window.clearTimeout = context.clearTimeout;

  context.globalThis = context;

  vm.createContext(context);
  vm.runInContext(SCRIPT_SOURCE, context, { filename: "cozydo-theme.user.js" });

  return {
    api: context.__LDT_TEST_API__,
    context,
    document,
    history,
    appEvents,
    windowEventTypes,
    appEventsCalls,
    interfaceColorCalls,
    interfaceColor,
  };
}

test("normalizeTokenValue rejects unsafe or invalid values", () => {
  const { api } = loadRuntime();
  assert.equal(api.normalizeTokenValue("--primary", "#112233"), "#112233");
  assert.equal(api.normalizeTokenValue("--primary", "var(--x)"), "var(--x)");
  assert.equal(api.normalizeTokenValue("--primary", "bad-color"), null);
  assert.equal(api.normalizeTokenValue("--d-border-radius", "8px"), "8px");
  assert.equal(api.normalizeTokenValue("--d-border-radius", "calc(4px + 2px)"), null);
  assert.equal(api.normalizeTokenValue("--primary", "{invalid}"), null);
});

test("buildVarsCSS includes rgb derivatives and d-link-color", () => {
  const { api } = loadRuntime();
  const theme = {
    tokens: { ...api.PRESETS["openai-light"].tokens },
    patches: { radiusScale: 100, shadowIntensity: 100 },
  };

  const css = api.buildVarsCSS(theme);
  assert.match(css, /--primary-rgb: 15, 31, 23 !important;/);
  assert.match(css, /--secondary-rgb: 245, 248, 246 !important;/);
  assert.match(css, /--tertiary-rgb: 16, 163, 127 !important;/);
  assert.match(css, /--d-link-color: #0b8a6a !important;/);
});

test("buildVarsCSS does not emit rgb derivatives for complex unresolved colors", () => {
  const { api } = loadRuntime();
  const theme = {
    tokens: {
      ...api.PRESETS["openai-light"].tokens,
      "--primary": "var(--dynamic-primary)",
      "--secondary": "light-dark(#fff,#000)",
    },
    patches: { radiusScale: 100, shadowIntensity: 100 },
  };

  const css = api.buildVarsCSS(theme);
  assert.doesNotMatch(css, /--primary-rgb:/);
  assert.doesNotMatch(css, /--secondary-rgb:/);
  assert.match(css, /--tertiary-rgb:/);
});

test("syncDiscourseColorMode deduplicates calls through interface-color service", () => {
  const { api } = loadRuntime();
  let darkCalls = 0;
  let lightCalls = 0;
  api.state.interfaceColor = {
    forceDarkMode() {
      darkCalls += 1;
    },
    forceLightMode() {
      lightCalls += 1;
    },
  };

  api.syncDiscourseColorMode("dark");
  api.syncDiscourseColorMode("dark");
  api.syncDiscourseColorMode("light");

  assert.equal(darkCalls, 1);
  assert.equal(lightCalls, 1);
});

test("bootstrap keeps panel lazy (no panel DOM before openPanel)", () => {
  const { api, document } = loadRuntime({ withDiscourse: false, withHeaderIcons: false });
  assert.equal(document.getElementById("linuxdo-theme-panel"), null);
  api.bootstrap();
  assert.equal(document.getElementById("linuxdo-theme-panel"), null);
});

test("bootstrap tolerates localStorage getItem failures", () => {
  const { api } = loadRuntime({ localStorageGetThrows: true });
  assert.doesNotThrow(() => api.bootstrap());
  assert.ok(api.state.config);
});

test("bootstrap binds page:changed via app-events and does not patch history", () => {
  const { api, history, windowEventTypes, appEventsCalls } = loadRuntime({ withDiscourse: true, withHeaderIcons: true });
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;

  api.bootstrap();

  assert.equal(history.pushState, originalPushState);
  assert.equal(history.replaceState, originalReplaceState);
  assert.equal(appEventsCalls.on.length > 0, true);
  assert.equal(appEventsCalls.on[0][0], "page:changed");
  assert.deepEqual(windowEventTypes, []);
});

test("bootstrap is idempotent and does not double-bind page:changed", () => {
  const { api, appEventsCalls } = loadRuntime({ withDiscourse: true, withHeaderIcons: true });
  api.bootstrap();
  api.bootstrap();

  const pageChangedBindings = appEventsCalls.on.filter(([eventName]) => eventName === "page:changed");
  assert.equal(pageChangedBindings.length, 1);
});

test("default settings keep topic links opening in current tab", () => {
  const { api } = loadRuntime({ withDiscourse: true, withHeaderIcons: true });
  api.bootstrap();
  assert.equal(api.state.config.settings.openTopicInNewTab, false);
});

test("page:changed replace-only payload does not break active theme state", () => {
  const { api, appEvents } = loadRuntime({ withDiscourse: true, withHeaderIcons: true });
  api.bootstrap();
  appEvents.trigger("page:changed", { replacedOnlyQueryParams: true, url: "/latest?page=2" });
  assert.equal(api.state.config.activeThemeRef, "preset:claude-light");
});

test("preset auto-switches when discourse interface-color changes", () => {
  const { api, appEvents } = loadRuntime({ withDiscourse: true, withHeaderIcons: true });
  api.bootstrap();

  assert.equal(api.state.config.activeThemeRef, "preset:claude-light");
  appEvents.trigger("interface-color:changed", "dark");
  assert.equal(api.state.config.activeThemeRef, "preset:claude-dark");

  appEvents.trigger("interface-color:changed", "light");
  assert.equal(api.state.config.activeThemeRef, "preset:claude-light");
});

test("interface-color auto mode resolves preset by actual scheme, not event payload order", () => {
  const { api, appEvents, interfaceColor } = loadRuntime({ withDiscourse: true, withHeaderIcons: true });
  api.bootstrap();

  interfaceColor.colorMode = "auto";
  interfaceColor.colorModeIsAuto = true;
  interfaceColor.colorModeIsLight = false;
  interfaceColor.colorModeIsDark = false;

  appEvents.trigger("interface-color:changed", "dark");
  appEvents.trigger("interface-color:changed", "light");

  assert.equal(api.state.config.activeThemeRef, "preset:claude-light");
});
