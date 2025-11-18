import { debounce } from "obsidian";

type Callback = (entry: ResizeObserverEntry) => void;

export class Observer {
  private ro: ResizeObserver;
  private mo: MutationObserver;
  private pollId: number | null = null;

  private registered = new Map<Element, { cb: Callback; debounceMs: number }>();
  private waiting = new Set<Element>();
  private parentToChildren = new Map<Element, Set<Element>>();
  private parentDebouncers = new Map<
    Element,
    (entry: ResizeObserverEntry) => void
  >();

  constructor() {
    // 親要素のリサイズを監視
    this.ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const parent = entry.target as Element;
        const deb = this.parentDebouncers.get(parent);
        if (deb) deb(entry);
      }
    });

    // DOM 変化を監視
    this.mo = new MutationObserver(() => {
      this.tryAttachWaiting();
      this.cleanupDisconnected();
    });
    if (document.body) {
      this.mo.observe(document.body, { childList: true, subtree: true });
    }

    // ポーリング
    this.pollId = window.setInterval(() => {
      this.tryAttachWaiting();
      this.cleanupDisconnected();
    }, 250);
  }

  register(el: Element, cb: Callback, debounceMs: number): () => void {
    this.registered.set(el, { cb, debounceMs });

    const parent = el.parentElement;
    if (parent) {
      this.attachToParent(el, parent);
      this.recreateParentDebouncer(parent);
    } else {
      this.waiting.add(el);
    }

    return () => this.unregister(el);
  }

  unregister(el: Element) {
    this.registered.delete(el);
    this.waiting.delete(el);

    for (const [parent, children] of this.parentToChildren.entries()) {
      if (children.delete(el) && children.size === 0) {
        this.ro.unobserve(parent);
        this.parentToChildren.delete(parent);
        this.parentDebouncers.delete(parent);
      }
    }
  }

  private attachToParent(el: Element, parent: Element) {
    let set = this.parentToChildren.get(parent);
    if (!set) {
      set = new Set();
      this.parentToChildren.set(parent, set);
      this.ro.observe(parent);
    }
    set.add(el);
    this.waiting.delete(el);
  }

  private recreateParentDebouncer(parent: Element) {
    const children = this.parentToChildren.get(parent);
    if (!children) return;

    let maxMs = 300;
    for (const child of children) {
      const reg = this.registered.get(child);
      if (reg && reg.debounceMs > maxMs) maxMs = reg.debounceMs;
    }

    const fn = (entry: ResizeObserverEntry) => {
      for (const child of children) {
        const reg = this.registered.get(child);
        if (reg) reg.cb(entry);
      }
    };

    this.parentDebouncers.set(parent, debounce(fn, maxMs, true));
  }

  private tryAttachWaiting() {
    for (const el of Array.from(this.waiting)) {
      if (el.parentElement) {
        this.attachToParent(el, el.parentElement);
        this.recreateParentDebouncer(el.parentElement);
      }
    }
  }

  private cleanupDisconnected() {
    for (const el of Array.from(this.registered.keys())) {
      if (!el.isConnected) this.unregister(el);
    }
  }

  stopAll() {
    this.ro.disconnect();
    this.mo.disconnect();
    if (this.pollId) clearInterval(this.pollId);
    this.registered.clear();
    this.waiting.clear();
    this.parentToChildren.clear();
    this.parentDebouncers.clear();
  }
}
