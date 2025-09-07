import TypstElement from './Typst';

export default class TypstSVGElement extends TypstElement {
  constructor() {
    super();
    this.renderingFormat = 'svg';
  }
}
