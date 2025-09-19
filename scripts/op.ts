import type { SymbolData } from './symbols';

const difs = ['dif', 'Dif'].map((name) => ({
  sym: name,
  unicName: '',
  name: name,
  shorthand: null,
  mathClass: 'op',
  latexName: '',
})) as SymbolData[];

const limits = ['det', 'gcd', 'lcm', 'inf', 'lim', 'liminf', 'limsup', 'max', 'min', 'Pr', 'sup'].map((name) => ({
  sym: name,
  unicName: '',
  name: name,
  shorthand: null,
  mathClass: 'op',
  latexName: '',
})) as SymbolData[];

const others = [
  'arccos',
  'arcsin',
  'arctan',
  'arg',
  'cos',
  'cosh',
  'cot',
  'coth',
  'csc',
  'csch',
  'ctg',
  'deg',
  'dim',
  'exp',
  'hom',
  'id',
  'im',
  'inf',
  'ker',
  'lg',
  'ln',
  'log',
  'mod',
  'sec',
  'sech',
  'sin',
  'sinc',
  'sinh',
  'tan',
  'tanh',
  'tg',
  'tr',
].map((name) => ({
  sym: name,
  unicName: '',
  name: name,
  shorthand: null,
  mathClass: 'op',
  latexName: '',
})) as SymbolData[];

export const ops = [...difs, ...limits, ...others];

// 参照: https://github.com/typst/typst/blob/main/crates/typst-library/src/math/op.rs
