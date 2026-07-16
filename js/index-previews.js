// Landing-page preview bootstrap for the main index: runs the antlii-stack and
// legacy preview modules together so both tool families animate. Each module
// only renders the cards whose data-preview key it owns (the legacy module's
// duplicate keys — flake/boids/rhythm/refract — were removed, so there is no
// collision with the antlii cards).
import { initPreviews } from './antlii/previews.js';
import { initPreviews as initLegacy } from './previews.js';
initPreviews();
initLegacy();
