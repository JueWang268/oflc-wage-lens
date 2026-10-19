import {Map, AttributionControl, setWorkerUrl, setWorkerCount} from './vendor/maplibre-gl.mjs';

setWorkerUrl(new URL('./vendor/maplibre-gl-worker.mjs', import.meta.url).href);
setWorkerCount(2);

export function boundsFor(feature) {
  // Use the shortest longitude span for Alaska's antimeridian-crossing shapes.
  const points=feature.geometry.coordinates.flat(feature.geometry.type==='MultiPolygon'?2:1);
  const longitudes=points.map(p=>(p[0]+360)%360).sort((a,b)=>a-b);
  let gap=-1, start=0, end=0;
  for(let i=0;i<longitudes.length;i++) {
    const next=longitudes[(i+1)%longitudes.length]+(i===longitudes.length-1?360:0);
    if(next-longitudes[i]>gap) {gap=next-longitudes[i];start=next%360;end=longitudes[i];}
  }
  if(end<start) end+=360;
  if(start>180) {start-=360;end-=360;}
  const latitudes=points.map(p=>p[1]);
  return [[start,Math.min(...latitudes)],[end,Math.max(...latitudes)]];
}

export function colorExpression(colors) {
  const pairs=Object.entries(colors).flat();
  return pairs.length?['match',['get','area'],...pairs,'#cbd0ce']:'#cbd0ce';
}

export async function createStreetMap({container,counties,selected,onSelect,onStatus}) {
  const map=new Map({container,style:'https://tiles.openfreemap.org/styles/liberty',
    bounds:boundsFor(selected),fitBoundsOptions:{padding:35,maxZoom:11},
    attributionControl:false,renderWorldCopies:false,maxZoom:16,canvasContextAttributes:{preserveDrawingBuffer:true}});
  map.addControl(new AttributionControl({compact:false}),'bottom-right');
  let ready=false, rejectLoad;
  map.on('error',event=>{
    if(!ready) rejectLoad?.(event.error || new Error('Basemap could not load'));
    else onStatus('Street map data could not fully load. Check your connection or use Counties.',true);
  });
  try {
    await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(new Error('Street map timed out')),25000);
      rejectLoad=error=>{clearTimeout(timer);reject(error);};
      map.once('load',()=>{clearTimeout(timer);resolve();});
    });
    map.addSource('wage-counties',{type:'geojson',data:counties,attribution:'County boundaries: U.S. Census Bureau'});
    const before=map.getStyle().layers.find(l=>l['source-layer']==='transportation'||l.type==='symbol')?.id;
    map.addLayer({id:'wage-fill',type:'fill',source:'wage-counties',paint:{'fill-color':'#cbd0ce','fill-opacity':0.62}},before);
    map.addLayer({id:'wage-border',type:'line',source:'wage-counties',paint:{'line-color':'#34473c','line-width':0.65,'line-opacity':0.65}},before);
    map.addLayer({id:'wage-selected',type:'line',source:'wage-counties',filter:['==',['id'],selected.id],paint:{'line-color':'#10271c','line-width':2.5}},before);
    map.on('click','wage-fill',e=>{if(e.features?.length) onSelect(String(e.features[0].id));});
    map.on('mouseenter','wage-fill',()=>{map.getCanvas().style.cursor='pointer';});
    map.on('mouseleave','wage-fill',()=>{map.getCanvas().style.cursor='';});
    for(const event of ['movestart','resize','sourcedataloading']) map.on(event,()=>{delete container.dataset.ready;});
    map.on('idle',()=>{container.dataset.ready='true';});
    ready=true;
    onStatus('');
  } catch(error) {map.remove();throw error;}
  return {
    update({colors,state,selected}) {
      if(!ready) return;
      map.setPaintProperty('wage-fill','fill-color',colorExpression(colors));
      map.setPaintProperty('wage-fill','fill-opacity',state?['case',['==',['get','state'],state],0.62,0.12]:0.62);
      map.setFilter('wage-selected',['==',['id'],selected.id]);
    },
    focus(feature){map.fitBounds(boundsFor(feature),{padding:35,maxZoom:11,duration:0});},
    resize(){map.resize();},
    zoom(factor){map.zoomTo(map.getZoom()+Math.log2(factor),{duration:0});},
    reset(){map.fitBounds([[-125,24],[-66,50]],{padding:25,duration:0});},
    destroy(){map.remove();}
  };
}
