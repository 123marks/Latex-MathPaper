import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import React from "../web/node_modules/react/index.js";
import {
  useCountUp,
  useInViewOnce,
  usePointerParallax,
  useReducedMotion,
} from "../web/src/lib/motion.js";

const dispatcherRef =
  React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentDispatcher;
const revealSource = readFileSync(new URL("../web/src/components/Reveal.jsx", import.meta.url), "utf8");
const ambientSource = readFileSync(new URL("../web/src/components/Ambient.jsx", import.meta.url), "utf8");
const browserGlobalNames = [
  "window",
  "performance",
  "requestAnimationFrame",
  "cancelAnimationFrame",
  "IntersectionObserver",
];
const originalBrowserGlobals = new Map(
  browserGlobalNames.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]),
);

function setGlobal(name, value) {
  Object.defineProperty(globalThis, name, {
    configurable: true,
    writable: true,
    value,
  });
}

function renderHook(hook, { refValue = null, runEffects = true } = {}) {
  const effects = [];
  const layoutEffects = [];
  const refs = [];
  const states = [];
  const dispatcher = {
    useEffect(effect) {
      effects.push(effect);
    },
    useLayoutEffect(effect) {
      layoutEffects.push(effect);
    },
    useRef(initialValue) {
      const ref = { current: initialValue };
      refs.push(ref);
      return ref;
    },
    useState(initialValue) {
      const state = {
        value: typeof initialValue === "function" ? initialValue() : initialValue,
      };
      states.push(state);
      const setValue = (nextValue) => {
        state.value = typeof nextValue === "function" ? nextValue(state.value) : nextValue;
      };
      return [state.value, setValue];
    },
  };

  const previous = dispatcherRef.current;
  dispatcherRef.current = dispatcher;
  let result;
  try {
    result = hook();
  } finally {
    dispatcherRef.current = previous;
  }

  for (const ref of refs) {
    if (ref.current === null) ref.current = refValue;
  }
  const cleanups = runEffects
    ? [...layoutEffects, ...effects]
        .map((effect) => effect())
        .filter((cleanup) => typeof cleanup === "function")
    : [];

  return {
    layoutEffectCount: layoutEffects.length,
    result,
    states,
    cleanup() {
      for (const cleanup of cleanups.reverse()) cleanup();
    },
  };
}

function installBrowser({ reduced = false } = {}) {
  const calls = {
    cancelAnimationFrame: 0,
    intersectionDisconnect: 0,
    intersectionObserve: 0,
    mediaAdd: 0,
    mediaRemove: 0,
    raf: 0,
  };
  const rafCallbacks = [];
  const intersections = [];
  const mediaListeners = new Set();

  setGlobal("window", {
    matchMedia(query) {
      return {
        matches: query.includes("prefers-reduced-motion") ? reduced : false,
        addEventListener(type, listener) {
          calls.mediaAdd += 1;
          if (type === "change") mediaListeners.add(listener);
        },
        removeEventListener(type, listener) {
          calls.mediaRemove += 1;
          if (type === "change") mediaListeners.delete(listener);
        },
      };
    },
  });
  setGlobal("performance", { now: () => 100 });
  setGlobal("requestAnimationFrame", (callback) => {
    calls.raf += 1;
    rafCallbacks.push(callback);
    return calls.raf;
  });
  setGlobal("cancelAnimationFrame", () => {
    calls.cancelAnimationFrame += 1;
  });
  setGlobal("IntersectionObserver", class {
    constructor(callback) {
      this.callback = callback;
      intersections.push(this);
    }

    observe() {
      calls.intersectionObserve += 1;
    }

    disconnect() {
      calls.intersectionDisconnect += 1;
    }
  });

  return { calls, intersections, mediaListeners, rafCallbacks };
}

function restoreBrowserGlobals() {
  for (const [name, descriptor] of originalBrowserGlobals) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else delete globalThis[name];
  }
}

function createElement() {
  const handlers = new Map();
  return {
    handlers,
    style: {},
    addEventListener(type, handler) {
      handlers.set(type, handler);
    },
    removeEventListener(type) {
      handlers.delete(type);
    },
    getBoundingClientRect() {
      return { left: 0, top: 0, width: 200, height: 100 };
    },
  };
}

test.afterEach(restoreBrowserGlobals);

test("motion hooks are safe to render without browser globals", () => {
  assert.doesNotThrow(() => renderHook(() => useReducedMotion(), { runEffects: false }));
  assert.doesNotThrow(() => renderHook(() => useCountUp(42), { runEffects: false }));
  assert.doesNotThrow(() => renderHook(() => useInViewOnce(), { runEffects: false }));
  assert.doesNotThrow(() => renderHook(() => usePointerParallax(), { runEffects: false }));
});

