(function(root) {
  'use strict';
  const core = typeof module !== 'undefined' && module.exports ? require('./wage-core.js') : root.WageLensCore;
  const bands = [
    {label:'Below Level I', short:'Below I', range:'< I', color:'#810e29', ink:'#ffffff'},
    {label:'Level I', short:'Level I', range:'I ≤ pay < II', color:'#e05852', ink:'#351017'},
    {label:'Level II', short:'Level II', range:'II ≤ pay < III', color:'#efcb49', ink:'#382e0a'},
    {label:'Level III', short:'Level III', range:'III ≤ pay < IV', color:'#a6cc6b', ink:'#233b16'},
    {label:'Level IV+', short:'Level IV+', range:'≥ IV', color:'#208859', ink:'#ffffff'}
  ];
  const validSalary = n => Number.isFinite(n) && n > 0 && n <= 10000000;
  const tier = (salary, area) => validSalary(salary) ? core.classify(salary, area) : null;
  const thresholds = area => core.classify(1, area) === null ? null : area.levels.map(n => Math.round(n * 2080 * 100) / 100);
  function distribution(features, areas, salary, state = '') {
    const counts = [0,0,0,0,0]; let unknown = 0, total = 0;
    for (const feature of features) {
      if (state && feature.properties.state !== state) continue;
      total++;
      const value = tier(salary, areas[feature.properties.area]);
      if (value === null) unknown++; else counts[value]++;
    }
    return {counts, unknown, total};
  }
  const api = {bands, tier, validSalary, thresholds, distribution};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.WageMapCore = api;
})(globalThis);
