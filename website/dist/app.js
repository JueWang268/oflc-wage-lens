/* All comparisons remain local. Each occupation's public wage file loads on demand. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const {bands, tier, thresholds, distribution, validSalary, occupationOptions, findOccupations, unavailableReason} = WageMapCore;
  const money = (n, hourly=false) => new Intl.NumberFormat('en-US', {style:'currency', currency:'USD', minimumFractionDigits:hourly||Math.abs(n-Math.round(n))>0.000001?2:0, maximumFractionDigits:2}).format(n);
  const compact = n => new Intl.NumberFormat('en-US',{notation:'compact', maximumFractionDigits:1}).format(n);
  const params = new URLSearchParams(location.search);
  let salary = params.has('salary') && validSalary(Number(params.get('salary'))) ? Number(params.get('salary')) : 120000;
  let unit = 'year', state = '', selected, data, counties, paths, projection, path, layer, zoom, svg;
  let catalog, options, occupation, wageAreas={}, occupationBusy=false, occupationError=false, loadSerial=0;
  const wageCache=new Map();
  let streetMap,streetPromise,mapMode='county';
  const controls = [...document.querySelectorAll('.toolbar input,.toolbar button,.toolbar select,.map-controls button,.map-modes button,#download')];
  controls.forEach(el => el.disabled = true);
  lucide.createIcons();

  function updateStreetMap() {
    if(!streetMap) return;
    const colors=Object.fromEntries(Object.entries(wageAreas).map(([id,area])=>{
      const level=tier(salary,area);return [id,level===null?'#cbd0ce':bands[level].color];
    }));
    streetMap.update({colors,state,selected});
  }
  function streetStatus(message,retry=false) {
    const el=$('street-status');el.replaceChildren();el.hidden=!message || mapMode!=='street';
    if(!message) return;
    el.append(document.createTextNode(message));
    if(retry) {
      const button=document.createElement('button');button.textContent='Retry';
      button.addEventListener('click',()=>{streetMap?.destroy();streetMap=null;streetPromise=null;delete $('streets').dataset.ready;setMapMode('street');});el.append(button);
    }
  }
  async function setMapMode(mode) {
    mapMode=mode;$('map').hidden=mode!=='county';$('streets').hidden=mode!=='street';$('tooltip').hidden=true;
    $('county-view').setAttribute('aria-pressed',String(mode==='county'));
    $('street-view').setAttribute('aria-pressed',String(mode==='street'));
    if(mode==='county') {$('street-status').hidden=true;return;}
    if(streetMap) {streetMap.resize();streetMap.focus(selected);$('street-status').hidden=!$('street-status').textContent;return;}
    streetStatus('Loading streets & places...');
    if(!streetPromise) streetPromise=import('./streets.mjs').then(({createStreetMap})=>createStreetMap({
      container:$('streets'),counties:data.counties,selected,
      onSelect:id=>{const county=counties.find(f=>f.id===id);if(county) selectCounty(county);},onStatus:streetStatus
    }));
    try {
      streetMap=await streetPromise;updateStreetMap();
      if(mapMode==='street') {streetMap.resize();streetMap.focus(selected);}
    } catch(error) {
      streetPromise=null;streetStatus('Street map unavailable. Enable WebGL & check your connection, or use Counties.',true);
    }
  }

  function updateUrl() {
    if (!validSalary(salary) || !occupation || occupationBusy || occupationError) return;
    const q = new URLSearchParams({salary:String(salary),county:selected.id,occupation:occupation.code});
    if (state) q.set('state',state);
    history.replaceState(null,'',`${location.pathname}?${q}`);
  }
  function syncPay() {
    $('salary').value = unit === 'year' ? salary : Number((salary/2080).toFixed(4));
    $('salary').step = unit === 'year' ? '1000' : '0.01';
    $('salary').max = unit === 'year' ? '10000000' : String(10000000/2080);
    $('year').setAttribute('aria-pressed',String(unit==='year'));
    $('hour').setAttribute('aria-pressed',String(unit==='hour'));
    update();
  }
  function changeUnit(next) {
    unit = next;
    if (!validSalary(salary)) {
      $('year').setAttribute('aria-pressed',String(unit==='year'));
      $('hour').setAttribute('aria-pressed',String(unit==='hour'));
      update(); return;
    }
    syncPay();
  }
  function update() {
    const valid = validSalary(salary);
    $('salary-error').hidden = valid;
    $('salary').setAttribute('aria-invalid',String(!valid));
    $('download').disabled = !valid || occupationBusy || occupationError;
    $('equivalent').textContent = valid ? (unit === 'year' ? `${money(salary/2080,true)} / hour` : `${money(salary)} / year`) : 'Salary unavailable';
    if (valid) {
      const max = Math.max(350000,Math.ceil(salary/50000)*50000);
      $('salary-range').max = max;
      $('slider-max').textContent = `$${compact(max)}`;
      $('salary-range').value = salary;
    }
    paths.attr('fill', f => {
      const value = tier(salary,wageAreas[f.properties.area]);
      return value === null ? '#cbd0ce' : bands[value].color;
    }).attr('opacity',f => !state || f.properties.state===state ? 1 : 0.17);
    const stats = distribution(counties,wageAreas,salary,state);
    const fragment = document.createDocumentFragment();
    bands.forEach((band,i) => {
      const item = document.createElement('div'); item.className='legend-item';
      const swatch = document.createElement('div'); swatch.className='swatch'; swatch.style.background=band.color;
      const title = document.createElement('strong'); title.textContent=band.short;
      const range = document.createElement('small'); range.textContent=band.range;
      const count = document.createElement('div'); count.className='count'; count.textContent=`${stats.counts[i].toLocaleString()} counties`;
      item.append(swatch,title,range,count); fragment.append(item);
    });
    $('legend').replaceChildren(fragment);
    $('coverage').textContent = `${stats.total.toLocaleString()} counties${stats.unknown ? ` · ${stats.unknown} unavailable` : ''} · ${state || '50 states + DC'}`;
    updateDetail(); updateUrl();
  }
  function updateDetail() {
    const p = selected.properties, area=wageAreas[p.area], level=tier(salary,area), rates=thresholds(area);
    $('selected-state').textContent=`${data.states[p.state].toUpperCase()} / ${selected.id}`;
    $('county-name').textContent=p.name;
    $('wage-area').textContent=data.areas[p.area]?.name || 'No unambiguous OFLC wage-area match';
    $('result-label').textContent=occupationBusy?'Loading occupation…':occupationError?'Occupation data unavailable':level === null ? (validSalary(salary)?'Wage data unavailable':'Enter a valid salary') : bands[level].label;
    $('result-pay').textContent=validSalary(salary)?`${money(unit==='year'?salary:salary/2080,unit==='hour')}${unit==='year'?'/yr':'/hr'}`:'Unavailable';
    $('result').style.background=level===null?'#edf0ed':bands[level].color;
    $('result').style.color=level===null?'#35483d':bands[level].ink;
    $('threshold-unit').textContent=unit==='year'?'Annual':'Hourly';
    const fragment=document.createDocumentFragment();
    ['I','II','III','IV'].forEach((roman,i) => {
      const row=document.createElement('div'); row.className='threshold';
      const labels=document.createElement('div'); labels.className='threshold-values';
      const label=document.createElement('span'); label.textContent=`Level ${roman}`;
      const value=document.createElement('strong'); value.textContent=rates?money(unit==='year'?rates[i]:rates[i]/2080,unit==='hour'):'Unavailable';
      labels.append(label,value);
      const track=document.createElement('div'); track.className='threshold-track';
      const fill=document.createElement('span'); fill.style.width=rates?`${rates[i]/rates[3]*100}%`:'0'; fill.style.background=bands[i+1].color;
      track.append(fill); row.append(labels,track); fragment.append(row);
    });
    $('thresholds').replaceChildren(fragment);
    if (level===null) $('next-level').textContent=occupationBusy?'Loading wage thresholds.':occupationError?'Retry loading this occupation to compare wages.':!validSalary(salary)?'No wage level inferred.':unavailableReason(area);
    else if (level===4) $('next-level').textContent=`${money((salary-rates[3])/(unit==='year'?1:2080),unit==='hour')} above the Level IV threshold. OFLC has no Level V.`;
    else $('next-level').textContent=`${money((rates[level]-salary)/(unit==='year'?1:2080),unit==='hour')} ${unit==='year'?'per year':'per hour'} to reach Level ${['I','II','III','IV'][level]}.`;
    paths.classed('selected',f=>f.id===selected.id).filter(f=>f.id===selected.id).raise();
    $('source-unit').textContent=area?.unit==='year'?'Annual (hourly equivalent)':area?.unit==='hour'?'Hourly':'Unavailable';
    updateStreetMap();
  }
  function focusFeature(feature) {
    if(mapMode==='street') streetMap?.focus(feature);
    const [[x0,y0],[x1,y1]]=path.bounds(feature);
    if (![x0,y0,x1,y1].every(Number.isFinite)) return;
    const scale=Math.min(14,0.85/Math.max((x1-x0)/1000,(y1-y0)/640));
    svg.call(zoom.transform,d3.zoomIdentity.translate(500,320).scale(scale).translate(-(x0+x1)/2,-(y0+y1)/2));
  }
  function selectCounty(f, focus=false) {
    selected=f;
    if (state && f.properties.state!==state) {state=''; $('state').value=''; update();}
    $('county-search').value=`${f.properties.name}, ${f.properties.state}`;
    updateDetail(); updateUrl();
    if (focus) focusFeature(f);
  }
  function tooltip(event,f) {
    const p=f.properties, level=tier(salary,wageAreas[p.area]);
    const title=document.createElement('strong'); title.textContent=`${p.name}, ${p.state}`;
    const detail=document.createElement('span'); detail.textContent=level===null?'No comparison available':`${money(salary)} / yr · ${bands[level].label}`;
    $('tooltip').replaceChildren(title,detail); $('tooltip').hidden=false;
    const rect=$('map').getBoundingClientRect(), tip=$('tooltip');
    tip.style.left=`${Math.max(0,Math.min(rect.width-tip.offsetWidth,event.clientX-rect.left+12))}px`;
    tip.style.top=`${Math.max(0,Math.min(rect.height-tip.offsetHeight,event.clientY-rect.top+12))}px`;
  }
  function searchOptions() {
    const query=$('county-search').value.toLowerCase();
    const matches=counties.filter(f=>(!state||f.properties.state===state)&&`${f.properties.name}, ${f.properties.state} ${data.states[f.properties.state]}`.toLowerCase().includes(query)).slice(0,40);
    $('county-list').replaceChildren(...matches.map(f=>{const option=document.createElement('option');option.value=`${f.properties.name}, ${f.properties.state}`;return option;}));
  }
  function selectSearch() {
    const match=counties.find(f=>`${f.properties.name}, ${f.properties.state}`.toLowerCase()===$('county-search').value.trim().toLowerCase());
    if(match) selectCounty(match,true);
  }
  function exportCsv() {
    if(occupationBusy || occupationError || !validSalary(salary)) return;
    const quote=value=>`"${String(value??'').replaceAll('"','""')}"`;
    const rows=[['FIPS','County','State','Wage area','Annual salary','Band','Level I annual','Level II annual','Level III annual','Level IV annual','Wage year','Selected code','Occupation','Wage SOC','Source unit','Source label']];
    for(const f of counties.filter(f=>!state||f.properties.state===state)) {
      const a=wageAreas[f.properties.area], lv=tier(salary,a), rates=thresholds(a);
      rows.push([f.id,f.properties.name,f.properties.state,data.areas[f.properties.area]?.name,salary,lv===null?'Unavailable':bands[lv].label,...(rates||['','','','']),data.meta.wageYear,occupation.code,occupation.title,occupation.soc,a?.unit,a?.label]);
    }
    const url=URL.createObjectURL(new Blob([rows.map(row=>row.map(quote).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}));
    const a=document.createElement('a');a.href=url;a.download=`oflc-${occupation.code}-${state||'US'}-${salary}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function filterOccupations() {
    const matches=findOccupations(options,$('occupation-search').value), fragment=document.createDocumentFragment();
    if(occupation && !matches.some(o=>o.code===occupation.code)) fragment.append(new Option(`${occupation.code} · ${occupation.title}`,occupation.code));
    for(const kind of ['SOC','O*NET']) {
      const group=document.createElement('optgroup');group.label=kind==='SOC'?'SOC wage occupations':'O*NET occupations (mapped SOC wages)';
      matches.filter(o=>o.kind===kind).forEach(o=>group.append(new Option(`${o.code} · ${o.title}`,o.code)));
      if(group.children.length) fragment.append(group);
    }
    if(!matches.length) {const empty=new Option('No matching occupations','');empty.disabled=true;fragment.append(empty);}
    $('occupation-select').replaceChildren(fragment);
    if(occupation) $('occupation-select').value=occupation.code;
  }
  async function selectOccupation(code) {
    const entry=options.find(o=>o.code===code);
    if(!entry) return;
    const serial=++loadSerial;
    occupation=entry;occupationBusy=true;occupationError=false;wageAreas={};
    $('occupation-select').value=entry.code;
    $('occupation-status').textContent=`Loading ${entry.code} · ${entry.title}…`;
    $('occupation-status').className='';$('occupation-retry').hidden=true;
    $('map-title').textContent=entry.title;
    $('occupation-name').textContent=entry.title;$('occupation-soc').textContent=entry.soc;
    $('onet-row').hidden=entry.kind!=='O*NET';$('occupation-onet').textContent=entry.kind==='O*NET'?entry.code:'';
    $('tooltip').hidden=true;update();
    try {
      let payload=wageCache.get(entry.soc);
      if(!payload) {
        const version=catalog.sourceHashes['ALC_Export.csv'];
        const response=await fetch(`data/occupations/${entry.soc}.json?v=${version.slice(0,12)}`,{signal:AbortSignal.timeout(20000)});
        if(!response.ok) throw new Error('Occupation data could not load');
        payload=await response.json();
        if(payload.code!==entry.soc || !payload.areas || typeof payload.areas!=='object' || !Object.keys(payload.areas).length) throw new Error('Invalid occupation data');
        wageCache.set(entry.soc,payload);
      }
      if(serial!==loadSerial) return;
      wageAreas=payload.areas;occupationBusy=false;
      $('occupation-status').textContent='';update();
    } catch(error) {
      if(serial!==loadSerial) return;
      occupationBusy=false;occupationError=true;
      $('occupation-status').textContent=`Could not load ${entry.code}. Retry or choose another occupation.`;
      $('occupation-status').className='error';$('occupation-retry').hidden=false;update();
    }
  }
  async function init() {
    const responses=await Promise.all([fetch('data/counties.json'),fetch('data/occupations.json')]);
    if(responses.some(r=>!r.ok)) throw new Error('Could not load map data');
    [data,catalog]=await Promise.all(responses.map(r=>r.json()));
    options=occupationOptions(catalog);
    const requested=options.find(o=>o.code===params.get('occupation'));
    occupation=requested || options.find(o=>o.code==='15-1252');
    if(!occupation) throw new Error('Default occupation missing');
    $('occupation-count').textContent=`${catalog.occupations.length} SOC · ${options.length-catalog.occupations.length} O*NET`;
    filterOccupations();
    counties=data.counties.features.sort((a,b)=>`${a.properties.state}${a.properties.name}`.localeCompare(`${b.properties.state}${b.properties.name}`));
    if(!counties.length || !data.areas || !data.stateShapes) throw new Error('Incomplete map data');
    selected=counties.find(f=>f.id===params.get('county')) || counties.find(f=>f.id==='48453') || counties[0];
    $('vintage').textContent=data.meta.wageYear;
    $('validity').textContent=`${data.meta.validFrom} to ${data.meta.validThrough}`;
    const today=new Date().toISOString().slice(0,10);
    if(today>data.meta.validThrough || today<data.meta.validFrom) {
      $('notice').hidden=false;
      $('notice').textContent=`${today>data.meta.validThrough?'Wage data may be out of date.':'These wage rates are not yet effective.'} Valid ${data.meta.validFrom} through ${data.meta.validThrough}. Check DOL for a new release & rebuild the map before relying on these comparisons.`;
    }
    Object.entries(data.states).sort((a,b)=>a[1].localeCompare(b[1])).forEach(([abbr,name])=>$('state').add(new Option(name,abbr)));
    projection=d3.geoAlbersUsa().fitExtent([[10,10],[990,625]],data.counties);
    path=d3.geoPath(projection);svg=d3.select('#map');layer=svg.append('g');
    zoom=d3.zoom().scaleExtent([1,16]).translateExtent([[-50,-50],[1050,690]]).on('zoom',event=>{layer.attr('transform',event.transform);$('tooltip').hidden=true;});svg.call(zoom);
    paths=layer.append('g').selectAll('path').data(counties).join('path').attr('class','county').attr('data-fips',f=>f.id).attr('d',path)
      .on('mousemove',tooltip).on('mouseleave',()=>$('tooltip').hidden=true).on('click',(_event,f)=>selectCounty(f));
    layer.append('g').selectAll('path').data(data.stateShapes.features).join('path').attr('class','state-outline').attr('d',path);
    layer.append('g').selectAll('text').data(data.stateShapes.features.filter(f=>!['DC','RI','DE','MD','NJ','MA','CT'].includes(f.id))).join('text')
      .attr('class','state-label').attr('text-anchor','middle').attr('transform',f=>`translate(${path.centroid(f)})`).text(f=>f.id);
    controls.forEach(el=>el.disabled=false);
    $('occupation-search').addEventListener('input',filterOccupations);
    $('occupation-select').addEventListener('change',()=>selectOccupation($('occupation-select').value));
    $('occupation-retry').addEventListener('click',()=>selectOccupation(occupation.code));
    $('salary').addEventListener('input',()=>{salary=$('salary').value===''?NaN:Number($('salary').value)*(unit==='year'?1:2080);update();});
    $('salary-range').addEventListener('input',()=>{salary=Number($('salary-range').value);syncPay();});
    $('year').addEventListener('click',()=>changeUnit('year'));$('hour').addEventListener('click',()=>changeUnit('hour'));
    $('county-search').addEventListener('input',searchOptions);$('county-search').addEventListener('change',selectSearch);$('county-search').addEventListener('keydown',e=>{if(e.key==='Enter') selectSearch();});
    $('state').addEventListener('change',()=>{
      state=$('state').value;$('county-search').value='';searchOptions();
      if(state) {if(selected.properties.state!==state) selected=counties.find(f=>f.properties.state===state);focusFeature(data.stateShapes.features.find(f=>f.id===state));}
      else {svg.call(zoom.transform,d3.zoomIdentity);if(mapMode==='street') streetMap?.reset();}update();
    });
    $('county-view').addEventListener('click',()=>setMapMode('county'));
    $('street-view').addEventListener('click',()=>setMapMode('street'));
    $('zoom-in').addEventListener('click',()=>mapMode==='street'?streetMap?.zoom(1.6):svg.call(zoom.scaleBy,1.6));$('zoom-out').addEventListener('click',()=>mapMode==='street'?streetMap?.zoom(1/1.6):svg.call(zoom.scaleBy,1/1.6));
    $('reset').addEventListener('click',()=>{state='';$('state').value='';$('county-search').value='';svg.call(zoom.transform,d3.zoomIdentity);if(mapMode==='street') streetMap?.reset();searchOptions();update();});
    $('download').addEventListener('click',exportCsv);
    syncPay();searchOptions();
    await selectOccupation(occupation.code);
    $('loading').hidden=true;
    if(params.get('state') && data.states[params.get('state')]) {$('state').value=params.get('state');$('state').dispatchEvent(new Event('change'));}
  }
  init().catch(error=>{
    console.error(error);$('loading').textContent='County data could not load. ';const retry=document.createElement('button');retry.textContent='Retry';retry.addEventListener('click',()=>location.reload());$('loading').append(retry);
    $('result-label').textContent='Data unavailable';
  });
})();