test("initial motion values match between the server and reduced-motion hydration", () => {
  const serverReduced = renderHook(() => useReducedMotion(), { runEffects: false });
  const serverCountUp = renderHook(
    () => useCountUp(42, { start: 3 }),
    { runEffects: false },
  );

  installBrowser({ reduced: true });
  const clientReduced = renderHook(() => useReducedMotion(), { runEffects: false });
  const clientCountUp = renderHook(
    () => useCountUp(42, { start: 3 }),
    { runEffects: false },
  );

  assert.equal(clientReduced.result, serverReduced.result);
  assert.equal(clientCountUp.result.value, serverCountUp.result.value);
});

test("the browser resolves reduced motion in a layout effect before paint", async () => {
  installBrowser({ reduced: true });
  const clientMotion = await import(`../web/src/lib/motion.js?client-layout=${Date.now()}`);
  const hook = renderHook(() => clientMotion.useReducedMotion());

  assert.equal(hook.result, false);
  assert.equal(hook.layoutEffectCount, 1);
  assert.equal(hook.states[0].value, true);
});

test("reduced-motion preference changes are reversible and clean up their listener", () => {
  const { calls, mediaListeners } = installBrowser();
  const hook = renderHook(() => useReducedMotion());
  const [onChange] = mediaListeners;

  assert.equal(hook.states[0].value, false);
  assert.equal(typeof onChange, "function");
  onChange({ matches: true });
  assert.equal(hook.states[0].value, true);
  onChange({ matches: false });
  assert.equal(hook.states[0].value, false);

  hook.cleanup();
  assert.equal(calls.mediaAdd, 1);
  assert.equal(calls.mediaRemove, 1);
  assert.equal(mediaListeners.size, 0);
});

test("reduced motion settles to static values without RAF, observers, or input listeners", () => {
  const { calls } = installBrowser({ reduced: true });
  const element = createElement();

  const reduced = renderHook(() => useReducedMotion(), { refValue: element });
  const countUp = renderHook(() => useCountUp(42, { start: 3 }), { refValue: element });
  const inView = renderHook(() => useInViewOnce(), { refValue: element });
  const parallax = renderHook(() => usePointerParallax(), { refValue: element });

  assert.equal(reduced.result, false);
  assert.equal(reduced.states[0].value, true);
  assert.equal(countUp.result.value, 3);
  assert.equal(countUp.states[0].value, true);
  assert.equal(countUp.states[1].value, 42);
  assert.equal(inView.result.inView, false);
  assert.equal(inView.states[0].value, true);
  assert.equal(inView.states[1].value, true);
  assert.equal(calls.raf, 0);
  assert.equal(calls.intersectionObserve, 0);
  assert.equal(calls.mediaAdd, 4);
  assert.equal(element.handlers.size, 0);

  parallax.cleanup();
  inView.cleanup();
  countUp.cleanup();
  reduced.cleanup();
  assert.equal(calls.mediaRemove, 4);
});

test("pointer parallax stays idle until pointer input and tears listeners down", () => {
  const { calls } = installBrowser();
  const element = createElement();
  const hook = renderHook(() => usePointerParallax(), { refValue: element });

  assert.equal(calls.raf, 0);
  assert.ok(element.handlers.has("pointermove"));
  assert.ok(element.handlers.has("pointerleave"));

  element.handlers.get("pointermove")({ clientX: 175, clientY: 20 });
  assert.equal(calls.raf, 1);

  hook.cleanup();
  assert.equal(element.handlers.size, 0);
  assert.equal(calls.cancelAnimationFrame, 1);
});

test("count-up starts once on intersection and reaches its target", () => {
  const { calls, intersections, rafCallbacks } = installBrowser();
  const hook = renderHook(() => useCountUp(42, { duration: 900, start: 3 }), {
    refValue: createElement(),
  });

  assert.equal(hook.result.value, 3);
  assert.equal(calls.intersectionObserve, 1);

  intersections[0].callback([{ isIntersecting: true }]);
  intersections[0].callback([{ isIntersecting: true }]);
  assert.equal(calls.raf, 1);

  rafCallbacks[0](1000);
  assert.equal(hook.states[1].value, 42);
  hook.cleanup();
});

test("in-view observes once and records the first intersection", () => {
  const { calls, intersections } = installBrowser();
  const hook = renderHook(() => useInViewOnce(), { refValue: createElement() });

  assert.equal(hook.result.inView, false);
  assert.equal(calls.intersectionObserve, 1);
  intersections[0].callback([{ isIntersecting: true }]);
  assert.equal(hook.states[1].value, true);
  hook.cleanup();
});

test("Reveal and Ambient share the reduced-motion gate", () => {
  assert.match(revealSource, /useReducedMotion/);
  assert.match(revealSource, /const motionProps = reduced/);
  assert.match(ambientSource, /useReducedMotion/);
  assert.doesNotMatch(ambientSource, /ambient-orb/);
});
