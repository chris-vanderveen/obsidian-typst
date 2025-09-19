export class CustomFragment extends DocumentFragment {
  override appendText(text: string) {
    const t = document.createTextNode(text);
    this.appendChild(t);
    return this;
  }

  appendBoldText(text: string) {
    const b = document.createElement('b');
    b.textContent = text;
    this.appendChild(b);
    return this;
  }

  appendCodeText(text: string) {
    const code = document.createElement('code');
    code.textContent = text;
    this.appendChild(code);
    return this;
  }

  appendLinkText(text: string, href: string) {
    const a = document.createElement('a');
    a.textContent = text;
    a.setAttribute('href', href);
    this.appendChild(a);
    return this;
  }
}
