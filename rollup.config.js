import typescript from '@rollup/plugin-typescript';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';

export default {
  input: 'src/obsidian-plugin/main.ts',
  output: {
    file: 'test-notes/.obsidian/plugins/vibe-boi/main.js',
    sourcemap: 'inline',
    format: 'cjs',
    exports: 'default',
    inlineDynamicImports: true // Prevent code splitting
  },
  external: ['obsidian'],
  plugins: [
    typescript(),
    nodeResolve({ browser: true }),
    commonjs()
  ]
};