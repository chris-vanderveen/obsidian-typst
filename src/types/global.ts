import type { FontData } from '@/lib/font';

declare global {
  interface Window {
    queryLocalFonts?: () => Promise<FontData[]>;
  }
}
