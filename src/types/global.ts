import type { FontData } from '@/core/settings/font';

declare global {
  interface Window {
    queryLocalFonts?: () => Promise<FontData[]>;
  }
}
