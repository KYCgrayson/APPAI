import test from "node:test";
import assert from "node:assert/strict";
import { editorialLink } from "../src/lib/hosted-editorial-links.ts";
import { registerVideoNavigation } from "../src/lib/video-navigation.ts";

class FakeElement {
  order: number;
  scrolls = 0;
  constructor(order: number) { this.order = order; }
  compareDocumentPosition(other: FakeElement) { return this.order < other.order ? 4 : 2; }
  scrollIntoView() { this.scrolls++; }
}
class FakeAnchor extends FakeElement {
  href: string;
  download = "";
  target = "";
  constructor(href: string) { super(0); this.href = href; }
  closest() { return this; }
  getAttribute() { return this.href; }
}

test("delegated same-page links, initial/unknown hashes and back/forward target the correct video", async () => {
  const original = Object.getOwnPropertyDescriptors(globalThis);
  const document = new EventTarget();
  const window = Object.assign(new EventTarget(), { location: { href: "https://appai.info/p/fictional?t=90#second" }, history: { pushState(_state: unknown, _title: string, url: URL) { window.location.href = url.href; } } });
  Object.assign(globalThis, { document, window, Element: FakeElement });
  const calls: [string, number, boolean][] = [];
  const first = new FakeElement(1), second = new FakeElement(2);
  const cleanup: (() => void)[] = [];
  const click = (href: string, modifiers = {}, target = "") => {
    const anchor = new FakeAnchor(href); anchor.target = target;
    const event = new Event("click", { cancelable: true });
    Object.assign(event, { button: 0, ...modifiers });
    Object.defineProperty(event, "target", { value: anchor });
    document.dispatchEvent(event);
    return event;
  };
  try {
    // Register in reverse order; fallback must still use DOM order.
    cleanup.push(registerVideoNavigation({ id: "second", element: second as unknown as HTMLElement, initial: 15, seek: (t, play) => calls.push(["second", t, play]) }));
    cleanup.push(registerVideoNavigation({ id: "first", element: first as unknown as HTMLElement, initial: 5, seek: (t, play) => calls.push(["first", t, play]) }));
    await Promise.resolve();
    assert.deepEqual(calls, [["second", 90, false]]);
    assert.equal(click("?t=30#first").defaultPrevented, true);
    assert.deepEqual(calls.at(-1), ["first", 30, true]);
    assert.equal(window.location.href, "https://appai.info/p/fictional?t=30#first");
    assert.equal(first.scrolls, 1);
    assert.equal(click("?t=60#unknown").defaultPrevented, true);
    assert.deepEqual(calls.at(-1), ["first", 60, true]);
    assert.equal(click("?t=45").defaultPrevented, true);
    assert.deepEqual(calls.at(-1), ["first", 45, true]);
    // Feed title/tile links use this same delegated listener; fake seeks never play media.
    for (const href of ["?t=1:30#second", "/p/fictional?t=90#second"]) {
      const link = editorialLink(href, "https://appai.info", "project-card");
      assert.ok(link); assert.equal(link.external, false);
      assert.equal(click(link.href).defaultPrevented, true);
      assert.deepEqual(calls.at(-1), ["second", 90, true]);
    }
    const count = calls.length;
    for (const event of [click("https://evil.test/p/fictional?t=90"), click("?t=90", { ctrlKey: true }), click("?t=90", {}, "_blank"), click("/p/other?t=90"), click("#first")]) assert.equal(event.defaultPrevented, false);
    assert.equal(calls.length, count);
    window.location.href = "https://appai.info/p/fictional?t=90#second";
    window.dispatchEvent(new Event("popstate"));
    assert.deepEqual(calls.slice(-2), [["second", 90, false], ["first", 5, false]]);
    window.location.href = "https://appai.info/p/fictional";
    window.dispatchEvent(new Event("popstate"));
    assert.deepEqual(calls.slice(-2), [["second", 15, false], ["first", 5, false]]);
    cleanup.forEach(fn => fn()); cleanup.length = 0;
    const ended = calls.length;
    window.dispatchEvent(new Event("hashchange"));
    click("?t=90#first");
    assert.equal(calls.length, ended);
  } finally {
    cleanup.forEach(fn => fn());
    for (const key of ["document", "window", "Element"]) {
      if (original[key]) Object.defineProperty(globalThis, key, original[key]);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});
