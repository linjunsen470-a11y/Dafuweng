# Original main-game model portraits

These sixteen 192×192 transparent PNGs are rendered from this project's original `src/engine/CityCharacters.js` models, using the corresponding BoardData profiles. No Richman or third-party image assets are used.

Reproduce with `node render-city-portraits.js` (local Chromium and project dependencies required). Assets are static; the game does not create an additional WebGL context for portraits. The setup selector, player HUD, turn banner and reaction cards use these images only for all sixteen grand-bay profiles. Saved profile/avatar fields are unchanged.
