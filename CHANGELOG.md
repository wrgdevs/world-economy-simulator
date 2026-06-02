# Changelog

## 0.3.0 - Visual polish

### Added
- Command-center hero treatment with gradient title, scenario score orb, and richer status chips.
- Glassmorphism dashboard cards, improved buttons, card hover states, table styling, scrollbars, and stronger background depth.
- More polished responsive styling for mobile and narrow screens.

### Verified
- `npm run build` passes.
- `npm run lint` passes.

## 0.2.0 - Feature enhancements

### Added
- Policy preset panel for balanced, free-trade, protectionist, austerity, stimulus, and crisis-test scenarios.
- Browser save/load for keeping edited Scenario A/B worlds locally.
- JSON export/import for sharing scenario configurations or attaching reproducible runs to GitHub issues.
- Policy advisor panel that recommends tuning steps based on inflation, debt, happiness, trade volume, stress/collapse states, and trade dependency.
- Extra UI styles for presets, status messages, hidden imports, and advisor cards.

### Verified
- `npm run build` passes.
- `npm run lint` passes.

## 0.1.0 - Initial GitHub-ready version

### Added
- Multi-country economy simulation with production, trade, inflation, migration, and debt.
- Scenario A/B comparison workflow.
- Seeded stochastic event system for crises and booms.
- AI policy controls for automatic fiscal/trade adjustments.
- Chart.js visualizations and automated economic insights.
- Project README with setup, scripts, architecture overview, and future improvements.

### Fixed
- Removed an unused React import that blocked TypeScript builds.
- Resolved a React Hooks lint warning in the active-country status map.
- Clamped numeric control input before sending updates to app state.
