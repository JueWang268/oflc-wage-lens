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
  function thresholds(area) {
    if (!area || !['', 'Annual Wage'].includes(area.label || '')) return null;
    const unit = area.unit || (area.label === 'Annual Wage' ? 'year' : 'hour');
    if (!['year','hour'].includes(unit) || (area.label === 'Annual Wage' && unit !== 'year')) return null;
    if (!Array.isArray(area.levels) || area.levels.length !== 4 || area.levels.some((n,i)=>!Number.isFinite(n)||n<=0||(i>0&&n<area.levels[i-1]))) return null;
    return area.levels.map(n=>Math.round(n*(unit==='year'?1:core.HOURS)*100)/100);
  }
  function tier(salary, area) {
    const rates=thresholds(area);
    if(!validSalary(salary) || !rates) return null;
    return rates.reduce((level,rate,i)=>Math.round(salary*100)>=Math.round(rate*100)?i+1:level,0);
  }
  function occupationOptions(catalog) {
    return catalog.occupations.flatMap(o=>[
      {code:o.code, title:o.title, soc:o.code, kind:'SOC'},
      ...o.onet.map(onet=>({...onet,soc:o.code,kind:'O*NET'}))
    ]);
  }
  function findOccupations(options, query) {
    const words=String(query).toLowerCase().trim().split(/\s+/).filter(Boolean);
    return options.filter(o=>words.every(word=>`${o.code} ${o.title} ${o.soc}`.toLowerCase().includes(word)));
  }
  function unavailableReason(area) {
    if(area?.label==='High Wage') return 'High-wage record: OFLC does not publish four leveled rates here.';
    if(area?.label==='No Leveled Wage') return 'OFLC reports no leveled wage for this occupation in this area.';
    return 'Four wage thresholds are not available for this occupation in this area.';
  }
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
  const api = {bands, tier, validSalary, thresholds, distribution, occupationOptions, findOccupations, unavailableReason};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.WageMapCore = api;
})(globalThis);
