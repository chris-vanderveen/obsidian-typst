export interface Snippet {
  category: string;
  name: string;
  kind: 'inline' | 'display' | 'codeblock';
  id: string;
  content: string;
  script: boolean;
}

export const DefaultNewSnippet: Snippet = {
  category: 'Uncategorized',
  name: 'new',
  kind: 'display',
  id: '',
  content: '#CURSOR',
  script: false,
};
