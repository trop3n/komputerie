// Landing-page preview bootstrap: runs the antlii-stack and legacy preview
// modules together so both tool families on the main page animate. Each module
// only renders the cards whose data-preview key it owns; the key sets are
// disjoint (16 antlii + 12 legacy).
import { initPreviews } from './antlii/previews.js';
import { initPreviews as initLegacy } from './previews.js';
initPreviews();
initLegacy();
