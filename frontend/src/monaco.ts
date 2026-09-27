/**
 * Monaco is bundled locally instead of loaded from a CDN.
 *
 * That matters in a sandboxed preview: the editor works even when the browser cannot
 * reach the internet, and workers resolve through Vite's module graph.
 */
import * as monaco from 'monaco-editor';
import { loader } from '@monaco-editor/react';
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker';
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker';
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';

window.MonacoEnvironment = {
  getWorker(_moduleId: string, label: string) {
    switch (label) {
      case 'json':
        return new jsonWorker();
      case 'css':
      case 'scss':
      case 'less':
        return new cssWorker();
      case 'html':
      case 'handlebars':
      case 'razor':
        return new htmlWorker();
      case 'typescript':
      case 'javascript':
        return new tsWorker();
      default:
        return new editorWorker();
    }
  },
};

monaco.editor.defineTheme('drips-dark', {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: 'comment', foreground: '6b7d99', fontStyle: 'italic' },
    { token: 'keyword', foreground: '67e8f9' },
    { token: 'string', foreground: 'a5e8a5' },
    { token: 'number', foreground: 'fbbf24' },
    { token: 'type', foreground: '7dd3fc' },
    { token: 'function', foreground: 'c4b5fd' },
  ],
  colors: {
    'editor.background': '#05070d',
    'editor.foreground': '#e2e8f0',
    'editorLineNumber.foreground': '#3b4d70',
    'editorLineNumber.activeForeground': '#67e8f9',
    'editor.selectionBackground': '#12445c',
    'editor.lineHighlightBackground': '#0b1220',
    'editorCursor.foreground': '#22d3ee',
    'editorIndentGuide.background1': '#18233a',
    'editorGutter.background': '#05070d',
    'minimap.background': '#05070d',
    'scrollbarSlider.background': '#1f2c4666',
    'editorOverviewRuler.border': '#00000000',
  },
});

loader.config({ monaco });

export { monaco };
