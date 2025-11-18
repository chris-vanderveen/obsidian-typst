export function overwriteCustomElements(
  tagName: string,
  newCtor: CustomElementConstructor,
) {
  const registry = window.customElements;
  const existing = registry.get(tagName);

  if (!existing) {
    registry.define(tagName, newCtor);
    return;
  }

  const copyProps = (src: any, dst: any) => {
    const keys = Object.getOwnPropertyNames(src).concat(
      Object.getOwnPropertySymbols(src) as any,
    );
    for (const k of keys) {
      if (k === "constructor") continue;
      const desc = Object.getOwnPropertyDescriptor(src, k)!;
      Object.defineProperty(dst, k, desc);
    }
  };

  copyProps(newCtor.prototype, existing.prototype);

  const staticKeys = Object.getOwnPropertyNames(newCtor).filter(
    (k) => !["length", "name", "prototype"].includes(k),
  );
  for (const k of staticKeys) {
    const desc = Object.getOwnPropertyDescriptor(newCtor, k)!;
    Object.defineProperty(existing, k, desc);
  }

  try {
    existing.prototype.constructor = newCtor;
  } catch {}

  const els = Array.from(document.querySelectorAll(tagName));
  const observed = (newCtor as any).observedAttributes ?? [];

  for (const el of els) {
    Object.setPrototypeOf(el, existing.prototype);

    if (
      el.isConnected &&
      typeof (newCtor.prototype as any).connectedCallback === "function"
    ) {
      try {
        (newCtor.prototype as any).connectedCallback.call(el);
      } catch (err) {
        console.error("connectedCallback error", err);
      }
    }

    if (
      observed.length > 0 &&
      typeof (newCtor.prototype as any).attributeChangedCallback === "function"
    ) {
      for (const attr of observed) {
        if ((el as Element).hasAttribute(attr)) {
          try {
            (newCtor.prototype as any).attributeChangedCallback.call(
              el,
              attr,
              null,
              (el as Element).getAttribute(attr),
            );
          } catch (err) {
            console.error("attributeChangedCallback error", err);
          }
        }
      }
    }
  }
}
