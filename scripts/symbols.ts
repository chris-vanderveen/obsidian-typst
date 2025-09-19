import puppeteer from 'puppeteer';

// 準備
const browser = await puppeteer.launch();
const page = await browser.newPage();
await page.goto('https://typst.app/docs/reference/symbols/sym');

export interface SymbolData {
  sym: string;
  unicName: string;
  name: string;
  shorthand: string | null;
  mathClass: string;
  latexName: string;
}
let symbols: SymbolData[] = [];

// 抽出
const buttons = await page.$$('main > .symbol-grid > li > button');
for (const button of buttons) {
  await button.click();
  const flyout = await page.waitForSelector('main > .symbol-grid > .symbol-flyout');
  const symbol = await flyout?.evaluate(async (el) => {
    const sym = el.querySelector('.sym')?.textContent!;
    const unicName = el.querySelector('.unic-name')?.textContent!;
    const name = el.querySelector('.sym-name code')?.textContent!;
    const shorthand = el.querySelector('.shorthand code')?.textContent!;
    const mathClass = el.querySelector('.math-class span')?.textContent!;
    const latexName = el.querySelector('.latex-name code')?.textContent!;

    const button = el.querySelector('button');
    button!.click();

    return {
      sym,
      unicName,
      name,
      shorthand: shorthand === '' ? null : shorthand,
      mathClass,
      latexName,
    };
  });

  if (symbol) symbols.push(symbol);
  else throw new Error('symbol not found');
}

// 処理
await browser.close();

const ops = await import('./op');
symbols = [...symbols, ...ops.ops];

type typstName = string;

const JSONData: { [key: typstName]: SymbolData } = {};

for (const symbol of symbols) {
  if (symbol.shorthand) JSONData[symbol.shorthand] = symbol;
  JSONData[symbol.name] = symbol;
}

// 出力
await Bun.file('src/data/symbols.json').write(JSON.stringify(JSONData));
