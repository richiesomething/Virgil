// pdf.js's worker with the Promise polyfills in front of it. Vite bundles this into a plain
// (non-module) worker script, which older Safari can run; module order puts the polyfill first.
import './promises-polyfill'
import 'pdfjs-dist/legacy/build/pdf.worker.mjs'
