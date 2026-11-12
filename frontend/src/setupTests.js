import "@testing-library/jest-dom";

// Recharts and Leaflet expect browser APIs that jsdom does not provide.
globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
window.matchMedia = window.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {} }));
