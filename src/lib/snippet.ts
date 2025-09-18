export interface Snippet {
  category?: string;
  name: string;
  processor_kind: 'inline' | 'display' | 'codeblock';
  processor_id: string;
  content: string;
}
