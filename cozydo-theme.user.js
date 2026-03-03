// ==UserScript==
// @name         CozyDo Theme Studio (Claude/OpenAI)
// @namespace    https://linux.do/
// @version      1.3.0
// @description  CozyDo 论坛主题增强：多风格预设、自定义编辑、JSON 导入导出、右上角入口与可选悬浮按钮
// @author       CozyDo
// @match        https://linux.do/*
// @match        https://*.linux.do/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(() => {
  "use strict";

  const SCRIPT_VERSION = "1.3.0";
  const STORAGE_KEY = "linuxdo_theme_config_v1";
  const STYLE_UI_ID = "linuxdo-theme-ui";
  const STYLE_VARS_ID = "linuxdo-theme-vars";
  const STYLE_PATCH_ID = "linuxdo-theme-patches";
  const PANEL_ID = "linuxdo-theme-panel";
  const OVERLAY_ID = "linuxdo-theme-overlay";
  const FLOATING_BTN_ID = "linuxdo-theme-floating-btn";
  const HEADER_ENTRY_ID = "linuxdo-theme-header-entry";
  const UI_DEBOUNCE_MS = 150;
  const CUSTOM_THEME_ID = "custom-current";
  const LIBRARY_SOURCE_CUSTOM = "custom";
  const LIBRARY_SOURCE_IMPORTED = "imported";
  const DISCOURSE_BIND_TIMEOUT_MS = 8000;
  const DISCOURSE_BIND_INTERVAL_MS = 120;
  const DISCOURSE_EVENT_PAGE_CHANGED = "page:changed";
  const DISCOURSE_EVENT_INTERFACE_COLOR_CHANGED = "interface-color:changed";
  const TOPIC_LINK_NEW_TAB_SELECTOR =
    "a[data-topic-id],a.raw-topic-link,a.badge-posts,a.post-activity,.topic-post-badges a.badge-notification";
  const TOPIC_LINK_NEW_TAB_CONTEXT_SELECTOR =
    ".topic-list,.latest-topic-list-item,.bookmark-list,.categories-topic-list,.latest-topic-list,.top-topic-list";
  const TEST_MODE = globalThis.__LDT_TEST_MODE__ === true;
  const MAX_IMPORT_TEXT_CHARS = 500_000;
  const UNIQUE_THEME_ID_MAX_ATTEMPTS = 60;

  const TOKEN_KEYS = [
    "--primary",
    "--primary-high",
    "--primary-medium",
    "--primary-low",
    "--primary-low-mid",
    "--primary-very-low",
    "--secondary",
    "--tertiary",
    "--tertiary-low",
    "--header_background",
    "--header_primary",
    "--background-color",
    "--d-content-background",
    "--d-unread-notification-background",
    "--d-selected",
    "--d-hover",
    "--link-color",
    "--link-color-hover",
    "--content-border-color",
    "--d-button-default-border",
    "--d-border-radius",
    "--d-border-radius-large",
    "--shadow-card",
    "--shadow-dropdown",
  ];
  const TOKEN_ALIASES = {
    "--tertiary-med-or-tertiary": "--tertiary",
  };
  const LINKED_BACKGROUND_TOKEN = "--d-content-background";
  const EDITABLE_TOKEN_KEYS = TOKEN_KEYS.filter((key) => key !== LINKED_BACKGROUND_TOKEN);
  const CUSTOM_IO_SCHEMA_VERSION = 2;
  const CUSTOM_IO_KIND = "custom-page-config";
  const COLLECTION_IO_SCHEMA_VERSION = 1;
  const COLLECTION_IO_KIND = "theme-collection";
  const TOKEN_META = {
    "--primary": { label: "主体文字", type: "color" },
    "--primary-high": { label: "次级文字（高）", type: "color" },
    "--primary-medium": { label: "次级文字（中）", type: "color" },
    "--primary-low": { label: "弱对比底色（Low）", type: "color" },
    "--primary-low-mid": { label: "弱对比底色（Low Mid）", type: "color" },
    "--primary-very-low": { label: "弱对比底色（Very Low）", type: "color" },
    "--secondary": { label: "页面底色", type: "color" },
    "--tertiary": { label: "品牌强调色", type: "color" },
    "--tertiary-low": { label: "信息条背景", type: "color" },
    "--header_background": { label: "顶部栏背景", type: "color" },
    "--header_primary": { label: "顶部栏文字", type: "color" },
    "--background-color": { label: "全局背景", type: "color" },
    "--d-content-background": { label: "内容容器背景", type: "color" },
    "--d-unread-notification-background": { label: "通知未读背景", type: "color" },
    "--d-selected": { label: "选中态背景", type: "color" },
    "--d-hover": { label: "悬停态背景", type: "color" },
    "--link-color": { label: "链接颜色", type: "color" },
    "--link-color-hover": { label: "链接悬停", type: "color" },
    "--content-border-color": { label: "分隔线颜色", type: "color" },
    "--d-button-default-border": { label: "默认按钮边框", type: "text" },
    "--d-border-radius": { label: "基础圆角", type: "text" },
    "--d-border-radius-large": { label: "大圆角", type: "text" },
    "--shadow-card": { label: "卡片阴影", type: "text" },
    "--shadow-dropdown": { label: "下拉阴影", type: "text" },
  };

  const PRESETS = {
    "claude-light": {
      id: "claude-light",
      name: "Claude Light",
      description: "温暖米色、柔和强调、适合长时间阅读。",
      patchProfile: "claude",
      patchDefaults: { headerGlass: true, topicCardElevation: false, radiusScale: 108, shadowIntensity: 95 },
      tokens: {
        "--primary": "#1f1f1a",
        "--primary-high": "#3f3b33",
        "--primary-medium": "#6f685d",
        "--primary-low": "#ddcdb7",
        "--primary-low-mid": "#b9a98f",
        "--primary-very-low": "#f8f3eb",
        "--secondary": "#f7f3ec",
        "--tertiary": "#b97835",
        "--tertiary-low": "#efe2d1",
        "--header_background": "#f7f3ec",
        "--header_primary": "#1f1f1a",
        "--background-color": "#fbf8f2",
        "--d-content-background": "#fbf8f2",
        "--d-unread-notification-background": "#eee2d1",
        "--d-selected": "#e9dcc8",
        "--d-hover": "rgba(185, 120, 53, 0.14)",
        "--link-color": "#8f5f2b",
        "--link-color-hover": "#71481f",
        "--content-border-color": "#ddcdb7",
        "--d-button-default-border": "1px solid #d7c2a8",
        "--d-border-radius": "11px",
        "--d-border-radius-large": "18px",
        "--shadow-card": "0 8px 26px rgba(45, 36, 24, 0.09)",
        "--shadow-dropdown": "0 10px 28px rgba(45, 36, 24, 0.15)",
      },
    },
    "claude-dark": {
      id: "claude-dark",
      name: "Claude Dark",
      description: "深色暖灰、低刺激对比、偏 Claude 夜间质感。",
      patchProfile: "claude",
      patchDefaults: { headerGlass: true, topicCardElevation: false, radiusScale: 108, shadowIntensity: 115 },
      tokens: {
        "--primary": "#e9e3d9",
        "--primary-high": "#c9c2b8",
        "--primary-medium": "#a69e93",
        "--primary-low": "#2d2720",
        "--primary-low-mid": "#5f5548",
        "--primary-very-low": "#1f1b16",
        "--secondary": "#12110f",
        "--tertiary": "#d99a4f",
        "--tertiary-low": "#2d2418",
        "--header_background": "#161411",
        "--header_primary": "#ece4d8",
        "--background-color": "#181613",
        "--d-content-background": "#181613",
        "--d-unread-notification-background": "#2d241a",
        "--d-selected": "#2d241a",
        "--d-hover": "rgba(217, 154, 79, 0.20)",
        "--link-color": "#e0a35f",
        "--link-color-hover": "#efb97f",
        "--content-border-color": "#2d2720",
        "--d-button-default-border": "1px solid #433826",
        "--d-border-radius": "11px",
        "--d-border-radius-large": "18px",
        "--shadow-card": "0 10px 30px rgba(0, 0, 0, 0.45)",
        "--shadow-dropdown": "0 12px 32px rgba(0, 0, 0, 0.62)",
      },
    },
    "openai-light": {
      id: "openai-light",
      name: "OpenAI Light",
      description: "清爽灰绿底色，OpenAI 风格低饱和与高可读性。",
      patchProfile: "openai",
      patchDefaults: { headerGlass: true, topicCardElevation: false, radiusScale: 100, shadowIntensity: 90 },
      tokens: {
        "--primary": "#0f1f17",
        "--primary-high": "#284034",
        "--primary-medium": "#5b7367",
        "--primary-low": "#cde1d8",
        "--primary-low-mid": "#92ada0",
        "--primary-very-low": "#f1f7f4",
        "--secondary": "#f5f8f6",
        "--tertiary": "#10a37f",
        "--tertiary-low": "#d8efe8",
        "--header_background": "#f5f8f6",
        "--header_primary": "#112018",
        "--background-color": "#fbfdfc",
        "--d-content-background": "#fbfdfc",
        "--d-unread-notification-background": "#dcefe8",
        "--d-selected": "#dcefe8",
        "--d-hover": "rgba(16, 163, 127, 0.14)",
        "--link-color": "#0b8a6a",
        "--link-color-hover": "#076f54",
        "--content-border-color": "#cde1d8",
        "--d-button-default-border": "1px solid #b8d4c8",
        "--d-border-radius": "10px",
        "--d-border-radius-large": "16px",
        "--shadow-card": "0 8px 24px rgba(16, 34, 27, 0.09)",
        "--shadow-dropdown": "0 12px 30px rgba(16, 34, 27, 0.15)",
      },
    },
    "openai-dark": {
      id: "openai-dark",
      name: "OpenAI Dark",
      description: "深色灰绿背景，OpenAI 风格克制对比与绿色强调。",
      patchProfile: "openai",
      patchDefaults: { headerGlass: true, topicCardElevation: false, radiusScale: 100, shadowIntensity: 115 },
      tokens: {
        "--primary": "#e7f2ed",
        "--primary-high": "#bed3c8",
        "--primary-medium": "#8ba79a",
        "--primary-low": "#1f3a30",
        "--primary-low-mid": "#4f7063",
        "--primary-very-low": "#12211c",
        "--secondary": "#0d1512",
        "--tertiary": "#10a37f",
        "--tertiary-low": "#16352b",
        "--header_background": "#101a16",
        "--header_primary": "#e9f3ee",
        "--background-color": "#0f1915",
        "--d-content-background": "#0f1915",
        "--d-unread-notification-background": "#173128",
        "--d-selected": "#173128",
        "--d-hover": "rgba(16, 163, 127, 0.22)",
        "--link-color": "#35c59f",
        "--link-color-hover": "#67d8b7",
        "--content-border-color": "#1f3a30",
        "--d-button-default-border": "1px solid #275144",
        "--d-border-radius": "10px",
        "--d-border-radius-large": "16px",
        "--shadow-card": "0 10px 30px rgba(0, 0, 0, 0.45)",
        "--shadow-dropdown": "0 12px 34px rgba(0, 0, 0, 0.60)",
      },
    },
    "trae-light": {
      id: "trae-light",
      name: "Trae Light",
      description: "参考 forum.trae.cn：深色顶栏 + 浅灰页面 + 明亮绿色强调。",
      patchProfile: "trae",
      patchDefaults: { headerGlass: false, topicCardElevation: false, radiusScale: 98, shadowIntensity: 92 },
      tokens: {
        "--primary": "#1a1b1d",
        "--primary-high": "#5b5e65",
        "--primary-medium": "#878b93",
        "--primary-low": "#e7e8e9",
        "--primary-low-mid": "#b7b9be",
        "--primary-very-low": "#f8f8f9",
        "--secondary": "#f3f4f5",
        "--tertiary": "#0ab861",
        "--tertiary-low": "#d2fce7",
        "--header_background": "#1a1b1d",
        "--header_primary": "#ffffff",
        "--background-color": "#f8f8f9",
        "--d-content-background": "#f8f8f9",
        "--d-unread-notification-background": "#eafef4",
        "--d-selected": "#dfe1e5",
        "--d-hover": "#e6e8eb",
        "--link-color": "#0ab861",
        "--link-color-hover": "#078a49",
        "--content-border-color": "#e7e8e9",
        "--d-button-default-border": "1px solid #d2d5d9",
        "--d-border-radius": "10px",
        "--d-border-radius-large": "16px",
        "--shadow-card": "0 4px 14px rgba(0, 0, 0, 0.15)",
        "--shadow-dropdown": "0 2px 12px rgba(0, 0, 0, 0.10)",
      },
    },
    "trae-dark": {
      id: "trae-dark",
      name: "Trae Dark",
      description: "Trae 风格深色版：低亮度石墨背景 + 绿色交互强调。",
      patchProfile: "trae",
      patchDefaults: { headerGlass: false, topicCardElevation: false, radiusScale: 98, shadowIntensity: 112 },
      tokens: {
        "--primary": "#e8ebee",
        "--primary-high": "#c5cbd2",
        "--primary-medium": "#919aa5",
        "--primary-low": "#2a323c",
        "--primary-low-mid": "#5b6774",
        "--primary-very-low": "#151a20",
        "--secondary": "#111417",
        "--tertiary": "#0ab861",
        "--tertiary-low": "#173a2b",
        "--header_background": "#161a1e",
        "--header_primary": "#f7f9fb",
        "--background-color": "#0e1114",
        "--d-content-background": "#0e1114",
        "--d-unread-notification-background": "#1a2e25",
        "--d-selected": "#1e252d",
        "--d-hover": "rgba(15, 220, 120, 0.16)",
        "--link-color": "#2fdc8a",
        "--link-color-hover": "#6bf0b0",
        "--content-border-color": "#2a323c",
        "--d-button-default-border": "1px solid #34404c",
        "--d-border-radius": "10px",
        "--d-border-radius-large": "16px",
        "--shadow-card": "0 10px 30px rgba(0, 0, 0, 0.42)",
        "--shadow-dropdown": "0 12px 32px rgba(0, 0, 0, 0.58)",
      },
    },
  };

  const DEFAULT_PATCHES = {
    headerGlass: true,
    topicCardElevation: false,
    radiusScale: 100,
    shadowIntensity: 100,
  };
  const DEFAULT_SETTINGS = {
    enableFloatingButton: false,
    openTopicInNewTab: false,
    headerGlass: DEFAULT_PATCHES.headerGlass,
    topicCardElevation: DEFAULT_PATCHES.topicCardElevation,
    radiusScale: DEFAULT_PATCHES.radiusScale,
    shadowIntensity: DEFAULT_PATCHES.shadowIntensity,
  };
  const SECTION_LABELS = {
    "all-themes": "全部主题",
    custom: "自定义",
    "import-export": "导入导出",
    settings: "设置",
  };
  const SOURCE_LABELS = {
    [LIBRARY_SOURCE_CUSTOM]: "自定义",
    [LIBRARY_SOURCE_IMPORTED]: "导入",
  };
  const DISCOURSE_THEME_ICON_VIEWBOX = "0 0 576 512";
  const DISCOURSE_THEME_ICON_PATH = "M339.3 367.1c27.3-3.9 51.9-19.4 67.2-42.9L568.2 74.1c12.6-19.5 9.4-45.3-7.6-61.2S517.7-4.4 499.1 9.6L262.4 187.2c-24 18-38.2 46.1-38.4 76.1L339.3 367.1zm-19.6 25.4l-116-104.4C143.9 290.3 96 339.6 96 400c0 3.9 .2 7.8 .6 11.6C98.4 429.1 86.4 448 68.8 448L64 448c-17.7 0-32 14.3-32 32s14.3 32 32 32l144 0c61.9 0 112-50.1 112-112c0-2.5-.1-5-.2-7.5z";
  const buildThemeIconSvg = (className = "d-icon") =>
    `<svg${className ? ` class="${className}"` : ""} width="1em" height="1em" viewBox="${DISCOURSE_THEME_ICON_VIEWBOX}" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" d="${DISCOURSE_THEME_ICON_PATH}"/></svg>`;

  const state = {
    config: null,
    uiStyle: null,
    varsStyle: null,
    patchStyle: null,
    lastVarsCSS: "",
    lastPatchCSS: "",
    lastAppliedThemeSignature: "",
    panel: null,
    overlay: null,
    floatingBtn: null,
    panelStatusEl: null,
    activeSection: "all-themes",
    isPanelOpen: false,
    updateTimer: null,
    syncEntryTimer: null,
    headerIconsObserver: null,
    headerIconsObserverTarget: null,
    discourseBindTimer: null,
    discourseBindStartAt: 0,
    discourseServicesBound: false,
    discourseBindWarned: false,
    appEvents: null,
    interfaceColor: null,
    onPageChangedHandler: null,
    onInterfaceColorChangedHandler: null,
    onTopicLinkClickCapture: null,
    isTopicLinkNewTabBound: false,
    isEscBound: false,
    isBootstrapped: false,
    lastExportText: "",
    customThemeDraftName: "我的主题",
    lastForcedForumMode: "",
  };

  const UI_CSS = `
#${FLOATING_BTN_ID}{position:fixed;right:20px;bottom:20px;z-index:10012;width:44px;height:44px;border-radius:999px;border:1px solid var(--content-border-color);background:var(--secondary);color:var(--primary);box-shadow:var(--shadow-dropdown);display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:18px;}
#${FLOATING_BTN_ID}:hover{background:var(--d-hover);}#${OVERLAY_ID}{position:fixed;inset:0;z-index:10010;background:rgba(0,0,0,.35);backdrop-filter:blur(1px);}#${PANEL_ID}{position:fixed;right:16px;top:72px;width:min(760px,calc(100vw - 32px));max-height:calc(100vh - 92px);overflow:auto;z-index:10011;background:var(--secondary);color:var(--primary);border:1px solid var(--content-border-color);border-radius:14px;box-shadow:var(--shadow-dropdown);}#${PANEL_ID}[hidden],#${OVERLAY_ID}[hidden]{display:none!important;}#${PANEL_ID} .ldt-header{position:sticky;top:0;z-index:2;display:flex;justify-content:space-between;align-items:center;padding:12px 16px;border-bottom:1px solid var(--content-border-color);background:var(--secondary);}#${PANEL_ID} .ldt-title-wrap h3{margin:0;font-size:16px;}#${PANEL_ID} .ldt-title-wrap p{margin:4px 0 0;color:var(--primary-medium);font-size:12px;}#${PANEL_ID} .ldt-close{border:1px solid var(--content-border-color);border-radius:8px;background:var(--secondary);color:var(--primary);cursor:pointer;width:30px;height:30px;}#${PANEL_ID} .ldt-tabs{display:flex;gap:8px;padding:12px 16px 0;flex-wrap:wrap;}#${PANEL_ID} .ldt-tab{border:1px solid var(--content-border-color);border-radius:10px;background:var(--secondary);color:var(--primary);padding:6px 10px;cursor:pointer;font-size:12px;}#${PANEL_ID} .ldt-tab.--active{background:var(--d-selected);border-color:var(--tertiary);}#${PANEL_ID} .ldt-sections{padding:12px 16px 16px;}#${PANEL_ID} .ldt-section[hidden]{display:none!important;}#${PANEL_ID} .ldt-preset-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;}#${PANEL_ID} .ldt-preset-card{border:1px solid var(--content-border-color);border-radius:12px;padding:10px;display:flex;flex-direction:column;gap:8px;background:var(--d-content-background);}#${PANEL_ID} .ldt-preset-card.--active{border-color:var(--tertiary);box-shadow:0 0 0 1px var(--tertiary);}#${PANEL_ID} .ldt-preset-card h4{margin:0;font-size:14px;}#${PANEL_ID} .ldt-preset-card p{margin:0;color:var(--primary-medium);font-size:12px;line-height:1.35;}#${PANEL_ID} .ldt-badge{display:inline-flex;align-self:flex-start;font-size:11px;padding:2px 8px;border-radius:999px;background:var(--d-selected);color:var(--primary-high);}#${PANEL_ID} .ldt-btn{border:1px solid var(--content-border-color);border-radius:10px;background:var(--secondary);color:var(--primary);cursor:pointer;font-size:12px;padding:6px 10px;}#${PANEL_ID} .ldt-btn.--primary{border-color:var(--tertiary);background:var(--tertiary);color:var(--secondary);}#${PANEL_ID} .ldt-btn-row{display:flex;gap:8px;flex-wrap:wrap;}#${PANEL_ID} .ldt-field-grid{display:grid;gap:10px;}#${PANEL_ID} .ldt-group{border:1px solid var(--content-border-color);border-radius:12px;padding:10px;}#${PANEL_ID} .ldt-group h4{margin:0 0 8px;font-size:13px;}#${PANEL_ID} .ldt-group small{color:var(--primary-medium);}#${PANEL_ID} .ldt-token-row{display:grid;grid-template-columns:minmax(130px,1fr) minmax(90px,120px) minmax(170px,1.8fr) auto;gap:8px;align-items:center;margin-bottom:8px;}#${PANEL_ID} .ldt-token-row:last-child{margin-bottom:0;}#${PANEL_ID} .ldt-token-row label{margin:0;color:var(--primary-high);font-size:12px;}#${PANEL_ID} .ldt-token-row input[type="color"]{width:100%;height:32px;margin:0;padding:0;border-radius:8px;}#${PANEL_ID} .ldt-token-row input[type="text"],#${PANEL_ID} textarea,#${PANEL_ID} input[type="range"]{width:100%;margin:0;}#${PANEL_ID} .ldt-token-row input[type="text"]{height:32px;}#${PANEL_ID} .ldt-checkbox{display:flex;align-items:center;gap:8px;}#${PANEL_ID} .ldt-inline{display:flex;align-items:center;gap:8px;}#${PANEL_ID} .ldt-inline input[type="range"]{max-width:240px;}#${PANEL_ID} .ldt-value{min-width:48px;text-align:right;font-size:12px;color:var(--primary-medium);}#${PANEL_ID} textarea{min-height:180px;resize:vertical;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:12px;}#${PANEL_ID} .ldt-footer{position:sticky;bottom:0;border-top:1px solid var(--content-border-color);background:var(--secondary);padding:10px 16px;}#${PANEL_ID} .ldt-status{margin:0;font-size:12px;color:var(--primary-medium);min-height:1em;}#${PANEL_ID} .ldt-status.--error{color:var(--danger,#e5484d);}#${HEADER_ENTRY_ID} .linuxdo-theme-header-btn{border:0;background:transparent;}#${HEADER_ENTRY_ID} .linuxdo-theme-header-btn .d-icon{width:1em;height:1em;}@media(max-width:820px){#${PANEL_ID}{right:8px;left:8px;top:60px;width:auto;max-height:calc(100vh - 72px);}#${PANEL_ID} .ldt-token-row{grid-template-columns:1fr;}}
`;

  function safeClone(value) {
    if (typeof globalThis.structuredClone === "function") {
      try {
        return globalThis.structuredClone(value);
      } catch {
        // fallback below
      }
    }
    if (value === undefined) return undefined;
    return JSON.parse(JSON.stringify(value));
  }

  const clone = (v) => safeClone(v);
  const nowISO = () => new Date().toISOString();
  const clamp = (n, min, max) => (Number.isNaN(n) ? min : Math.max(min, Math.min(max, n)));
  const makePresetThemeRef = (presetId) => `preset:${presetId}`;
  const makeLibraryThemeRef = (themeId) => `library:${themeId}`;

  function safeJsonParse(text, fallback = null) {
    if (typeof text !== "string") return fallback;
    try {
      return JSON.parse(text);
    } catch {
      return fallback;
    }
  }

  function safeStorageGetItem(key) {
    try {
      return localStorage.getItem(key);
    } catch (error) {
      console.warn("[linuxdo-theme] failed to read from localStorage", error);
      return null;
    }
  }

  function runSafely(label, fn) {
    try {
      return fn();
    } catch (error) {
      console.error(`[linuxdo-theme] ${label} failed`, error);
      return undefined;
    }
  }

  function clearStateTimer(timerKey) {
    const timerId = state[timerKey];
    if (!timerId) return;
    clearTimeout(timerId);
    state[timerKey] = null;
  }

  function createDefaultConfig() {
    return {
      schemaVersion: 1,
      activePresetId: null,
      activeThemeRef: null,
      themeLibrary: [],
      customTheme: { name: "我的主题", basePreset: null, tokens: {}, patches: clone(DEFAULT_PATCHES) },
      settings: clone(DEFAULT_SETTINGS),
      lastUpdatedAt: nowISO(),
    };
  }

  function isFrontendRoute() {
    return !/^\/admin(?:\/|$)/.test(location.pathname);
  }

  function getDiscourseServiceSchemeType() {
    const service = state.interfaceColor;
    if (!service) return null;
    if (service.colorModeIsDark === true || service.darkModeForced === true) return "dark";
    if (service.colorModeIsLight === true || service.lightModeForced === true) return "light";
    const mode = typeof service.colorMode === "string" ? service.colorMode.trim().toLowerCase() : "";
    return mode === "dark" || mode === "light" ? mode : null;
  }

  function getSchemeType() {
    const serviceSchemeType = getDiscourseServiceSchemeType();
    if (serviceSchemeType) return serviceSchemeType;
    let type = "";
    try {
      type = getComputedStyle(document.documentElement).getPropertyValue("--scheme-type").trim().toLowerCase();
    } catch {
      type = "";
    }
    if (type === "dark" || type === "light") return type;
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  function getPresetSchemeTypeByPresetId(presetId) {
    if (typeof presetId !== "string") return null;
    if (presetId.endsWith("-dark")) return "dark";
    if (presetId.endsWith("-light")) return "light";
    return null;
  }

  function getMatchedPresetIdByScheme(presetId, targetSchemeType) {
    if (!isPresetId(presetId)) return null;
    if (targetSchemeType !== "dark" && targetSchemeType !== "light") return null;
    const suffixMatch = presetId.match(/-(dark|light)$/);
    if (!suffixMatch) return null;
    if (suffixMatch[1] === targetSchemeType) return presetId;
    const baseId = presetId.slice(0, -suffixMatch[0].length);
    const candidate = `${baseId}-${targetSchemeType}`;
    return isPresetId(candidate) ? candidate : null;
  }

  function syncDiscourseColorMode(mode) {
    if (mode !== "dark" && mode !== "light") return;
    if (state.lastForcedForumMode === mode) return;
    const service = state.interfaceColor;
    if (!service) return;
    try {
      if (mode === "dark" && typeof service.forceDarkMode === "function") {
        service.forceDarkMode({ flipStylesheets: true });
      } else if (mode === "light" && typeof service.forceLightMode === "function") {
        service.forceLightMode({ flipStylesheets: true });
      } else {
        return;
      }
      state.lastForcedForumMode = mode;
    } catch (error) {
      if (!state.discourseBindWarned) {
        state.discourseBindWarned = true;
        console.warn("[linuxdo-theme] Failed to sync interface color mode via service:interface-color", error);
      }
    }
  }

  const getDefaultPresetId = () => (getSchemeType() === "dark" ? "claude-dark" : "claude-light");
  const isPresetId = (id) => Object.prototype.hasOwnProperty.call(PRESETS, id);
  const isThemeId = (id) => typeof id === "string" && /^[a-z0-9][a-z0-9-]{1,63}$/.test(id);
  const normalizeThemeName = (name, fallback = "我的主题") => {
    if (typeof name !== "string") return fallback;
    const trimmed = name.trim().slice(0, 80);
    return trimmed || fallback;
  };
  function parseThemeRef(ref) {
    if (typeof ref !== "string") return null;
    if (ref.startsWith("preset:")) {
      const presetId = ref.slice(7);
      if (!isPresetId(presetId)) return null;
      return { kind: "preset", id: presetId };
    }
    if (ref.startsWith("library:")) {
      const themeId = ref.slice(8);
      if (!isThemeId(themeId)) return null;
      return { kind: "library", id: themeId };
    }
    return null;
  }

  function isSafeCssValue(value, maxLen = 180) {
    return typeof value === "string" && value.length > 0 && value.length <= maxLen && !/[{};<>\n\r]/.test(value);
  }

  function isColorValue(value) {
    if (!isSafeCssValue(value, 120)) return false;
    const trimmedValue = value.trim();
    return (
      /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(trimmedValue) ||
      /^(?:rgb|rgba|hsl|hsla|oklch|oklab|lab|lch)\(\s*[^)]+\)$/.test(trimmedValue) ||
      /^var\(--[a-zA-Z0-9_-]+\)$/.test(trimmedValue) ||
      /^light-dark\(\s*[^)]+\)$/.test(trimmedValue)
    );
  }

  function normalizeTokenValue(token, rawValue) {
    if (typeof rawValue !== "string") return null;
    const value = rawValue.trim();
    if (!value || !isSafeCssValue(value)) return null;
    const meta = TOKEN_META[token];
    if (!meta) return null;
    if (meta.type === "color" && !isColorValue(value)) return null;
    if (token === "--d-button-default-border" && !/^(none|[0-9.]+px\s+(solid|dashed|dotted)\s+.+)$/i.test(value)) return null;
    if ((token === "--d-border-radius" || token === "--d-border-radius-large") && !/^(0|[0-9.]+px)$/.test(value)) return null;
    if ((token === "--shadow-card" || token === "--shadow-dropdown") && value.length > 120) return null;
    return value;
  }

  function normalizeTokens(rawTokens) {
    const out = {};
    if (!rawTokens || typeof rawTokens !== "object") return out;
    TOKEN_KEYS.forEach((key) => {
      if (!Object.prototype.hasOwnProperty.call(rawTokens, key)) return;
      const value = normalizeTokenValue(key, rawTokens[key]);
      if (value !== null) out[key] = value;
    });
    Object.keys(TOKEN_ALIASES).forEach((aliasKey) => {
      if (!Object.prototype.hasOwnProperty.call(rawTokens, aliasKey)) return;
      const targetKey = TOKEN_ALIASES[aliasKey];
      if (Object.prototype.hasOwnProperty.call(out, targetKey)) return;
      const value = normalizeTokenValue(targetKey, rawTokens[aliasKey]);
      if (value !== null) out[targetKey] = value;
    });
    return syncLinkedBackgroundToken(out);
  }

  function syncLinkedBackgroundToken(tokens) {
    if (!tokens || typeof tokens !== "object") return tokens;
    const backgroundValue = normalizeTokenValue("--background-color", tokens["--background-color"]);
    if (backgroundValue !== null) tokens[LINKED_BACKGROUND_TOKEN] = backgroundValue;
    else delete tokens[LINKED_BACKGROUND_TOKEN];
    return tokens;
  }

  function normalizePatches(raw, fallback = DEFAULT_PATCHES) {
    const base = {
      headerGlass: !!fallback.headerGlass,
      topicCardElevation: !!fallback.topicCardElevation,
      radiusScale: clamp(parseInt(fallback.radiusScale, 10), 60, 160),
      shadowIntensity: clamp(parseInt(fallback.shadowIntensity, 10), 0, 200),
    };
    if (!raw || typeof raw !== "object") return base;
    if (typeof raw.headerGlass === "boolean") base.headerGlass = raw.headerGlass;
    if (typeof raw.topicCardElevation === "boolean") base.topicCardElevation = raw.topicCardElevation;
    if (raw.radiusScale !== undefined) base.radiusScale = clamp(parseInt(raw.radiusScale, 10), 60, 160);
    if (raw.shadowIntensity !== undefined) base.shadowIntensity = clamp(parseInt(raw.shadowIntensity, 10), 0, 200);
    return base;
  }

  function normalizeSettings(raw, fallback = DEFAULT_SETTINGS) {
    const base = {
      enableFloatingButton: !!fallback?.enableFloatingButton,
      openTopicInNewTab: !!fallback?.openTopicInNewTab,
      headerGlass: !!fallback?.headerGlass,
      topicCardElevation: !!fallback?.topicCardElevation,
      radiusScale: clamp(parseInt(fallback?.radiusScale, 10), 60, 160),
      shadowIntensity: clamp(parseInt(fallback?.shadowIntensity, 10), 0, 200),
    };
    if (!raw || typeof raw !== "object") return base;
    if (typeof raw.enableFloatingButton === "boolean") base.enableFloatingButton = raw.enableFloatingButton;
    if (typeof raw.openTopicInNewTab === "boolean") base.openTopicInNewTab = raw.openTopicInNewTab;
    if (typeof raw.headerGlass === "boolean") base.headerGlass = raw.headerGlass;
    if (typeof raw.topicCardElevation === "boolean") base.topicCardElevation = raw.topicCardElevation;
    if (raw.radiusScale !== undefined) base.radiusScale = clamp(parseInt(raw.radiusScale, 10), 60, 160);
    if (raw.shadowIntensity !== undefined) base.shadowIntensity = clamp(parseInt(raw.shadowIntensity, 10), 0, 200);
    return base;
  }

  function getTokenHardFallback(tokenKey) {
    if (tokenKey === "--d-button-default-border") return "1px solid #999999";
    if (tokenKey === "--d-border-radius") return "10px";
    if (tokenKey === "--d-border-radius-large") return "16px";
    if (tokenKey === "--shadow-card" || tokenKey === "--shadow-dropdown") return "none";
    return "#000000";
  }

  function repairPresetRegistry() {
    const presetIds = Object.keys(PRESETS);
    if (!presetIds.length) return;
    const fallbackPreset = PRESETS[presetIds[0]];
    const fallbackTokens = normalizeTokens(fallbackPreset?.tokens);
    presetIds.forEach((presetId) => {
      const preset = PRESETS[presetId];
      if (!preset || typeof preset !== "object") return;
      preset.id = presetId;
      if (typeof preset.name !== "string" || !preset.name.trim()) preset.name = presetId;
      if (typeof preset.description !== "string") preset.description = "";
      if (typeof preset.patchProfile !== "string" || !preset.patchProfile.trim()) preset.patchProfile = "custom";

      const normalizedTokens = normalizeTokens({ ...fallbackTokens, ...(preset.tokens || {}) });
      const repairedTokens = {};
      TOKEN_KEYS.forEach((tokenKey) => {
        repairedTokens[tokenKey] = normalizedTokens[tokenKey] || fallbackTokens[tokenKey] || getTokenHardFallback(tokenKey);
      });
      syncLinkedBackgroundToken(repairedTokens);
      preset.tokens = repairedTokens;
      preset.patchDefaults = normalizePatches(preset.patchDefaults, DEFAULT_PATCHES);
    });
  }

  function getThemeEntryByIdFromConfig(config, themeId) {
    if (!config || !Array.isArray(config.themeLibrary)) return null;
    return config.themeLibrary.find((entry) => entry && entry.id === themeId) || null;
  }

  function upsertThemeEntryInConfig(config, entry) {
    if (!config || !entry) return;
    if (!Array.isArray(config.themeLibrary)) config.themeLibrary = [];
    const index = config.themeLibrary.findIndex((item) => item && item.id === entry.id);
    if (index >= 0) config.themeLibrary[index] = entry;
    else config.themeLibrary.push(entry);
  }

  function normalizeThemeEntry(rawEntry, fallbackPresetId, fallbackSettings, fallbackId) {
    if (!rawEntry || typeof rawEntry !== "object") return null;
    const basePreset = isPresetId(rawEntry.basePreset) ? rawEntry.basePreset : fallbackPresetId;
    if (!isPresetId(basePreset)) return null;
    const preset = PRESETS[basePreset];
    const source = rawEntry.source === LIBRARY_SOURCE_CUSTOM ? LIBRARY_SOURCE_CUSTOM : LIBRARY_SOURCE_IMPORTED;
    const fallbackName = source === LIBRARY_SOURCE_CUSTOM ? "我的主题" : "导入主题";
    const id = isThemeId(rawEntry.id) ? rawEntry.id : fallbackId;
    if (!isThemeId(id)) return null;
    return {
      id,
      name: normalizeThemeName(rawEntry.name, fallbackName),
      source,
      basePreset,
      tokens: normalizeTokens(rawEntry.tokens),
      patches: normalizePatches(rawEntry.patches, preset.patchDefaults || DEFAULT_PATCHES),
      settings: normalizeSettings(rawEntry.settings, fallbackSettings),
      createdAt: typeof rawEntry.createdAt === "string" ? rawEntry.createdAt : nowISO(),
      updatedAt: typeof rawEntry.updatedAt === "string" ? rawEntry.updatedAt : nowISO(),
    };
  }

  function syncCustomThemeToConfig(config) {
    if (!config || typeof config !== "object") return null;
    if (!Array.isArray(config.themeLibrary)) config.themeLibrary = [];
    const fallbackPresetId = isPresetId(config.customTheme?.basePreset)
      ? config.customTheme.basePreset
      : isPresetId(config.activePresetId)
        ? config.activePresetId
        : getDefaultPresetId();
    const preset = PRESETS[fallbackPresetId];
    config.customTheme = {
      name: "我的主题",
      basePreset: fallbackPresetId,
      tokens: normalizeTokens(config.customTheme?.tokens),
      patches: normalizePatches(config.customTheme?.patches, preset.patchDefaults || DEFAULT_PATCHES),
    };
    const existing = getThemeEntryByIdFromConfig(config, CUSTOM_THEME_ID);
    const customEntry = normalizeThemeEntry(
      {
        id: CUSTOM_THEME_ID,
        source: LIBRARY_SOURCE_CUSTOM,
        name: config.customTheme.name,
        basePreset: config.customTheme.basePreset,
        tokens: config.customTheme.tokens,
        patches: config.customTheme.patches,
        settings: config.settings,
        createdAt: existing?.createdAt || nowISO(),
        updatedAt: nowISO(),
      },
      fallbackPresetId,
      config.settings,
      CUSTOM_THEME_ID
    );
    upsertThemeEntryInConfig(config, customEntry);
    return customEntry;
  }

  function resolveActiveThemeRef(config, rawRef, fallbackPresetId) {
    const parsed = parseThemeRef(rawRef);
    if (parsed?.kind === "preset") return makePresetThemeRef(parsed.id);
    if (parsed?.kind === "library" && getThemeEntryByIdFromConfig(config, parsed.id)) return makeLibraryThemeRef(parsed.id);
    return makePresetThemeRef(fallbackPresetId);
  }

  function normalizeConfig(rawConfig) {
    const base = createDefaultConfig();
    const raw = rawConfig && typeof rawConfig === "object" ? rawConfig : createDefaultConfig();
    const fallbackPresetId = isPresetId(raw.activePresetId) ? raw.activePresetId : getDefaultPresetId();
    base.activePresetId = fallbackPresetId;
    base.settings = normalizeSettings(raw.settings, DEFAULT_SETTINGS);
    if (raw.customTheme && typeof raw.customTheme === "object") {
      base.customTheme.name = normalizeThemeName(raw.customTheme.name, "我的主题");
      if (isPresetId(raw.customTheme.basePreset)) base.customTheme.basePreset = raw.customTheme.basePreset;
      base.customTheme.tokens = normalizeTokens(raw.customTheme.tokens);
      const customPreset = PRESETS[isPresetId(base.customTheme.basePreset) ? base.customTheme.basePreset : fallbackPresetId];
      base.customTheme.patches = normalizePatches(raw.customTheme.patches, customPreset.patchDefaults || DEFAULT_PATCHES);
    } else {
      const preset = PRESETS[fallbackPresetId];
      base.customTheme.patches = normalizePatches(null, preset.patchDefaults || DEFAULT_PATCHES);
    }
    if (Array.isArray(raw.themeLibrary)) {
      const seen = new Set();
      base.themeLibrary = raw.themeLibrary
        .map((entry, index) =>
          normalizeThemeEntry(entry, fallbackPresetId, base.settings, `imported-${String(index + 1).padStart(3, "0")}`)
        )
        .filter((entry) => {
          if (!entry || seen.has(entry.id)) return false;
          seen.add(entry.id);
          return true;
        });
    }
    syncCustomThemeToConfig(base);
    base.activeThemeRef = resolveActiveThemeRef(base, raw.activeThemeRef, fallbackPresetId);
    if (!raw.activeThemeRef && isPresetId(raw.activePresetId)) base.activeThemeRef = makePresetThemeRef(raw.activePresetId);
    const activeRef = parseThemeRef(base.activeThemeRef);
    if (activeRef?.kind === "preset") {
      base.activePresetId = activeRef.id;
    } else if (activeRef?.kind === "library") {
      const activeEntry = getThemeEntryByIdFromConfig(base, activeRef.id);
      if (activeEntry) base.activePresetId = activeEntry.basePreset;
    }
    base.lastUpdatedAt = typeof raw.lastUpdatedAt === "string" ? raw.lastUpdatedAt : nowISO();
    return base;
  }

  function migrateConfig(raw) {
    if (!raw || typeof raw !== "object") return null;
    if (raw.schemaVersion === 1) return normalizeConfig(raw);
    if (raw.version === 1 && raw.config) return normalizeConfig({ schemaVersion: 1, ...raw.config });
    return null;
  }

  function loadConfig() {
    const fallback = normalizeConfig(createDefaultConfig());
    const raw = safeStorageGetItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = safeJsonParse(raw, null);
    if (!parsed) return fallback;
    return migrateConfig(parsed) || fallback;
  }

  function saveConfig() {
    if (!state.config || typeof state.config !== "object") {
      setStatus("配置状态异常，已跳过写入。", true);
      return;
    }
    try {
      state.config.lastUpdatedAt = nowISO();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.config));
    } catch (error) {
      console.error("[linuxdo-theme] failed to persist config", error);
      setStatus("配置写入失败，请检查浏览器存储配额。", true);
    }
  }

  function getThemeEntryById(themeId) {
    return getThemeEntryByIdFromConfig(state.config, themeId);
  }

  function upsertThemeEntry(entry) {
    upsertThemeEntryInConfig(state.config, entry);
  }

  function syncCustomThemeToLibrary() {
    const entry = syncCustomThemeToConfig(state.config);
    if (!entry) return;
    entry.updatedAt = nowISO();
    upsertThemeEntry(entry);
  }

  function syncSettingsToActiveTheme() {
    state.config.settings = normalizeSettings(state.config.settings, DEFAULT_SETTINGS);
  }

  function resolveActiveThemeSelection(config = state.config) {
    const fallbackPresetId = isPresetId(config?.activePresetId) ? config.activePresetId : getDefaultPresetId();
    const parsed = parseThemeRef(config?.activeThemeRef);
    if (parsed?.kind === "library") {
      const entry = getThemeEntryByIdFromConfig(config, parsed.id);
      if (entry) return { kind: "library", themeRef: makeLibraryThemeRef(entry.id), presetId: entry.basePreset, entry };
    }
    if (parsed?.kind === "preset") return { kind: "preset", themeRef: makePresetThemeRef(parsed.id), presetId: parsed.id, preset: PRESETS[parsed.id] };
    return { kind: "preset", themeRef: makePresetThemeRef(fallbackPresetId), presetId: fallbackPresetId, preset: PRESETS[fallbackPresetId] };
  }

  const getActivePresetId = () => resolveActiveThemeSelection().presetId;

  function getEffectiveTheme() {
    const selection = resolveActiveThemeSelection();
    const presetId = selection.presetId;
    const preset = PRESETS[presetId];
    const tokens = syncLinkedBackgroundToken(
      selection.kind === "library" ? { ...preset.tokens, ...selection.entry.tokens } : { ...preset.tokens }
    );
    const settings = normalizeSettings(state.config.settings, DEFAULT_SETTINGS);
    const patches = normalizePatches(settings, DEFAULT_PATCHES);
    return {
      presetId,
      preset,
      tokens,
      patches,
      settings,
      patchProfile: preset.patchProfile,
      source: selection.kind,
      themeRef: selection.themeRef,
      themeId: selection.kind === "library" ? selection.entry.id : null,
    };
  }

  function getEditableCustomTheme() {
    const presetId = getCustomThemePresetId();
    const preset = PRESETS[presetId];
    return {
      presetId,
      preset,
      tokens: syncLinkedBackgroundToken({ ...preset.tokens, ...state.config.customTheme.tokens }),
      patches: normalizePatches(state.config.customTheme.patches, preset.patchDefaults || DEFAULT_PATCHES),
    };
  }

  function ensureStyles() {
    if (!state.uiStyle) {
      state.uiStyle = document.getElementById(STYLE_UI_ID) || document.createElement("style");
      state.uiStyle.id = STYLE_UI_ID;
      if (!state.uiStyle.parentNode) (document.head || document.documentElement).appendChild(state.uiStyle);
      if (state.uiStyle.textContent !== UI_CSS) state.uiStyle.textContent = UI_CSS;
    }
    if (!state.varsStyle) {
      state.varsStyle = document.getElementById(STYLE_VARS_ID) || document.createElement("style");
      state.varsStyle.id = STYLE_VARS_ID;
      if (!state.varsStyle.parentNode) (document.head || document.documentElement).appendChild(state.varsStyle);
    }
    if (!state.patchStyle) {
      state.patchStyle = document.getElementById(STYLE_PATCH_ID) || document.createElement("style");
      state.patchStyle.id = STYLE_PATCH_ID;
      if (!state.patchStyle.parentNode) (document.head || document.documentElement).appendChild(state.patchStyle);
    }
  }

  function colorToRgbTuple(value) {
    if (typeof value !== "string") return null;
    const input = value.trim();
    if (!input) return null;
    if (/^#[0-9a-fA-F]{3}$/.test(input)) {
      const h = input.slice(1);
      const r = parseInt(`${h[0]}${h[0]}`, 16);
      const g = parseInt(`${h[1]}${h[1]}`, 16);
      const b = parseInt(`${h[2]}${h[2]}`, 16);
      return `${r}, ${g}, ${b}`;
    }
    if (/^#[0-9a-fA-F]{6}$/.test(input) || /^#[0-9a-fA-F]{8}$/.test(input)) {
      const hex = input.slice(1, 7);
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      return `${r}, ${g}, ${b}`;
    }
    const match = input.match(/^rgba?\(\s*(\d{1,3})\s*[, ]\s*(\d{1,3})\s*[, ]\s*(\d{1,3})/i);
    if (!match) return null;
    const r = clamp(parseInt(match[1], 10), 0, 255);
    const g = clamp(parseInt(match[2], 10), 0, 255);
    const b = clamp(parseInt(match[3], 10), 0, 255);
    return `${r}, ${g}, ${b}`;
  }

  function buildVarsCSS(theme) {
    const resolvedTokens = syncLinkedBackgroundToken({ ...theme.tokens });
    const lines = TOKEN_KEYS.map((k) => `  ${k}: ${resolvedTokens[k]} !important;`);
    lines.push("  --tertiary-med-or-tertiary: var(--tertiary) !important;");
    const dLinkColor = resolvedTokens["--link-color"] || resolvedTokens["--tertiary"] || "var(--tertiary)";
    lines.push(`  --d-link-color: ${dLinkColor} !important;`);
    [
      ["--primary", "--primary-rgb"],
      ["--primary-low", "--primary-low-rgb"],
      ["--primary-very-low", "--primary-very-low-rgb"],
      ["--secondary", "--secondary-rgb"],
      ["--header_background", "--header_background-rgb"],
      ["--tertiary", "--tertiary-rgb"],
    ].forEach(([source, target]) => {
      const rgb = colorToRgbTuple(resolvedTokens[source]);
      if (rgb) lines.push(`  ${target}: ${rgb} !important;`);
    });
    const sidebarBackground = resolvedTokens["--background-color"] || "var(--secondary)";
    lines.push(`  --linuxdo-theme-radius-scale: ${(theme.patches.radiusScale / 100).toFixed(2)} !important;`);
    lines.push(`  --linuxdo-theme-shadow-scale: ${(theme.patches.shadowIntensity / 100).toFixed(2)} !important;`);
    lines.push(`  --d-sidebar-background: ${sidebarBackground} !important;`);
    lines.push(`  --d-sidebar-footer-fade: ${sidebarBackground} !important;`);
    return `html[data-linuxdo-theme-active="1"] {\n${lines.join("\n")}\n}\n`;
  }

  function buildProfilePatchCSS(profile, shadowScale) {
    if (profile === "claude") return `html[data-linuxdo-theme-active="1"][data-linuxdo-theme-profile="claude"] body:not(.admin-interface){background-image:radial-gradient(circle at 80% -10%,rgba(255,190,120,.08),transparent 40%);}html[data-linuxdo-theme-active="1"][data-linuxdo-theme-profile="claude"] .btn-primary{letter-spacing:.01em;}html[data-linuxdo-theme-active="1"][data-linuxdo-theme-profile="claude"] .topic-list .topic-list-item{border-color:color-mix(in srgb,var(--content-border-color) 92%,var(--tertiary));}`;
    if (profile === "trae") {
      const glow = (0.18 * shadowScale).toFixed(3);
      return `html[data-linuxdo-theme-active="1"][data-linuxdo-theme-profile="trae"] body:not(.admin-interface){background-image:radial-gradient(circle at 20% -10%,rgba(46,201,211,.08),transparent 45%);}html[data-linuxdo-theme-active="1"][data-linuxdo-theme-profile="trae"] .btn-primary{box-shadow:0 0 0 1px rgba(46,201,211,${glow}) inset;}html[data-linuxdo-theme-active="1"][data-linuxdo-theme-profile="trae"] .topic-list .topic-list-item{border-color:color-mix(in srgb,var(--content-border-color) 78%,var(--tertiary));}`;
    }
    if (profile === "linear") return `html[data-linuxdo-theme-active="1"][data-linuxdo-theme-profile="linear"] .d-header{border-bottom:1px solid var(--content-border-color);}html[data-linuxdo-theme-active="1"][data-linuxdo-theme-profile="linear"] .topic-list .topic-list-item{border-radius:calc(var(--linuxdo-theme-radius) * .88);}html[data-linuxdo-theme-active="1"][data-linuxdo-theme-profile="linear"] .btn-primary{font-weight:500;}`;
    return "";
  }

  function buildPatchCSS(theme) {
    // v1.2.5 visual consistency patches + dark-mode readability fixes.
    const shadowScale = theme.patches.shadowIntensity / 100;
    const subtleAmbientAlpha = (0.032 * Math.max(0.7, shadowScale)).toFixed(3);
    const subtleLiftAlpha = (0.055 * Math.max(0.7, shadowScale)).toFixed(3);
    const subtleHoverAmbientAlpha = (0.048 * Math.max(0.7, shadowScale)).toFixed(3);
    const subtleHoverLiftAlpha = (0.082 * Math.max(0.7, shadowScale)).toFixed(3);
    const subtleSelectedAmbientAlpha = (0.053 * Math.max(0.7, shadowScale)).toFixed(3);
    const subtleSelectedLiftAlpha = (0.086 * Math.max(0.7, shadowScale)).toFixed(3);
    const elevatedAmbientAlpha = (0.052 * Math.max(0.7, shadowScale)).toFixed(3);
    const elevatedLiftAlpha = (0.084 * Math.max(0.7, shadowScale)).toFixed(3);
    const elevatedHoverAmbientAlpha = (0.074 * Math.max(0.7, shadowScale)).toFixed(3);
    const elevatedHoverLiftAlpha = (0.114 * Math.max(0.7, shadowScale)).toFixed(3);
    const elevatedSelectedAmbientAlpha = (0.068 * Math.max(0.7, shadowScale)).toFixed(3);
    const elevatedSelectedLiftAlpha = (0.106 * Math.max(0.7, shadowScale)).toFixed(3);
    const dropdownAlpha = (0.28 * shadowScale).toFixed(3);
    const glassColor = "color-mix(in srgb, var(--header_background) 86%, transparent)";
    const topicSurfaceBase = "color-mix(in srgb,var(--d-content-background) 97%,var(--tertiary) 3%)";
    const topicSurfaceHover = "color-mix(in srgb,var(--d-content-background) 93%,var(--tertiary) 7%)";
    const topicEdgeBase = "color-mix(in srgb,var(--content-border-color) 84%,transparent)";
    const topicEdgeHover = "color-mix(in srgb,var(--content-border-color) 62%,var(--tertiary) 38%)";
    const headerGlassCss = theme.patches.headerGlass
      ? `html[data-linuxdo-theme-active="1"] .d-header{backdrop-filter:saturate(1.25) blur(10px);background:${glassColor}!important;}`
      : `html[data-linuxdo-theme-active="1"] .d-header{backdrop-filter:none;background:var(--header_background)!important;}`;
    const topicElevationCss = theme.patches.topicCardElevation
      ? `html[data-linuxdo-theme-active="1"] .topic-list .topic-list-item{background:var(--d-content-background);background-image:linear-gradient(180deg,${topicSurfaceBase},var(--d-content-background));border-color:${topicEdgeBase};box-shadow:0 4px 10px -6px rgba(0,0,0,${elevatedAmbientAlpha}),0 12px 26px -18px rgba(0,0,0,${elevatedLiftAlpha}),var(--shadow-card);transition:box-shadow .24s cubic-bezier(.22,.61,.36,1),border-color .2s ease,background-color .2s ease,background-image .2s ease;}html[data-linuxdo-theme-active="1"] .topic-list .topic-list-item:hover{background-image:linear-gradient(180deg,${topicSurfaceHover},var(--d-content-background));border-color:${topicEdgeHover};box-shadow:0 8px 16px -8px rgba(0,0,0,${elevatedHoverAmbientAlpha}),0 18px 34px -22px rgba(0,0,0,${elevatedHoverLiftAlpha}),var(--shadow-card);}html[data-linuxdo-theme-active="1"] .topic-list .topic-list-item.selected{border-color:${topicEdgeBase};box-shadow:0 7px 16px -8px rgba(0,0,0,${elevatedSelectedAmbientAlpha}),0 17px 32px -22px rgba(0,0,0,${elevatedSelectedLiftAlpha}),var(--shadow-card);}html[data-linuxdo-theme-active="1"] .topic-list .topic-list-item:focus-within{border-color:${topicEdgeBase};box-shadow:0 10px 22px -14px rgba(0,0,0,${elevatedHoverLiftAlpha}),var(--shadow-card);}`
      : `html[data-linuxdo-theme-active="1"] .topic-list .topic-list-item{background:var(--d-content-background);background-image:linear-gradient(180deg,${topicSurfaceBase},var(--d-content-background));border-color:${topicEdgeBase};box-shadow:0 2px 6px -3px rgba(0,0,0,${subtleAmbientAlpha}),0 10px 22px -18px rgba(0,0,0,${subtleLiftAlpha});transition:box-shadow .24s cubic-bezier(.22,.61,.36,1),border-color .2s ease,background-color .2s ease,background-image .2s ease;}html[data-linuxdo-theme-active="1"] .topic-list .topic-list-item:hover{background-image:linear-gradient(180deg,${topicSurfaceHover},var(--d-content-background));border-color:${topicEdgeHover};box-shadow:0 4px 10px -5px rgba(0,0,0,${subtleHoverAmbientAlpha}),0 14px 28px -18px rgba(0,0,0,${subtleHoverLiftAlpha});}html[data-linuxdo-theme-active="1"] .topic-list .topic-list-item.selected{border-color:${topicEdgeBase};box-shadow:0 5px 11px -6px rgba(0,0,0,${subtleSelectedAmbientAlpha}),0 14px 26px -18px rgba(0,0,0,${subtleSelectedLiftAlpha});}html[data-linuxdo-theme-active="1"] .topic-list .topic-list-item:focus-within{border-color:${topicEdgeBase};box-shadow:0 8px 18px -12px rgba(0,0,0,${subtleHoverLiftAlpha});}`;
    const darkSummaryCss = `html[data-linuxdo-theme-active="1"][data-linuxdo-theme-scheme="dark"] .topic-map__stats .number,html[data-linuxdo-theme-active="1"][data-linuxdo-theme-scheme="dark"] .topic-map .view-explainer,html[data-linuxdo-theme-active="1"][data-linuxdo-theme-scheme="dark"] .topic-map .topic-map__stat-label{color:var(--primary-high)!important;}html[data-linuxdo-theme-active="1"][data-linuxdo-theme-scheme="dark"] .topic-map__views-content canvas{filter:contrast(1.12) saturate(1.08) brightness(1.04);}html[data-linuxdo-theme-active="1"][data-linuxdo-theme-scheme="dark"] .top-categories-section table{max-width:100%;}`;
    const darkReadableTextCss = `html[data-linuxdo-theme-active="1"][data-linuxdo-theme-scheme="dark"] .cooked blockquote,html[data-linuxdo-theme-active="1"][data-linuxdo-theme-scheme="dark"] .cooked aside.quote,html[data-linuxdo-theme-active="1"][data-linuxdo-theme-scheme="dark"] .cooked aside,html[data-linuxdo-theme-active="1"][data-linuxdo-theme-scheme="dark"] .topic-post .post-notice{color:var(--primary)!important;}html[data-linuxdo-theme-active="1"][data-linuxdo-theme-scheme="dark"] .cooked aside.quote .title,html[data-linuxdo-theme-active="1"][data-linuxdo-theme-scheme="dark"] .topic-post .post-notice .post-notice-label{color:var(--primary-high)!important;}html[data-linuxdo-theme-active="1"][data-linuxdo-theme-scheme="dark"] .topic-post .post-notice a,html[data-linuxdo-theme-active="1"][data-linuxdo-theme-scheme="dark"] .cooked blockquote a,html[data-linuxdo-theme-active="1"][data-linuxdo-theme-scheme="dark"] .cooked aside a{color:var(--link-color)!important;}html[data-linuxdo-theme-active="1"][data-linuxdo-theme-scheme="dark"] .cooked details > summary,html[data-linuxdo-theme-active="1"][data-linuxdo-theme-scheme="dark"] .cooked .discourse-details > summary{color:var(--primary-high)!important;}html[data-linuxdo-theme-active="1"][data-linuxdo-theme-scheme="dark"] .cooked details[open],html[data-linuxdo-theme-active="1"][data-linuxdo-theme-scheme="dark"] .cooked details[open] *{color:var(--primary)!important;}html[data-linuxdo-theme-active="1"][data-linuxdo-theme-scheme="dark"] .cooked .spoiler:not(.spoiler-blurred),html[data-linuxdo-theme-active="1"][data-linuxdo-theme-scheme="dark"] .cooked .spoiler:not(.spoiler-blurred) *{color:var(--primary)!important;}`;

    return `html[data-linuxdo-theme-active="1"]{--linuxdo-theme-radius:calc(var(--d-border-radius) * var(--linuxdo-theme-radius-scale));--linuxdo-theme-radius-large:calc(var(--d-border-radius-large) * var(--linuxdo-theme-radius-scale));}
html[data-linuxdo-theme-active="1"] body:not(.admin-interface),html[data-linuxdo-theme-active="1"] #main-outlet-wrapper{background-color:var(--background-color)!important;}
html[data-linuxdo-theme-active="1"] #main-outlet{border-radius:var(--linuxdo-theme-radius-large)!important;background:var(--d-content-background)!important;}
html[data-linuxdo-theme-active="1"] .topic-list .topic-list-item,html[data-linuxdo-theme-active="1"] .topic-list-header,html[data-linuxdo-theme-active="1"] .btn,html[data-linuxdo-theme-active="1"] .select-kit .select-kit-header,html[data-linuxdo-theme-active="1"] .d-menu{border-radius:var(--linuxdo-theme-radius)!important;}
html[data-linuxdo-theme-active="1"] .d-menu,html[data-linuxdo-theme-active="1"] .dropdown-menu{box-shadow:0 12px 30px rgba(0,0,0,${dropdownAlpha})!important;}
html[data-linuxdo-theme-active="1"] .sidebar-wrapper,html[data-linuxdo-theme-active="1"] .sidebar-hamburger-dropdown,html[data-linuxdo-theme-active="1"] .sidebar-footer-wrapper{background-color:var(--d-sidebar-background)!important;}
html[data-linuxdo-theme-active="1"] .sidebar-footer-wrapper .sidebar-footer-container{background-color:var(--d-sidebar-background)!important;}
html[data-linuxdo-theme-active="1"] .sidebar-footer-wrapper .sidebar-footer-container::before,html[data-linuxdo-theme-active="1"] .menu-panel .sidebar-footer-wrapper .sidebar-footer-container::before{background:linear-gradient(to bottom,transparent,var(--d-sidebar-footer-fade))!important;}
html[data-linuxdo-theme-active="1"] .sidebar__panel-switch-button{background:var(--d-content-background)!important;border:1px solid var(--content-border-color)!important;}
html[data-linuxdo-theme-active="1"] .sidebar__panel-switch-button:hover{background:var(--d-hover)!important;border-color:color-mix(in srgb,var(--content-border-color) 68%,var(--tertiary) 32%)!important;}
html[data-linuxdo-theme-active="1"] #d-splash{--dot-color:var(--tertiary)!important;}
html[data-linuxdo-theme-active="1"] #d-splash .dots{background-color:var(--dot-color)!important;}
${headerGlassCss}
${topicElevationCss}
${darkSummaryCss}
${darkReadableTextCss}
${buildProfilePatchCSS(theme.patchProfile, shadowScale)}`;
  }

  function buildThemeApplySignature(theme, schemeType) {
    const tokenSignature = TOKEN_KEYS.map((token) => theme.tokens[token] || "").join("\u001f");
    return [
      theme.themeRef || "",
      theme.presetId || "",
      theme.patchProfile || "",
      schemeType || "",
      theme.patches.headerGlass ? "1" : "0",
      theme.patches.topicCardElevation ? "1" : "0",
      String(theme.patches.radiusScale),
      String(theme.patches.shadowIntensity),
      tokenSignature,
    ].join("\u001e");
  }

  function applyTheme() {
    ensureStyles();
    if (!isFrontendRoute()) {
      deactivateTheme();
      return;
    }
    runSafely("apply theme", () => {
      const theme = getEffectiveTheme();
      const expectedSchemeType = getPresetSchemeTypeByPresetId(theme.presetId);
      if (expectedSchemeType) syncDiscourseColorMode(expectedSchemeType);
      const resolvedSchemeType = expectedSchemeType || getSchemeType();
      document.documentElement.setAttribute("data-linuxdo-theme-active", "1");
      document.documentElement.setAttribute("data-linuxdo-theme-preset", theme.presetId);
      document.documentElement.setAttribute("data-linuxdo-theme-profile", theme.patchProfile);
      document.documentElement.setAttribute("data-linuxdo-theme-scheme", resolvedSchemeType);
      const nextSignature = buildThemeApplySignature(theme, resolvedSchemeType);
      const styleIsInSync =
        state.varsStyle?.textContent === state.lastVarsCSS && state.patchStyle?.textContent === state.lastPatchCSS;
      if (state.lastAppliedThemeSignature === nextSignature && styleIsInSync) return;
      const nextVarsCSS = buildVarsCSS(theme);
      const nextPatchCSS = buildPatchCSS(theme);
      if (state.lastVarsCSS !== nextVarsCSS) {
        state.varsStyle.textContent = nextVarsCSS;
        state.lastVarsCSS = nextVarsCSS;
      }
      if (state.lastPatchCSS !== nextPatchCSS) {
        state.patchStyle.textContent = nextPatchCSS;
        state.lastPatchCSS = nextPatchCSS;
      }
      state.lastAppliedThemeSignature = nextSignature;
    });
  }

  function deactivateTheme() {
    document.documentElement.removeAttribute("data-linuxdo-theme-active");
    document.documentElement.removeAttribute("data-linuxdo-theme-preset");
    document.documentElement.removeAttribute("data-linuxdo-theme-profile");
    document.documentElement.removeAttribute("data-linuxdo-theme-scheme");
    if (state.varsStyle && state.lastVarsCSS) state.varsStyle.textContent = "";
    if (state.patchStyle && state.lastPatchCSS) state.patchStyle.textContent = "";
    state.lastVarsCSS = "";
    state.lastPatchCSS = "";
    state.lastAppliedThemeSignature = "";
  }

  function debounceApply() {
    clearStateTimer("updateTimer");
    state.updateTimer = setTimeout(() => {
      state.updateTimer = null;
      runSafely("debounced apply", () => {
        saveConfig();
        applyTheme();
        refreshDynamicCustomInputs();
        refreshDynamicSettingsInputs();
      });
    }, UI_DEBOUNCE_MS);
  }

  function setStatus(message, isError = false) {
    if (!state.panelStatusEl) return;
    state.panelStatusEl.textContent = message;
    state.panelStatusEl.classList.toggle("--error", isError);
  }

  function removePanelDom() {
    clearStateTimer("updateTimer");
    clearStateTimer("syncEntryTimer");
    if (state.panel) {
      state.panel.remove();
      state.panel = null;
      state.panelStatusEl = null;
    }
    if (state.overlay) {
      state.overlay.remove();
      state.overlay = null;
    }
    state.isPanelOpen = false;
  }

  function closePanel() {
    if (!state.panel || !state.overlay || !state.isPanelOpen) return;
    state.panel.hidden = true;
    state.overlay.hidden = true;
    state.panel.setAttribute("aria-hidden", "true");
    state.isPanelOpen = false;
  }

  function openPanel() {
    if (!isFrontendRoute()) return;
    ensurePanel();
    renderPanel();
    state.overlay.hidden = false;
    state.panel.hidden = false;
    state.panel.setAttribute("aria-hidden", "false");
    state.isPanelOpen = true;
  }

  const togglePanel = () => (state.isPanelOpen ? closePanel() : openPanel());

  function toColorInputValue(value) {
    if (typeof value !== "string") return null;
    const hex = value.trim();
    if (/^#[0-9a-fA-F]{6}$/.test(hex)) return hex.toLowerCase();
    if (/^#[0-9a-fA-F]{3}$/.test(hex)) {
      const h = hex.replace("#", "").toLowerCase();
      return `#${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}`;
    }
    if (/^#[0-9a-fA-F]{8}$/.test(hex)) return `#${hex.slice(1, 7).toLowerCase()}`;
    const m = hex.match(/^rgba?\(\s*(\d{1,3})\s*[, ]\s*(\d{1,3})\s*[, ]\s*(\d{1,3})/);
    if (!m) return null;
    const r = clamp(parseInt(m[1], 10), 0, 255);
    const g = clamp(parseInt(m[2], 10), 0, 255);
    const b = clamp(parseInt(m[3], 10), 0, 255);
    return `#${[r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("")}`;
  }

  const getCustomThemePresetId = () => (isPresetId(state.config.customTheme.basePreset) ? state.config.customTheme.basePreset : getActivePresetId());
  const getBaseTokenValue = (token) => PRESETS[getCustomThemePresetId()].tokens[token];

  function syncCustomBaseWithActivePresetIfNeeded() {
    const selection = resolveActiveThemeSelection();
    if (selection.kind === "preset") state.config.customTheme.basePreset = selection.presetId;
  }

  function activateCustomTheme() {
    state.config.activeThemeRef = makeLibraryThemeRef(CUSTOM_THEME_ID);
    state.config.activePresetId = getCustomThemePresetId();
  }

  function applyLibraryTheme(themeId, options = {}) {
    const { syncCustomTheme = true } = options;
    const entry = getThemeEntryById(themeId);
    if (!entry) return false;
    state.config.activeThemeRef = makeLibraryThemeRef(entry.id);
    state.config.activePresetId = entry.basePreset;
    if (syncCustomTheme) {
      state.config.customTheme.name = entry.name;
      state.config.customTheme.basePreset = entry.basePreset;
      state.config.customTheme.tokens = clone(entry.tokens);
      state.config.customTheme.patches = clone(entry.patches);
      state.customThemeDraftName = entry.name;
      syncCustomThemeToLibrary();
    }
    return true;
  }

  function setTokenOverride(token, value) {
    if (token === LINKED_BACKGROUND_TOKEN) {
      setStatus("“内容容器背景”已与“全局背景”联动，请编辑“全局背景”。");
      return;
    }
    syncCustomBaseWithActivePresetIfNeeded();
    const normalized = normalizeTokenValue(token, value);
    if (normalized === null) {
      setStatus(`字段 ${token} 值无效，已忽略。`, true);
      return;
    }
    const base = getBaseTokenValue(token);
    if (normalized === base) delete state.config.customTheme.tokens[token];
    else state.config.customTheme.tokens[token] = normalized;
    state.config.customTheme.basePreset = getCustomThemePresetId();
    activateCustomTheme();
    syncCustomThemeToLibrary();
    setStatus(`已更新 ${token}。`);
    debounceApply();
  }

  function resetTokenOverride(token) {
    if (token === LINKED_BACKGROUND_TOKEN) {
      setStatus("“内容容器背景”已与“全局背景”联动，无需单独恢复。");
      return;
    }
    syncCustomBaseWithActivePresetIfNeeded();
    delete state.config.customTheme.tokens[token];
    state.config.customTheme.basePreset = getCustomThemePresetId();
    activateCustomTheme();
    syncCustomThemeToLibrary();
    saveConfig();
    applyTheme();
    refreshDynamicCustomInputs();
    setStatus(`已恢复 ${token} 为预设值。`);
  }

  function resetCustomToPreset() {
    const preset = PRESETS[getActivePresetId()];
    state.config.customTheme.basePreset = preset.id;
    state.config.customTheme.tokens = {};
    state.config.customTheme.patches = normalizePatches({}, preset.patchDefaults || DEFAULT_PATCHES);
    activateCustomTheme();
    state.customThemeDraftName = "我的主题";
    syncCustomThemeToLibrary();
    saveConfig();
    applyTheme();
    renderCustomSection();
    setStatus("已恢复为预设默认参数。");
  }

  function saveCustomThemeSnapshot(rawName) {
    syncCustomBaseWithActivePresetIfNeeded();
    const basePresetId = getCustomThemePresetId();
    const preset = PRESETS[basePresetId];
    const snapshotId = buildUniqueThemeId("custom");
    const requestedName = normalizeThemeName(rawName, "我的主题");
    const existing = new Set(
      (state.config.themeLibrary || [])
        .filter((item) => item && item.id !== CUSTOM_THEME_ID)
        .map((item) => item.name)
        .filter(Boolean)
    );
    let finalName = requestedName;
    if (existing.has(finalName)) {
      for (let i = 2; i < 999; i += 1) {
        const suffix = ` (${i})`;
        const sliced = requestedName.slice(0, Math.max(1, 80 - suffix.length));
        const candidate = `${sliced}${suffix}`;
        if (!existing.has(candidate)) {
          finalName = candidate;
          break;
        }
      }
    }
    const snapshot = normalizeThemeEntry(
      {
        id: snapshotId,
        source: LIBRARY_SOURCE_CUSTOM,
        name: finalName,
        basePreset: basePresetId,
        tokens: normalizeTokens(state.config.customTheme.tokens),
        patches: normalizePatches(state.config.customTheme.patches, preset.patchDefaults || DEFAULT_PATCHES),
        settings: normalizeSettings(state.config.settings),
        createdAt: nowISO(),
        updatedAt: nowISO(),
      },
      basePresetId,
      state.config.settings,
      snapshotId
    );
    if (!snapshot) return setStatus("保存失败：主题数据无效。", true);
    upsertThemeEntry(snapshot);
    state.customThemeDraftName = finalName;
    saveConfig();
    renderPanel();
    switchSection("custom", false);
    syncEntryPoints();
    setStatus(`已保存到全部主题：${snapshot.name}`);
  }

  function setPreset(presetId) {
    if (!isPresetId(presetId)) return;
    const preset = PRESETS[presetId];
    state.config.activeThemeRef = makePresetThemeRef(presetId);
    state.config.activePresetId = presetId;
    saveConfig();
    applyTheme();
    renderPanel();
    syncEntryPoints();
    setStatus(`已应用预设：${preset.name}。`);
  }

  function setThemeByRef(themeRef) {
    const parsed = parseThemeRef(themeRef);
    if (!parsed) return;
    if (parsed.kind === "preset") {
      setPreset(parsed.id);
      return;
    }
    if (!applyLibraryTheme(parsed.id, { syncCustomTheme: true })) return;
    saveConfig();
    applyTheme();
    renderPanel();
    syncEntryPoints();
    const applied = getThemeEntryById(parsed.id);
    if (applied) setStatus(`已应用主题：${applied.name}。`);
  }

  function editThemeByRef(themeRef) {
    const parsed = parseThemeRef(themeRef);
    if (!parsed) return setStatus("编辑失败：主题标识无效。", true);
    if (parsed.kind === "preset") {
      const preset = PRESETS[parsed.id];
      state.config.customTheme.basePreset = preset.id;
      state.config.customTheme.tokens = {};
      state.config.customTheme.patches = normalizePatches({}, preset.patchDefaults || DEFAULT_PATCHES);
      state.customThemeDraftName = `${preset.name} 自定义`;
      activateCustomTheme();
      syncCustomThemeToLibrary();
      saveConfig();
      applyTheme();
      renderPanel();
      switchSection("custom", false);
      syncEntryPoints();
      return setStatus(`已进入编辑：${preset.name}。`);
    }
    const entry = getThemeEntryById(parsed.id);
    if (!entry) return setStatus("编辑失败：主题不存在。", true);
    state.config.customTheme.basePreset = entry.basePreset;
    state.config.customTheme.tokens = clone(entry.tokens);
    state.config.customTheme.patches = clone(entry.patches);
    state.customThemeDraftName = entry.name;
    activateCustomTheme();
    syncCustomThemeToLibrary();
    saveConfig();
    applyTheme();
    renderPanel();
    switchSection("custom", false);
    syncEntryPoints();
    setStatus(`已进入编辑：${entry.name}。`);
  }

  function buildCustomPageModelFromThemeRef(themeRef) {
    const parsed = parseThemeRef(themeRef);
    if (!parsed) return null;
    if (parsed.kind === "library") {
      const entry = getThemeEntryById(parsed.id);
      if (!entry) return null;
      const preset = PRESETS[entry.basePreset];
      return {
        name: normalizeThemeName(entry.name, "导出主题"),
        basePreset: entry.basePreset,
        tokens: normalizeTokens({ ...preset.tokens, ...entry.tokens }),
      };
    }
    const preset = PRESETS[parsed.id];
    return {
      name: preset.name,
      basePreset: preset.id,
      tokens: normalizeTokens(preset.tokens),
    };
  }

  function buildCustomPagePayloadFromModel(model) {
    if (!model || !isPresetId(model.basePreset)) return null;
    const preset = PRESETS[model.basePreset];
    const resolvedTokens = normalizeTokens({ ...preset.tokens, ...(model.tokens || {}) });
    return {
      schemaVersion: CUSTOM_IO_SCHEMA_VERSION,
      kind: CUSTOM_IO_KIND,
      custom: {
        name: normalizeThemeName(model.name, "我的主题"),
        basePreset: model.basePreset,
        tokens: resolvedTokens,
      },
      compatibility: {
        exporter: `cozydo-theme.user.js@${SCRIPT_VERSION}`,
        exportedAt: nowISO(),
        tokenEncoding: "resolved-full",
        tokenKeys: TOKEN_KEYS,
        tokenAliases: TOKEN_ALIASES,
      },
    };
  }

  function buildCurrentThemePayload() {
    const selection = resolveActiveThemeSelection();
    const model = buildCustomPageModelFromThemeRef(selection.themeRef);
    if (!model) return null;
    return buildCustomPagePayloadFromModel(model);
  }

  function buildCurrentThemePayloadText() {
    const payload = buildCurrentThemePayload();
    if (!payload) return "";
    return JSON.stringify(payload, null, 2);
  }

  function getAllThemeRefsForCollection() {
    const refs = Object.keys(PRESETS).map((presetId) => makePresetThemeRef(presetId));
    if (getThemeEntryById(CUSTOM_THEME_ID)) refs.push(makeLibraryThemeRef(CUSTOM_THEME_ID));
    const savedCustom = (state.config.themeLibrary || [])
      .filter((entry) => entry?.id !== CUSTOM_THEME_ID && entry?.source === LIBRARY_SOURCE_CUSTOM)
      .sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
    savedCustom.forEach((entry) => refs.push(makeLibraryThemeRef(entry.id)));
    const imported = (state.config.themeLibrary || [])
      .filter((entry) => entry?.id !== CUSTOM_THEME_ID && entry?.source === LIBRARY_SOURCE_IMPORTED)
      .sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
    imported.forEach((entry) => refs.push(makeLibraryThemeRef(entry.id)));
    return refs;
  }

  function buildThemeCollectionPayload() {
    const activeRef = resolveActiveThemeSelection().themeRef;
    const themes = [];
    getAllThemeRefsForCollection().forEach((themeRef) => {
      const parsed = parseThemeRef(themeRef);
      const model = buildCustomPageModelFromThemeRef(themeRef);
      if (!parsed || !model) return;
      if (parsed.kind === "preset") {
        themes.push({
          kind: "preset",
          source: "preset",
          workspace: false,
          selected: themeRef === activeRef,
          name: model.name,
          basePreset: model.basePreset,
          tokens: model.tokens,
        });
        return;
      }
      const entry = getThemeEntryById(parsed.id);
      if (!entry) return;
      themes.push({
        kind: "library",
        source: entry.source === LIBRARY_SOURCE_CUSTOM ? LIBRARY_SOURCE_CUSTOM : LIBRARY_SOURCE_IMPORTED,
        workspace: parsed.id === CUSTOM_THEME_ID,
        selected: themeRef === activeRef,
        name: model.name,
        basePreset: model.basePreset,
        tokens: model.tokens,
      });
    });
    if (!themes.length) return null;
    if (!themes.some((item) => item.selected)) themes[0].selected = true;
    return {
      schemaVersion: COLLECTION_IO_SCHEMA_VERSION,
      kind: COLLECTION_IO_KIND,
      collection: {
        themes,
      },
      compatibility: {
        exporter: `cozydo-theme.user.js@${SCRIPT_VERSION}`,
        exportedAt: nowISO(),
        tokenEncoding: "resolved-full",
        tokenKeys: TOKEN_KEYS,
        tokenAliases: TOKEN_ALIASES,
      },
    };
  }

  function copyTextToClipboard(text, successMessage, failureMessage = "复制失败，请手动复制。") {
    if (!text) return setStatus("没有可复制内容。", true);
    if (!navigator.clipboard?.writeText) {
      return setStatus("当前环境不支持剪贴板 API，请到“导入导出”页手动复制。", true);
    }
    navigator.clipboard
      .writeText(text)
      .then(() => setStatus(successMessage))
      .catch(() => setStatus(failureMessage, true));
  }

  function writePayloadToImportExportArea(payload, successMessage, switchToImportExport = true) {
    const text = JSON.stringify(payload, null, 2);
    state.lastExportText = text;
    const textarea = getPanelTextarea();
    if (textarea) textarea.value = text;
    if (switchToImportExport) switchSection("import-export", false);
    setStatus(successMessage);
  }

  function exportThemeByRef(themeRef) {
    const targetRef = parseThemeRef(themeRef) ? themeRef : resolveActiveThemeSelection().themeRef;
    const model = buildCustomPageModelFromThemeRef(targetRef);
    if (!model) return setStatus("导出失败：主题不存在。", true);
    const payload = buildCustomPagePayloadFromModel(model);
    if (!payload) return setStatus("导出失败：主题数据无效。", true);
    const text = JSON.stringify(payload, null, 2);
    state.lastExportText = text;
    const textarea = getPanelTextarea();
    if (textarea) textarea.value = text;
    copyTextToClipboard(text, `已复制当前主题 JSON：${model.name}`);
  }

  function exportCurrentThemeConfig() {
    const payload = buildCurrentThemePayload();
    if (!payload) return setStatus("导出失败：当前主题不可用。", true);
    writePayloadToImportExportArea(payload, "已生成当前主题 JSON。");
  }

  function exportThemeCollection() {
    const payload = buildThemeCollectionPayload();
    if (!payload) return setStatus("导出失败：无可导出的主题。", true);
    writePayloadToImportExportArea(payload, "已生成全部主题 JSON 合集。");
  }

  function deleteThemeByRef(themeRef) {
    const parsed = parseThemeRef(themeRef);
    if (!parsed || parsed.kind !== "library") return setStatus("仅支持删除已保存主题。", true);
    if (parsed.id === CUSTOM_THEME_ID) return setStatus("“我的主题”工作区不可删除。", true);
    const entry = getThemeEntryById(parsed.id);
    if (!entry) return setStatus("删除失败：主题不存在。", true);
    if (!confirmWithFallback(`确认删除主题“${entry.name}”？此操作不可撤销。`)) return;
    state.config.themeLibrary = (state.config.themeLibrary || []).filter((item) => item && item.id !== parsed.id);
    if (state.config.activeThemeRef === makeLibraryThemeRef(parsed.id)) {
      const fallbackPresetId = isPresetId(entry.basePreset) ? entry.basePreset : getDefaultPresetId();
      state.config.activeThemeRef = makePresetThemeRef(fallbackPresetId);
      state.config.activePresetId = fallbackPresetId;
    }
    syncCustomThemeToLibrary();
    saveConfig();
    applyTheme();
    renderPanel();
    syncEntryPoints();
    setStatus(`已删除主题：${entry.name}`);
  }

  function ensureNoUnknownTokenKey(tokens) {
    const keys = Object.keys(tokens || {});
    const allowed = new Set([...TOKEN_KEYS, ...Object.keys(TOKEN_ALIASES)]);
    const unknown = keys.filter((k) => !allowed.has(k));
    if (unknown.length) throw new Error(`存在不允许的 token: ${unknown.join(", ")}`);
  }

  function alertImportConflict(message) {
    try {
      window.alert(message);
    } catch {
      // ignore alert failures in restricted contexts
    }
    throw new Error(message);
  }

  function confirmWithFallback(message, fallback = false) {
    try {
      if (typeof window.confirm === "function") return !!window.confirm(message);
    } catch (error) {
      console.warn("[linuxdo-theme] confirm dialog unavailable", error);
    }
    return fallback;
  }

  function ensureImportThemeNameAvailable(rawName, existingNamePool) {
    const name = normalizeThemeName(rawName, "导入主题");
    const lowered = name.toLowerCase();
    const presetNames = new Set(Object.values(PRESETS).map((preset) => String(preset.name || "").toLowerCase()));
    if (presetNames.has(lowered)) {
      alertImportConflict(`导入失败：主题名“${name}”与内置预设同名，预设主题不可替换。`);
    }
    const existingNames =
      existingNamePool instanceof Set
        ? existingNamePool
        : new Set((state.config.themeLibrary || []).map((entry) => String(entry?.name || "").toLowerCase()).filter(Boolean));
    if (existingNames.has(lowered)) {
      alertImportConflict(`导入失败：已存在同名主题“${name}”，不允许同名导入。`);
    }
    if (existingNamePool instanceof Set) existingNamePool.add(lowered);
    return name;
  }

  function getRandomIdSuffix() {
    const cryptoApi = globalThis.crypto;
    if (cryptoApi && typeof cryptoApi.getRandomValues === "function") {
      const bytes = new Uint8Array(5);
      cryptoApi.getRandomValues(bytes);
      return Array.from(bytes, (byte) => byte.toString(36).padStart(2, "0")).join("").slice(0, 8);
    }
    return Math.random().toString(36).slice(2, 10);
  }

  function buildUniqueThemeId(prefix = "imported") {
    const normalizedPrefix = typeof prefix === "string" && prefix ? prefix : "imported";
    let candidate = "";
    let attempts = 0;
    do {
      candidate = `${normalizedPrefix}-${Date.now().toString(36)}-${getRandomIdSuffix()}`;
      attempts += 1;
    } while (getThemeEntryById(candidate) && attempts < UNIQUE_THEME_ID_MAX_ATTEMPTS);
    if (!getThemeEntryById(candidate)) return candidate;

    // Deterministic fallback to guarantee uniqueness under extreme collision cases.
    const seed = `${normalizedPrefix}-${Date.now().toString(36)}-${getRandomIdSuffix()}`;
    let suffix = 0;
    do {
      candidate = `${seed}-${suffix.toString(36)}`;
      suffix += 1;
    } while (getThemeEntryById(candidate));

    return candidate;
  }

  function parseAndResolveTokenMap(rawTokens, basePresetId, fieldName = "tokens") {
    if (!rawTokens || typeof rawTokens !== "object") throw new Error(`${fieldName} 必须为对象。`);
    ensureNoUnknownTokenKey(rawTokens);
    const normalizedTokens = normalizeTokens(rawTokens);
    const uniqueCanonicalTokenCount = new Set(
      Object.keys(rawTokens).map((key) => TOKEN_ALIASES[key] || key)
    ).size;
    if (Object.keys(normalizedTokens).length !== uniqueCanonicalTokenCount) {
      throw new Error(`${fieldName} 中存在非法值，请检查颜色格式或字符长度。`);
    }
    return normalizeTokens({ ...PRESETS[basePresetId].tokens, ...normalizedTokens });
  }

  function parseCustomPagePayload(payload) {
    if (payload?.kind !== CUSTOM_IO_KIND) return null;
    if (payload?.schemaVersion !== CUSTOM_IO_SCHEMA_VERSION) {
      throw new Error(`导入失败：${CUSTOM_IO_KIND} 仅支持 schemaVersion = ${CUSTOM_IO_SCHEMA_VERSION}。`);
    }
    const custom = payload.custom;
    if (!custom || typeof custom !== "object") throw new Error("导入失败：custom 字段缺失或格式错误。");
    if (!isPresetId(custom.basePreset)) throw new Error("导入失败：custom.basePreset 不在内置预设列表中。");
    return {
      name: normalizeThemeName(custom.name, "导入配置"),
      basePreset: custom.basePreset,
      tokens: parseAndResolveTokenMap(custom.tokens, custom.basePreset, "custom.tokens"),
    };
  }

  function parseLegacyThemePackPayload(payload) {
    if (payload?.schemaVersion !== 1) return null;
    const kind = payload.kind || (payload.config ? "full-config" : "theme-pack");
    if (kind !== "theme-pack") return null;
    if (!isPresetId(payload.basePreset)) throw new Error("basePreset 不在内置预设列表中。");
    if (typeof payload.name !== "string" || !payload.name.trim() || payload.name.trim().length > 80) {
      throw new Error("name 不能为空，且长度不能超过 80。");
    }
    return {
      name: payload.name.trim().slice(0, 80),
      basePreset: payload.basePreset,
      tokens: parseAndResolveTokenMap(payload.tokens, payload.basePreset, "tokens"),
    };
  }

  function parseLegacyFullConfigPayload(payload) {
    if (payload?.schemaVersion !== 1) return null;
    const kind = payload.kind || (payload.config ? "full-config" : "theme-pack");
    if (kind !== "full-config") return null;
    if (!payload.config || typeof payload.config !== "object") throw new Error("full-config 缺少 config。");
    const importedConfig = normalizeConfig(payload.config);
    const basePreset = isPresetId(importedConfig.customTheme?.basePreset)
      ? importedConfig.customTheme.basePreset
      : isPresetId(importedConfig.activePresetId)
        ? importedConfig.activePresetId
        : getDefaultPresetId();
    return {
      name: normalizeThemeName(importedConfig.customTheme?.name, "导入配置"),
      basePreset,
      tokens: parseAndResolveTokenMap(importedConfig.customTheme?.tokens || {}, basePreset, "config.customTheme.tokens"),
    };
  }

  function parseThemeCollectionPayload(payload) {
    if (payload?.kind !== COLLECTION_IO_KIND) return null;
    if (payload?.schemaVersion !== COLLECTION_IO_SCHEMA_VERSION) {
      throw new Error(`导入失败：${COLLECTION_IO_KIND} 仅支持 schemaVersion = ${COLLECTION_IO_SCHEMA_VERSION}。`);
    }
    const rawThemes = payload.collection?.themes;
    if (!Array.isArray(rawThemes) || rawThemes.length === 0) throw new Error("导入失败：theme-collection 缺少 themes 列表。");
    const themes = rawThemes.map((raw, index) => {
      if (!raw || typeof raw !== "object") throw new Error(`导入失败：collection.themes[${index}] 必须为对象。`);
      const kind = raw.kind === "preset" || raw.kind === "library" ? raw.kind : null;
      if (!kind) throw new Error(`导入失败：collection.themes[${index}].kind 仅支持 preset / library。`);
      if (!isPresetId(raw.basePreset)) throw new Error(`导入失败：collection.themes[${index}].basePreset 不在内置预设列表中。`);
      const source =
        kind === "preset"
          ? "preset"
          : raw.source === LIBRARY_SOURCE_CUSTOM
            ? LIBRARY_SOURCE_CUSTOM
            : raw.source === LIBRARY_SOURCE_IMPORTED
              ? LIBRARY_SOURCE_IMPORTED
              : null;
      if (!source) throw new Error(`导入失败：collection.themes[${index}].source 非法。`);
      const fallbackName = kind === "preset" ? PRESETS[raw.basePreset].name : "导入主题";
      return {
        kind,
        source,
        workspace: kind === "library" ? !!raw.workspace : false,
        selected: !!raw.selected,
        name: normalizeThemeName(raw.name, fallbackName),
        basePreset: raw.basePreset,
        tokens: parseAndResolveTokenMap(raw.tokens, raw.basePreset, `collection.themes[${index}].tokens`),
      };
    });
    if (!themes.some((item) => item.selected)) themes[0].selected = true;
    return { themes };
  }

  function parseImportPayload(payload) {
    const collectionPayload = parseThemeCollectionPayload(payload);
    if (collectionPayload) return { type: "collection", collection: collectionPayload, sourceKind: COLLECTION_IO_KIND };
    const customPayload = parseCustomPagePayload(payload);
    if (customPayload) return { type: "single", model: customPayload, sourceKind: CUSTOM_IO_KIND };
    const legacyThemePack = parseLegacyThemePackPayload(payload);
    if (legacyThemePack) return { type: "single", model: legacyThemePack, sourceKind: "theme-pack" };
    const legacyFullConfig = parseLegacyFullConfigPayload(payload);
    if (legacyFullConfig) return { type: "single", model: legacyFullConfig, sourceKind: "full-config" };
    if (typeof payload?.schemaVersion === "number") {
      throw new Error(`导入失败：不支持的 schemaVersion = ${payload.schemaVersion}。`);
    }
    throw new Error("导入失败：无法识别 JSON 格式。");
  }

  function applyImportedCustomPageConfig(model, sourceKind) {
    const importName = ensureImportThemeNameAvailable(model.name);
    const entryId = buildUniqueThemeId("imported");
    const importedEntry = normalizeThemeEntry(
      {
        id: entryId,
        source: LIBRARY_SOURCE_IMPORTED,
        name: importName,
        basePreset: model.basePreset,
        tokens: model.tokens,
        settings: state.config.settings,
        createdAt: nowISO(),
        updatedAt: nowISO(),
      },
      model.basePreset,
      state.config.settings,
      entryId
    );
    if (!importedEntry) throw new Error("导入失败：主题数据无效。");
    upsertThemeEntry(importedEntry);
    applyLibraryTheme(importedEntry.id, { syncCustomTheme: true });
    saveConfig();
    applyTheme();
    renderPanel();
    syncEntryPoints();
    if (sourceKind === CUSTOM_IO_KIND) return `导入成功，已添加到“全部主题”：${importedEntry.name}`;
    return `已兼容导入 ${sourceKind}，并添加到“全部主题”：${importedEntry.name}`;
  }

  function applyImportedThemeCollection(collection, sourceKind) {
    const themes = Array.isArray(collection?.themes) ? collection.themes : [];
    if (!themes.length) throw new Error("导入失败：主题合集为空。");
    const selectedTheme = themes.find((item) => item.selected) || themes[0];
    const libraryThemes = themes.filter((item) => item.kind === "library");
    const workspaceTheme =
      libraryThemes.find((item) => item.workspace) ||
      (selectedTheme.kind === "library" ? selectedTheme : libraryThemes[0]) ||
      selectedTheme;

    const indexToEntryId = new Map();
    const importedEntries = [];
    const existingNames = new Set(
      (state.config.themeLibrary || [])
        .filter((entry) => entry && entry.id !== CUSTOM_THEME_ID)
        .map((entry) => String(entry.name || "").toLowerCase())
        .filter(Boolean)
    );
    themes.forEach((theme, index) => {
      if (theme.kind !== "library") return;
      if (theme === workspaceTheme) return;
      const importName = ensureImportThemeNameAvailable(theme.name, existingNames);
      const prefix = theme.source === LIBRARY_SOURCE_CUSTOM ? "custom" : "imported";
      const entryId = buildUniqueThemeId(prefix);
      const entry = normalizeThemeEntry(
        {
          id: entryId,
          source: theme.source,
          name: importName,
          basePreset: theme.basePreset,
          tokens: theme.tokens,
          settings: state.config.settings,
          createdAt: nowISO(),
          updatedAt: nowISO(),
        },
        theme.basePreset,
        state.config.settings,
        entryId
      );
      if (!entry) return;
      importedEntries.push(entry);
      indexToEntryId.set(index, entry.id);
    });

    state.config.customTheme.name = "我的主题";
    state.config.customTheme.basePreset = workspaceTheme.basePreset;
    state.config.customTheme.tokens = clone(workspaceTheme.tokens);
    state.config.customTheme.patches = normalizePatches(state.config.customTheme.patches, DEFAULT_PATCHES);
    state.customThemeDraftName = normalizeThemeName(workspaceTheme.name, "我的主题");

    const preservedEntries = (state.config.themeLibrary || []).filter((entry) => entry && entry.id !== CUSTOM_THEME_ID);
    state.config.themeLibrary = [...preservedEntries, ...importedEntries];
    syncCustomThemeToLibrary();

    if (selectedTheme.kind === "preset") {
      state.config.activeThemeRef = makePresetThemeRef(selectedTheme.basePreset);
      state.config.activePresetId = selectedTheme.basePreset;
    } else if (selectedTheme === workspaceTheme) {
      activateCustomTheme();
    } else {
      const selectedIndex = themes.indexOf(selectedTheme);
      const mappedId = indexToEntryId.get(selectedIndex);
      if (mappedId && getThemeEntryById(mappedId)) {
        state.config.activeThemeRef = makeLibraryThemeRef(mappedId);
        state.config.activePresetId = selectedTheme.basePreset;
      } else {
        activateCustomTheme();
      }
    }

    saveConfig();
    applyTheme();
    renderPanel();
    syncEntryPoints();
    if (sourceKind === COLLECTION_IO_KIND) return `全部主题合集导入成功，新增 ${importedEntries.length} 个主题。`;
    return `已导入主题合集：${sourceKind}`;
  }

  function parseJsonPayloadFromText(text) {
    const trimmedInput = typeof text === "string" ? text.trim() : "";
    if (!trimmedInput) throw new Error("JSON 解析失败。");
    if (trimmedInput.length > MAX_IMPORT_TEXT_CHARS) {
      throw new Error(`JSON 过大（>${MAX_IMPORT_TEXT_CHARS} 字符），请精简后重试。`);
    }

    const candidates = [trimmedInput];
    const fencedMatch = trimmedInput.match(/```(?:json|jsonc)?\s*([\s\S]*?)\s*```/i);
    if (fencedMatch && fencedMatch[1]) candidates.push(fencedMatch[1].trim());

    const firstBrace = trimmedInput.indexOf("{");
    const lastBrace = trimmedInput.lastIndexOf("}");
    if (firstBrace >= 0 && lastBrace > firstBrace) candidates.push(trimmedInput.slice(firstBrace, lastBrace + 1).trim());

    const tried = new Set();
    for (const candidate of candidates) {
      if (!candidate || tried.has(candidate)) continue;
      tried.add(candidate);
      try {
        return JSON.parse(candidate);
      } catch {
        // try next candidate
      }
    }
    throw new Error("JSON 解析失败，请粘贴合法 JSON（支持包含 ```json``` 代码块或前后说明文字）。");
  }

  function importFromJsonText(text) {
    const payload = parseJsonPayloadFromText(text);
    const parsed = parseImportPayload(payload);
    if (parsed.type === "collection") return applyImportedThemeCollection(parsed.collection, parsed.sourceKind);
    return applyImportedCustomPageConfig(parsed.model, parsed.sourceKind);
  }

  const getPanelTextarea = () => state.panel?.querySelector('[data-role="import-export-text"]');

  function copyTextareaContent() {
    const textarea = getPanelTextarea();
    if (!textarea) return;
    const content = textarea.value.trim();
    copyTextToClipboard(content, "已复制到剪贴板。");
  }

  function buildAllThemesViewModel() {
    const activeRef = resolveActiveThemeSelection().themeRef;
    const cards = Object.values(PRESETS).map((preset) => ({
      themeRef: makePresetThemeRef(preset.id),
      name: preset.name,
      description: preset.description,
      badge: `预设 · ${preset.patchProfile}`,
      canEdit: true,
      canDelete: false,
      canExport: true,
    }));
    const customEntry = getThemeEntryById(CUSTOM_THEME_ID);
    if (customEntry) {
      cards.push({
        themeRef: makeLibraryThemeRef(customEntry.id),
        name: customEntry.name,
        description: `基于 ${PRESETS[customEntry.basePreset]?.name || customEntry.basePreset}，自动同步你的自定义编辑。`,
        badge: `${SOURCE_LABELS[LIBRARY_SOURCE_CUSTOM]} · ${PRESETS[customEntry.basePreset]?.patchProfile || "custom"}`,
        canEdit: true,
        canDelete: false,
        canExport: true,
      });
    }
    const savedCustom = (state.config.themeLibrary || [])
      .filter((entry) => entry?.id !== CUSTOM_THEME_ID && entry?.source === LIBRARY_SOURCE_CUSTOM)
      .sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
    savedCustom.forEach((entry) => {
      cards.push({
        themeRef: makeLibraryThemeRef(entry.id),
        name: entry.name,
        description: `自定义保存主题，基于 ${PRESETS[entry.basePreset]?.name || entry.basePreset}。`,
        badge: `${SOURCE_LABELS[LIBRARY_SOURCE_CUSTOM]} · ${PRESETS[entry.basePreset]?.patchProfile || "custom"}`,
        canEdit: true,
        canDelete: true,
        canExport: true,
      });
    });
    const imported = (state.config.themeLibrary || [])
      .filter((entry) => entry?.id !== CUSTOM_THEME_ID && entry?.source === LIBRARY_SOURCE_IMPORTED)
      .sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
    imported.forEach((entry) => {
      cards.push({
        themeRef: makeLibraryThemeRef(entry.id),
        name: entry.name,
        description: `导入主题，基于 ${PRESETS[entry.basePreset]?.name || entry.basePreset}。`,
        badge: `${SOURCE_LABELS[LIBRARY_SOURCE_IMPORTED]} · ${PRESETS[entry.basePreset]?.patchProfile || "custom"}`,
        canEdit: true,
        canDelete: true,
        canExport: true,
      });
    });
    return { activeRef, cards };
  }

  function renderAllThemesSection() {
    const section = state.panel?.querySelector('[data-panel-section="all-themes"]');
    if (!section) return;
    const viewModel = buildAllThemesViewModel();
    section.innerHTML = `<div class="ldt-preset-grid">${viewModel.cards
      .map((card) => {
        const active = card.themeRef === viewModel.activeRef;
        const actions = [
          `<button class="ldt-btn ${active ? "--primary" : ""}" data-action="apply-theme-ref" data-theme-ref="${card.themeRef}">${active ? "当前使用中" : "应用主题"}</button>`,
        ];
        if (card.canEdit) actions.push(`<button class="ldt-btn" data-action="edit-theme-ref" data-theme-ref="${card.themeRef}">编辑</button>`);
        if (card.canExport) actions.push(`<button class="ldt-btn" data-action="export-theme-ref" data-theme-ref="${card.themeRef}">导出</button>`);
        if (card.canDelete) actions.push(`<button class="ldt-btn" data-action="delete-theme-ref" data-theme-ref="${card.themeRef}">删除</button>`);
        return `<article class="ldt-preset-card ${active ? "--active" : ""}"><h4>${escapeHtml(card.name)}</h4><p>${escapeHtml(card.description)}</p><span class="ldt-badge">${escapeHtml(card.badge)}</span><div class="ldt-btn-row">${actions.join("")}</div></article>`;
      })
      .join("")}</div>`;
  }

  function renderCustomSection() {
    const section = state.panel?.querySelector('[data-panel-section="custom"]');
    if (!section) return;
    const theme = getEditableCustomTheme();
    const saveName = (state.customThemeDraftName || "").trim() || "我的主题";
    const rows = EDITABLE_TOKEN_KEYS.map((token) => {
      const meta = TOKEN_META[token];
      const value = theme.tokens[token];
      const picker = toColorInputValue(value);
      if (meta.type === "color") {
        return `<div class="ldt-token-row" data-token="${token}"><label>${meta.label}<br><small>${token}</small></label><input type="color" data-action="token-color" data-token="${token}" value="${picker || "#000000"}" ${picker ? "" : "disabled"}><input type="text" data-action="token-text" data-token="${token}" value="${escapeHtml(value)}"><button class="ldt-btn" data-action="reset-token" data-token="${token}">恢复</button></div>`;
      }
      return `<div class="ldt-token-row" data-token="${token}"><label>${meta.label}<br><small>${token}</small></label><div></div><input type="text" data-action="token-text" data-token="${token}" value="${escapeHtml(value)}"><button class="ldt-btn" data-action="reset-token" data-token="${token}">恢复</button></div>`;
    }).join("");

    section.innerHTML = `<div class="ldt-field-grid"><div class="ldt-group"><h4>保存到全部主题</h4><small>输入名称后保存当前自定义快照，便于在“全部主题”中切换和导出。</small><div class="ldt-btn-row"><input type="text" data-role="custom-save-name" maxlength="80" value="${escapeHtml(saveName)}" placeholder="输入主题名称" style="min-width:220px;flex:1 1 220px;height:32px;"><button class="ldt-btn --primary" data-action="save-custom-theme">保存</button></div></div><div class="ldt-group"><h4>Token 编辑（颜色可双通道：色板 + 文本）</h4><small>“内容容器背景”已与“全局背景”联动，不再单独配置。</small>${rows}<div class="ldt-btn-row"><button class="ldt-btn" data-action="restore-custom">恢复为当前预设</button></div></div></div>`;
  }

  function refreshDynamicCustomInputs() {
    if (!state.panel) return;
    const section = state.panel.querySelector('[data-panel-section="custom"]');
    if (!section || section.hidden) return;
    const theme = getEditableCustomTheme();
    EDITABLE_TOKEN_KEYS.forEach((token) => {
      const row = section.querySelector(`.ldt-token-row[data-token="${token}"]`);
      if (!row) return;
      const value = theme.tokens[token];
      const textInput = row.querySelector('[data-action="token-text"]');
      if (textInput && document.activeElement !== textInput) textInput.value = value;
      const colorInput = row.querySelector('[data-action="token-color"]');
      if (colorInput) {
        const color = toColorInputValue(value);
        if (color) {
          colorInput.disabled = false;
          if (document.activeElement !== colorInput) colorInput.value = color;
        } else {
          colorInput.disabled = true;
        }
      }
    });
    const saveNameInput = section.querySelector('[data-role="custom-save-name"]');
    if (saveNameInput instanceof HTMLInputElement && document.activeElement !== saveNameInput) {
      saveNameInput.value = (state.customThemeDraftName || "").trim() || "我的主题";
    }
  }

  function refreshDynamicSettingsInputs() {
    if (!state.panel) return;
    const section = state.panel.querySelector('[data-panel-section="settings"]');
    if (!section || section.hidden) return;
    const settings = normalizeSettings(state.config.settings, DEFAULT_SETTINGS);
    const radiusInput = section.querySelector('[data-action="patch-radius-scale"]');
    const shadowInput = section.querySelector('[data-action="patch-shadow-intensity"]');
    const radiusValue = section.querySelector('[data-role="radius-scale-value"]');
    const shadowValue = section.querySelector('[data-role="shadow-intensity-value"]');
    if (radiusInput instanceof HTMLInputElement && document.activeElement !== radiusInput) radiusInput.value = `${settings.radiusScale}`;
    if (shadowInput instanceof HTMLInputElement && document.activeElement !== shadowInput) shadowInput.value = `${settings.shadowIntensity}`;
    if (radiusValue) radiusValue.textContent = `${settings.radiusScale}%`;
    if (shadowValue) shadowValue.textContent = `${settings.shadowIntensity}%`;
  }

  function renderImportExportSection() {
    const section = state.panel?.querySelector('[data-panel-section="import-export"]');
    if (!section) return;
    const defaultText = buildCurrentThemePayloadText();
    if (defaultText) state.lastExportText = defaultText;
    section.innerHTML = `<div class="ldt-field-grid"><div class="ldt-group"><h4>主题 JSON</h4><small>默认展示“全部主题”当前选中主题的 JSON。支持导入单主题配置（custom-page-config）、旧版 theme-pack / full-config，以及“导出全部”生成的 theme-collection 合集。可直接粘贴带 JSON 代码块或前后说明文字的内容。结构参数为全局设置，不包含在导入导出 JSON 中。</small><textarea data-role="import-export-text" placeholder="粘贴 JSON 到这里...">${escapeHtml(state.lastExportText)}</textarea><div class="ldt-btn-row"><button class="ldt-btn --primary" data-action="export-current-theme">导出当前主题</button><button class="ldt-btn" data-action="export-theme-collection">导出全部</button><button class="ldt-btn" data-action="import-json">导入 JSON</button><button class="ldt-btn" data-action="copy-json">复制内容</button></div></div></div>`;
  }

  function renderSettingsSection() {
    const section = state.panel?.querySelector('[data-panel-section="settings"]');
    if (!section) return;
    const settings = normalizeSettings(state.config.settings, DEFAULT_SETTINGS);
    section.innerHTML = `<div class="ldt-field-grid"><div class="ldt-group"><h4>通用设置</h4><label class="ldt-checkbox"><input type="checkbox" data-action="toggle-floating" ${settings.enableFloatingButton ? "checked" : ""}><span>启用悬浮按钮（右下角）</span></label><label class="ldt-checkbox"><input type="checkbox" data-action="toggle-open-topic-new-tab" ${settings.openTopicInNewTab ? "checked" : ""}><span>文章链接默认新标签页打开</span></label></div><div class="ldt-group"><h4>结构参数（全局）</h4><small>作用于所有主题，不随主题导入导出。</small><div class="ldt-field-grid"><label class="ldt-checkbox"><input type="checkbox" data-action="patch-header-glass" ${settings.headerGlass ? "checked" : ""}><span>Header 毛玻璃</span></label><label class="ldt-checkbox"><input type="checkbox" data-action="patch-topic-elevation" ${settings.topicCardElevation ? "checked" : ""}><span>Topic 卡片立体感</span></label><label class="ldt-inline"><span>圆角缩放</span><input type="range" min="60" max="160" step="1" value="${settings.radiusScale}" data-action="patch-radius-scale"><span class="ldt-value" data-role="radius-scale-value">${settings.radiusScale}%</span></label><label class="ldt-inline"><span>阴影强度</span><input type="range" min="0" max="200" step="1" value="${settings.shadowIntensity}" data-action="patch-shadow-intensity"><span class="ldt-value" data-role="shadow-intensity-value">${settings.shadowIntensity}%</span></label></div></div><div class="ldt-group"><h4>重置</h4><div class="ldt-btn-row"><button class="ldt-btn" data-action="reset-all">重置全部配置</button></div></div><div class="ldt-group"><h4>信息</h4><small>版本：${SCRIPT_VERSION}</small></div></div>`;
  }

  function renderPanel() {
    if (!state.panel) return;
    renderAllThemesSection();
    renderCustomSection();
    renderImportExportSection();
    renderSettingsSection();
    switchSection(state.activeSection, false);
  }

  function switchSection(sectionName, setMsg = true) {
    if (!state.panel) return;
    state.activeSection = sectionName;
    state.panel.querySelectorAll(".ldt-tab").forEach((tab) => tab.classList.toggle("--active", tab.getAttribute("data-section") === sectionName));
    state.panel.querySelectorAll(".ldt-section").forEach((sec) => {
      sec.hidden = sec.getAttribute("data-panel-section") !== sectionName;
    });
    if (setMsg) setStatus(`已切换到 ${SECTION_LABELS[sectionName] || sectionName}。`);
  }

  function onPanelClick(event) {
    const target = event.target.closest("[data-action]");
    if (!target) return;
    const action = target.getAttribute("data-action");
    if (action === "close-panel") return closePanel();
    if (action === "switch-section") return switchSection(target.getAttribute("data-section"));
    if (action === "apply-theme-ref") return setThemeByRef(target.getAttribute("data-theme-ref"));
    if (action === "edit-theme-ref") return editThemeByRef(target.getAttribute("data-theme-ref"));
    if (action === "export-theme-ref") return exportThemeByRef(target.getAttribute("data-theme-ref"));
    if (action === "delete-theme-ref") return deleteThemeByRef(target.getAttribute("data-theme-ref"));
    if (action === "reset-token") return resetTokenOverride(target.getAttribute("data-token"));
    if (action === "save-custom-theme") {
      const nameInput = state.panel?.querySelector('[data-role="custom-save-name"]');
      const rawName = nameInput instanceof HTMLInputElement ? nameInput.value : "";
      return saveCustomThemeSnapshot(rawName);
    }
    if (action === "restore-custom") return resetCustomToPreset();
    if (action === "export-current-theme") return exportCurrentThemeConfig();
    if (action === "export-theme-collection") return exportThemeCollection();
    if (action === "copy-json") return copyTextareaContent();
    if (action === "import-json") {
      const textarea = getPanelTextarea();
      if (!textarea) return;
      const input = textarea.value.trim();
      if (!input) return setStatus("请先粘贴 JSON。", true);
      try {
        setStatus(importFromJsonText(input));
      } catch (error) {
        setStatus(error.message || "导入失败。", true);
      }
      return;
    }
    if (action === "reset-all") {
      if (!confirmWithFallback("确认重置全部主题配置？此操作不可撤销。")) return;
      state.config = normalizeConfig(createDefaultConfig());
      state.customThemeDraftName = "我的主题";
      saveConfig();
      applyTheme();
      renderPanel();
      syncEntryPoints();
      setStatus("全部配置已重置。");
    }
  }

  function onPanelInput(event) {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (target instanceof HTMLInputElement && target.getAttribute("data-role") === "custom-save-name") {
      state.customThemeDraftName = target.value.slice(0, 80);
      return;
    }
    const action = target.getAttribute("data-action");
    if (!action) return;
    if (action === "token-color") {
      const token = target.getAttribute("data-token");
      if (!token || !(target instanceof HTMLInputElement)) return;
      const row = target.closest(`.ldt-token-row[data-token="${token}"]`);
      const textInput = row?.querySelector('[data-action="token-text"]');
      if (textInput instanceof HTMLInputElement) textInput.value = target.value;
      return setTokenOverride(token, target.value);
    }
    if (action === "token-text") {
      if (!(target instanceof HTMLInputElement)) return;
      const token = target.getAttribute("data-token");
      if (!token) return;
      return setTokenOverride(token, target.value);
    }
    if (action === "patch-radius-scale") {
      if (!(target instanceof HTMLInputElement)) return;
      state.config.settings.radiusScale = clamp(parseInt(target.value, 10), 60, 160);
      const radiusValueEl = state.panel?.querySelector('[data-role="radius-scale-value"]');
      if (radiusValueEl) radiusValueEl.textContent = `${state.config.settings.radiusScale}%`;
      return debounceApply();
    }
    if (action === "patch-shadow-intensity") {
      if (!(target instanceof HTMLInputElement)) return;
      state.config.settings.shadowIntensity = clamp(parseInt(target.value, 10), 0, 200);
      const shadowValueEl = state.panel?.querySelector('[data-role="shadow-intensity-value"]');
      if (shadowValueEl) shadowValueEl.textContent = `${state.config.settings.shadowIntensity}%`;
      debounceApply();
    }
  }

  function onPanelChange(event) {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const action = target.getAttribute("data-action");
    if (!action) return;
    if (action === "patch-header-glass" && target instanceof HTMLInputElement) {
      state.config.settings.headerGlass = target.checked;
      saveConfig();
      applyTheme();
      return setStatus("全局 Header 毛玻璃设置已更新。");
    }
    if (action === "patch-topic-elevation" && target instanceof HTMLInputElement) {
      state.config.settings.topicCardElevation = target.checked;
      saveConfig();
      applyTheme();
      return setStatus("全局 Topic 卡片立体感设置已更新。");
    }
    if (action === "toggle-floating" && target instanceof HTMLInputElement) {
      state.config.settings.enableFloatingButton = target.checked;
      syncSettingsToActiveTheme();
      saveConfig();
      syncEntryPoints();
      setStatus("悬浮按钮设置已更新。");
      return;
    }
    if (action === "toggle-open-topic-new-tab" && target instanceof HTMLInputElement) {
      state.config.settings.openTopicInNewTab = target.checked;
      syncSettingsToActiveTheme();
      saveConfig();
      syncTopicLinkNewTabBinding();
      setStatus("文章新标签页打开设置已更新。");
    }
  }

  function ensurePanel() {
    if (state.panel && state.overlay) return;
    if (!document.body) return;
    state.overlay = document.getElementById(OVERLAY_ID);
    if (!state.overlay) {
      state.overlay = document.createElement("div");
      state.overlay.id = OVERLAY_ID;
      state.overlay.hidden = true;
      state.overlay.addEventListener("click", () => runSafely("overlay click", closePanel));
      document.body.appendChild(state.overlay);
    }
    state.panel = document.getElementById(PANEL_ID);
    if (!state.panel) {
      state.panel = document.createElement("aside");
      state.panel.id = PANEL_ID;
      state.panel.hidden = true;
      state.panel.setAttribute("aria-hidden", "true");
      state.panel.innerHTML = `<div class="ldt-header"><div class="ldt-title-wrap"><h3>CozyDo Theme Studio</h3><p>全部主题 + 自定义 + JSON 分享</p></div><button class="ldt-close" data-action="close-panel" aria-label="关闭">×</button></div><div class="ldt-tabs"><button class="ldt-tab --active" data-action="switch-section" data-section="all-themes">全部主题</button><button class="ldt-tab" data-action="switch-section" data-section="custom">自定义</button><button class="ldt-tab" data-action="switch-section" data-section="import-export">导入导出</button><button class="ldt-tab" data-action="switch-section" data-section="settings">设置</button></div><div class="ldt-sections"><section class="ldt-section" data-panel-section="all-themes"></section><section class="ldt-section" data-panel-section="custom" hidden></section><section class="ldt-section" data-panel-section="import-export" hidden></section><section class="ldt-section" data-panel-section="settings" hidden></section></div><div class="ldt-footer"><p class="ldt-status" data-role="status"></p></div>`;
      state.panel.addEventListener("click", (event) => runSafely("panel click", () => onPanelClick(event)));
      state.panel.addEventListener("input", (event) => runSafely("panel input", () => onPanelInput(event)));
      state.panel.addEventListener("change", (event) => runSafely("panel change", () => onPanelChange(event)));
      document.body.appendChild(state.panel);
    }
    state.panelStatusEl = state.panel.querySelector('[data-role="status"]');
  }

  function ensureFloatingButton(show) {
    if (!document.body) return;
    if (!show || !isFrontendRoute()) {
      if (state.floatingBtn) {
        state.floatingBtn.remove();
        state.floatingBtn = null;
      }
      return;
    }
    if (!state.floatingBtn) {
      state.floatingBtn = document.createElement("button");
      state.floatingBtn.id = FLOATING_BTN_ID;
      state.floatingBtn.type = "button";
      state.floatingBtn.title = "主题设置";
      state.floatingBtn.setAttribute("aria-label", "主题设置");
      state.floatingBtn.innerHTML = buildThemeIconSvg("d-icon");
      state.floatingBtn.addEventListener("click", () => runSafely("floating button click", togglePanel));
      document.body.appendChild(state.floatingBtn);
    }
  }

  function removeHeaderEntry() {
    const entry = document.getElementById(HEADER_ENTRY_ID);
    if (entry) entry.remove();
  }

  function ensureHeaderEntry() {
    if (!isFrontendRoute()) {
      removeHeaderEntry();
      return false;
    }
    const icons = document.querySelector(".d-header-icons");
    if (!icons) {
      removeHeaderEntry();
      return false;
    }
    let entry = document.getElementById(HEADER_ENTRY_ID);
    if (!entry) {
      entry = document.createElement("li");
      entry.id = HEADER_ENTRY_ID;
      entry.className = "header-dropdown-toggle";
      entry.innerHTML = `<button class="icon linuxdo-theme-header-btn" type="button" title="主题设置" aria-label="主题设置">${buildThemeIconSvg("d-icon")}</button>`;
      entry.querySelector("button")?.addEventListener("click", () => runSafely("header button click", togglePanel));
      icons.prepend(entry);
    }
    const btn = entry.querySelector("button");
    if (btn) btn.className = "icon linuxdo-theme-header-btn";
    const icon = entry.querySelector("svg");
    if (icon) icon.classList.add("d-icon");
    return true;
  }

  function resolveTopicLinkFromClickEvent(event) {
    if (!event || event.defaultPrevented) return null;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return null;
    if (typeof event.button === "number" && event.button !== 0) return null;
    const target = event.target;
    if (!target || typeof target.closest !== "function") return null;
    const link = target.closest("a");
    if (!link || typeof link.matches !== "function") return null;
    if (!link.matches(TOPIC_LINK_NEW_TAB_SELECTOR)) return null;
    if (!link.closest(TOPIC_LINK_NEW_TAB_CONTEXT_SELECTOR)) return null;
    if (typeof link.target === "string" && link.target && link.target.toLowerCase() !== "_self") return null;
    const rawHref = typeof link.getAttribute === "function" ? link.getAttribute("href") : "";
    if (!rawHref || rawHref.startsWith("#") || /^javascript:/i.test(rawHref) || /^mailto:/i.test(rawHref)) return null;
    let parsedUrl = null;
    try {
      parsedUrl = new URL(rawHref, location.href);
    } catch {
      return null;
    }
    if (!parsedUrl || parsedUrl.origin !== location.origin) return null;
    if (!/\/t\/(?:[^/]+\/)?\d+/.test(parsedUrl.pathname)) return null;
    return { link, href: parsedUrl.href };
  }

  function onTopicLinkClickCapture(event) {
    if (!state.config?.settings?.openTopicInNewTab || !isFrontendRoute()) return;
    const resolved = resolveTopicLinkFromClickEvent(event);
    if (!resolved) return;
    event.preventDefault();
    if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();
    else if (typeof event.stopPropagation === "function") event.stopPropagation();
    if (typeof window.open === "function") window.open(resolved.href, "_blank", "noopener");
  }

  function syncTopicLinkNewTabBinding() {
    const shouldBind = !!state.config?.settings?.openTopicInNewTab && isFrontendRoute();
    if (!shouldBind) {
      if (!state.isTopicLinkNewTabBound || !state.onTopicLinkClickCapture) return;
      try {
        document.removeEventListener("click", state.onTopicLinkClickCapture, true);
      } catch {
        // ignore remove listener failures
      }
      state.isTopicLinkNewTabBound = false;
      return;
    }
    if (state.isTopicLinkNewTabBound) return;
    if (!state.onTopicLinkClickCapture) {
      state.onTopicLinkClickCapture = (event) => runSafely("topic link new-tab click", () => onTopicLinkClickCapture(event));
    }
    document.addEventListener("click", state.onTopicLinkClickCapture, true);
    state.isTopicLinkNewTabBound = true;
  }

  function syncEntryPoints() {
    if (!document.body) return;
    if (!isFrontendRoute()) {
      disconnectHeaderIconsObserver();
      removeHeaderEntry();
      ensureFloatingButton(false);
      closePanel();
      removePanelDom();
      syncTopicLinkNewTabBinding();
      return;
    }
    const hasHeader = ensureHeaderEntry();
    ensureFloatingButton(state.config.settings.enableFloatingButton || !hasHeader);
    observeHeaderIconsContainer();
    syncTopicLinkNewTabBinding();
  }

  function scheduleSyncEntryPoints() {
    clearStateTimer("syncEntryTimer");
    state.syncEntryTimer = setTimeout(() => {
      state.syncEntryTimer = null;
      runSafely("sync entry points timer", syncEntryPoints);
    }, 80);
  }

  function disconnectHeaderIconsObserver() {
    if (state.headerIconsObserver) {
      state.headerIconsObserver.disconnect();
      state.headerIconsObserver = null;
    }
    state.headerIconsObserverTarget = null;
  }

  function observeHeaderIconsContainer() {
    if (!isFrontendRoute()) {
      disconnectHeaderIconsObserver();
      return;
    }
    const icons = document.querySelector(".d-header-icons");
    if (!icons) {
      disconnectHeaderIconsObserver();
      return;
    }
    if (state.headerIconsObserverTarget === icons && state.headerIconsObserver) return;
    disconnectHeaderIconsObserver();
    state.headerIconsObserver = new MutationObserver(scheduleSyncEntryPoints);
    state.headerIconsObserver.observe(icons, { childList: true });
    state.headerIconsObserverTarget = icons;
  }

  function getDiscourseLookup() {
    if (!window.Discourse || typeof window.Discourse.lookup !== "function") return null;
    return window.Discourse.lookup.bind(window.Discourse);
  }

  function handleDiscoursePageChanged(payload) {
    const replacedOnlyQueryParams = !!(
      payload &&
      typeof payload === "object" &&
      payload.replacedOnlyQueryParams === true
    );
    closePanel();
    if (isFrontendRoute()) {
      if (replacedOnlyQueryParams) {
        observeHeaderIconsContainer();
        if (!document.getElementById(HEADER_ENTRY_ID)) scheduleSyncEntryPoints();
        return;
      }
      applyTheme();
      syncEntryPoints();
      observeHeaderIconsContainer();
    } else {
      deactivateTheme();
      syncEntryPoints();
      disconnectHeaderIconsObserver();
    }
  }

  function handleDiscourseInterfaceColorChanged(mode) {
    const normalizedMode = mode === "dark" || mode === "light" ? mode : null;
    const service = state.interfaceColor;
    const resolvedMode =
      service?.colorModeIsAuto === true ? getSchemeType() : normalizedMode || getSchemeType();
    if (resolvedMode !== "dark" && resolvedMode !== "light") return;
    state.lastForcedForumMode = resolvedMode;
    const selection = resolveActiveThemeSelection();
    if (selection.kind !== "preset") return;
    const matchedPresetId = getMatchedPresetIdByScheme(selection.presetId, resolvedMode);
    if (!matchedPresetId || matchedPresetId === selection.presetId) return;
    state.config.activeThemeRef = makePresetThemeRef(matchedPresetId);
    state.config.activePresetId = matchedPresetId;
    saveConfig();
    applyTheme();
    if (state.panel) renderPanel();
    syncEntryPoints();
    if (state.isPanelOpen) {
      setStatus(`已跟随论坛色彩模式切换：${PRESETS[matchedPresetId]?.name || matchedPresetId}。`);
    }
  }

  function bindDiscourseServices() {
    if (state.discourseServicesBound || state.discourseBindTimer) return;
    const stopTimer = () => {
      clearStateTimer("discourseBindTimer");
    };
    const bindAttempt = () => {
      const lookup = getDiscourseLookup();
      if (lookup) {
        let appEvents = null;
        let interfaceColor = null;
        try {
          appEvents = lookup("service:app-events");
          interfaceColor = lookup("service:interface-color");
        } catch {
          appEvents = null;
          interfaceColor = null;
        }
        if (appEvents) {
          stopTimer();
          if (state.appEvents && state.onPageChangedHandler) {
            state.appEvents.off(DISCOURSE_EVENT_PAGE_CHANGED, state.onPageChangedHandler);
          }
          if (state.appEvents && state.onInterfaceColorChangedHandler) {
            state.appEvents.off(DISCOURSE_EVENT_INTERFACE_COLOR_CHANGED, state.onInterfaceColorChangedHandler);
          }
          state.appEvents = appEvents;
          state.interfaceColor = interfaceColor || null;
          state.onPageChangedHandler = (payload) => handleDiscoursePageChanged(payload);
          state.onInterfaceColorChangedHandler = (mode) => {
            const normalizedMode = typeof mode === "string" ? mode.trim().toLowerCase() : "";
            handleDiscourseInterfaceColorChanged(normalizedMode);
          };
          state.appEvents.on(DISCOURSE_EVENT_PAGE_CHANGED, state.onPageChangedHandler);
          state.appEvents.on(DISCOURSE_EVENT_INTERFACE_COLOR_CHANGED, state.onInterfaceColorChangedHandler);
          state.discourseServicesBound = true;
          handleDiscoursePageChanged();
          return;
        }
      }
      if (!state.discourseBindStartAt) state.discourseBindStartAt = Date.now();
      if (Date.now() - state.discourseBindStartAt >= DISCOURSE_BIND_TIMEOUT_MS) {
        stopTimer();
        if (!state.discourseBindWarned) {
          state.discourseBindWarned = true;
          console.warn("[linuxdo-theme] Discourse services not available within timeout; applying current page only.");
        }
        return;
      }
      state.discourseBindTimer = setTimeout(() => {
        state.discourseBindTimer = null;
        bindAttempt();
      }, DISCOURSE_BIND_INTERVAL_MS);
    };
    runSafely("bind discourse services", bindAttempt);
  }

  function escapeHtml(value) {
    return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
  }

  function initDefaultsIfMissing() {
    if (!isPresetId(state.config.activePresetId)) state.config.activePresetId = getDefaultPresetId();
    if (!Array.isArray(state.config.themeLibrary)) state.config.themeLibrary = [];
    state.config.settings = normalizeSettings(state.config.settings, DEFAULT_SETTINGS);
    if (typeof state.config.customTheme?.name !== "string" || !state.config.customTheme.name.trim()) state.config.customTheme.name = "我的主题";
    if (!isPresetId(state.config.customTheme.basePreset)) state.config.customTheme.basePreset = state.config.activePresetId;
    if (!state.config.customTheme.patches || typeof state.config.customTheme.patches !== "object") state.config.customTheme.patches = clone(DEFAULT_PATCHES);
    syncCustomThemeToLibrary();
    state.config.activeThemeRef = resolveActiveThemeRef(state.config, state.config.activeThemeRef, state.config.activePresetId);
    const active = resolveActiveThemeSelection();
    if (active.kind === "library") {
      state.config.activePresetId = active.entry.basePreset;
    } else {
      state.config.activePresetId = active.presetId;
    }
  }

  function bindEscToClose() {
    if (state.isEscBound) return;
    document.addEventListener("keydown", (event) => {
      runSafely("keydown handler", () => {
        if (event.key === "Escape") closePanel();
      });
    });
    state.isEscBound = true;
  }

  function bootstrap() {
    if (state.isBootstrapped) return;
    state.isBootstrapped = true;
    repairPresetRegistry();
    state.config = loadConfig();
    initDefaultsIfMissing();
    ensureStyles();
    applyTheme();
    const ready = () => {
      runSafely("sync entry points", syncEntryPoints);
      bindDiscourseServices();
      bindEscToClose();
    };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", ready, { once: true });
    else ready();
  }

  function exposeTestAPI() {
    globalThis.__LDT_TEST_API__ = {
      state,
      PRESETS,
      normalizeTokenValue,
      normalizeTokens,
      buildVarsCSS,
      colorToRgbTuple,
      syncDiscourseColorMode,
      bindDiscourseServices,
      bootstrap,
    };
  }

  if (TEST_MODE) exposeTestAPI();
  else bootstrap();
})();

