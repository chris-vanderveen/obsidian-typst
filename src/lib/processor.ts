export const RenderingEngineTokens = ['typst', 'mathjax'] as const;
export type RenderingEngine = (typeof RenderingEngineTokens)[number];

export const InlineStylingTokens = ['inline', 'inline-middle'] as const;
export type InlineStyling = (typeof InlineStylingTokens)[number];

export const DisplayStylingTokens = ['block', 'block-center'] as const;
export type DisplayStyling = (typeof DisplayStylingTokens)[number];

export type Styling = InlineStyling | DisplayStyling | CodeblockStyling;

export const CodeblockStylingTokens = [
  'block',
  'block-center',
  'codeblock',
] as const;
export type CodeblockStyling = (typeof CodeblockStylingTokens)[number];

export interface InlineProcessor {
  id: string;
  renderingEngine: RenderingEngine;
  format: string;
  styling: InlineStyling;
  noPreamble: boolean;
}
export interface DisplayProcessor {
  id: string;
  renderingEngine: RenderingEngine;
  format: string;
  styling: DisplayStyling;
  noPreamble: boolean;
}
export interface CodeblockProcessor {
  id: string;
  renderingEngine: RenderingEngine;
  format: string;
  styling: CodeblockStyling;
  noPreamble: boolean;
}

export type Processor = InlineProcessor | DisplayProcessor | CodeblockProcessor;
export type Processors =
  | InlineProcessor[]
  | DisplayProcessor[]
  | CodeblockProcessor[];

export const ProcessorKindTokens = ['inline', 'display', 'codeblock'] as const;
export type ProcessorKind = (typeof ProcessorKindTokens)[number];

export const DefaultNewInlineProcessor: InlineProcessor = {
  id: '',
  renderingEngine: 'typst',
  format: '',
  styling: 'inline-middle',
  noPreamble: false,
};

export const DefaultNewDisplayProcessor: DisplayProcessor = {
  id: '',
  renderingEngine: 'typst',
  format: '',
  styling: 'block-center',
  noPreamble: false,
};

export const DefaultNewCodeblockProcessor: CodeblockProcessor = {
  id: '',
  renderingEngine: 'typst',
  format: '',
  styling: 'block',
  noPreamble: false,
};

export const DefaultNewProcessor: Record<ProcessorKind, Processor> = {
  inline: DefaultNewInlineProcessor,
  display: DefaultNewDisplayProcessor,
  codeblock: DefaultNewCodeblockProcessor,
} as const;
