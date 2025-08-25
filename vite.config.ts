import builtinModules from 'builtin-modules';
import { defineConfig, type UserConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig(async ({ mode }) => {
  const prod = mode === 'production';

  return {
    plugins: [
      tsconfigPaths(),
      prod
        ? viteStaticCopy({
            targets: [
              {
                src: 'node_modules/@myriaddreamin/typst-ts-renderer/pkg/typst_ts_renderer_bg.wasm',
                dest: '',
                rename: 'renderer.wasm',
              },
              {
                src: 'node_modules/@myriaddreamin/typst-ts-web-compiler/pkg/typst_ts_web_compiler_bg.wasm',
                dest: '',
                rename: 'compiler.wasm',
              },
              {
                src: 'manifest.json',
                dest: '',
                rename: 'manifest.json',
              },
            ],
          })
        : undefined,
    ],
    build: {
      lib: {
        entry: 'src/main.ts',
        formats: ['cjs'],
      },
      emptyOutDir: prod,

      minify: 'esbuild',
      rollupOptions: {
        output: {
          entryFileNames: 'main.js',
          assetFileNames: 'styles.css',
          inlineDynamicImports: true,
        },
        external: [
          'obsidian',
          'electron',
          '@codemirror/autocomplete',
          '@codemirror/collab',
          '@codemirror/commands',
          '@codemirror/language',
          '@codemirror/lint',
          '@codemirror/search',
          '@codemirror/state',
          '@codemirror/view',
          '@lezer/common',
          '@lezer/highlight',
          '@lezer/lr',
          ...builtinModules,
        ],
      },
    },
  } as UserConfig;
});
