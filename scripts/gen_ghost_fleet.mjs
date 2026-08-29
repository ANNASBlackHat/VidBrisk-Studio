import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import JSZip from "jszip";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = "/Users/annasblackhat/Documents/Experiment/video-generation-frontend";
const pipelineRoot = "/Users/annasblackhat/Documents/Experiment/video-generation-pipeline";

// Load ghost fleet timeline
const timelinePath = path.join(pipelineRoot, "output/ghost_fleet_timeline.json");
const timeline = JSON.parse(fs.readFileSync(timelinePath, "utf-8"));
console.log(`Loaded timeline: ${timeline.total_duration}s, tracks: ${timeline.tracks.map(t=> `${t.type}:${t.items.length}`).join(", ")}`);

// Build EditorProjectState from TimelineJSON (minimal conversion)
function getResolution(o="horizontal"){
  if(o==="vertical") return {width:1080,height:1920};
  if(o==="square") return {width:1080,height:1080};
  return {width:1920,height:1080};
}
const orientation="horizontal";
const {width,height}=getResolution(orientation);
const fps=30;

const projectState = {
  jobId: "ghost-fleet",
  fps,
  totalDuration: timeline.total_duration,
  width,
  height,
  orientation,
  transitionStyle: "glitch", // punchier for long doc, use glitch per new spec
  tracks: timeline.tracks.map(track => ({
    id: track.type, // video/text/audio
    label: track.type === "video" ? "Visuals & Motion Graphics" : track.type === "text" ? "Captions" : "Voiceover Track",
    type: track.type,
    items: (track.items||[]).map(item => ({
      id: item.id,
      trackId: track.type,
      trackStart: item.trackStart,
      trackEnd: item.trackEnd,
      duration: (item.trackEnd||0)-(item.trackStart||0),
      assetType: item.assetType || item.type || "video",
      assetId: item.assetId || item.chunk_id,
      sourceIn: item.sourceIn ?? item.source_in ?? 0,
      sourceOut: item.sourceOut ?? item.source_out ?? ((item.trackEnd||0)-(item.trackStart||0)),
      storagePath: item.storagePath || item.storage_path,
      storageUrl: item.storageUrl || item.storage_url || item.storagePath || item.storage_path,
      componentId: item.componentId || item.component_id,
      props: item.props || {},
      rawContent: item.rawContent || item.content,
      content: item.content,
      style: item.style,
      zIndex: item.zIndex ?? item.z_index ?? 0,
      layoutRole: item.layoutRole || item.layout || "full",
      // carry over beat metadata if any
      // For audio, assetId is the wav path, keep as is
      ...(item.assetId && item.assetId.includes("/ghost_fleet/") ? { storagePath: item.assetId, storageUrl: item.assetId } : {}),
    })),
  })),
  selectedClipId: timeline.tracks[0]?.items[0]?.id || null,
  metadata: timeline.metadata,
};

console.log(`Built projectState: ${projectState.totalDuration}s, ${projectState.tracks[0].items.length} video, ${projectState.tracks[1].items.length} text, ${projectState.tracks[2].items.length} audio, transitionStyle=${projectState.transitionStyle}`);

// Now replicate export-colab ZIP logic
function collectScopedFiles(rootDir){
  const files=[]; const pushFile=(rel)=>{const abs=path.join(rootDir,rel); if(fs.existsSync(abs)&&fs.statSync(abs).isFile()) files.push({abs,rel});};
  const pushDir=(relDir)=>{const absDir=path.join(rootDir,relDir); if(!fs.existsSync(absDir)) return; const walk=(dir)=>{for(const entry of fs.readdirSync(dir)){const abs=path.join(dir,entry); const stat=fs.statSync(abs); if(stat.isDirectory()) walk(abs); else files.push({abs,rel:path.relative(rootDir,abs)});}}; walk(absDir);};
  pushFile("tailwind.config.ts"); pushFile("postcss.config.mjs"); pushFile("tsconfig.json");
  pushFile("scripts/bundle_remotion.mjs"); pushFile("scripts/render_colab.mjs");
  pushFile("src/app/globals.css"); pushFile("src/remotion/index.tsx");
  pushFile("src/lib/types.ts"); pushFile("src/lib/utils.ts"); pushFile("src/lib/transitions.ts");
  pushFile("src/adapters/timelineToEditorState.ts"); pushFile("src/components/editor/VideoComposition.tsx");
  pushDir("src/components/motion");
  return files;
}
function buildMinimalPackageJson(rootDir,warnings){
  const raw=JSON.parse(fs.readFileSync(path.join(rootDir,"package.json"),"utf-8"));
  const keepDeps=["remotion","@remotion/bundler","@remotion/renderer","@remotion/player","@remotion/tailwind","@remotion/noise","react","react-dom","clsx","tailwind-merge","tailwindcss","lucide-react"];
  const dependencies={}; for(const k of keepDeps){if(raw.dependencies?.[k]) dependencies[k]=raw.dependencies[k]; else if(raw.devDependencies?.[k]) dependencies[k]=raw.devDependencies[k]; else warnings.push(`Dep ${k} missing`);}
  if(!dependencies["tailwindcss"]&&raw.devDependencies?.["tailwindcss"]) dependencies["tailwindcss"]=raw.devDependencies["tailwindcss"];
  return JSON.stringify({name:`colab-render-ghost-fleet`,version:"1.0.0",private:true,type:"module",scripts:{render:"node scripts/render_colab.mjs --state project_state.json --out output.mp4"},dependencies},null,2);
}
function buildNotebookJson(jobId){
  const nb={nbformat:4,nbformat_minor:0,metadata:{colab:{provenance:[]},kernelspec:{name:"python3",display_name:"Python 3"}},cells:[
    {cell_type:"markdown",source:[`# 🎬 Ghost Fleet — ${jobId} (Supersonic, CPU Only)\n`,`**314s, 32 beats, 42 video + 32 audio (supersonic), 5 candidates/beat — rendered on Colab CPU with 2 workers, glitch transition.**\n`,`Upload this \`.zip\` then **Run All** — uses parallel chunking + FFmpeg concat (<1s). No GPU needed.\n`],metadata:{}},
    {cell_type:"code",source:["# Step 1: Env Check (Node, vCPUs, RAM, FFmpeg)\n","!node -v && echo \"---\" && echo \"vCPUs: $(nproc)\" && free -h | grep Mem && echo \"---\" && ffmpeg -version | head -n1\n"],metadata:{},execution_count:null,outputs:[]},
    {cell_type:"code",source:["# Step 2: Unzip\n","import pathlib\n","!ls -lh colab-render-*.zip 2>/dev/null | head\n","!unzip -q -o colab-render-*.zip 2>/dev/null && echo \"✅ Unzipped\" || echo \"No zip\"\n","!ls -d colab-render-*/ 2>/dev/null | head -n1\n"],metadata:{},execution_count:null,outputs:[]},
    {cell_type:"code",source:["# Step 2b: Install\n","BUNDLE=$(ls -d colab-render-*/ 2>/dev/null | head -n1); BUNDLE=${BUNDLE:-.}\n","!cd $BUNDLE 2>/dev/null || cd .; npm install --no-audit --prefer-offline 2>&1 | tail -n 20\n"],metadata:{},execution_count:null,outputs:[]},
    {cell_type:"code",source:["# Step 3: Inspect\n","BUNDLE=$(ls -d colab-render-*/ 2>/dev/null | head -n1); BUNDLE=${BUNDLE:-.}\n","!cd $BUNDLE 2>/dev/null || cd .; ls -lh project_state.json assets/audio 2>&1 | head -n 20 && echo \"---\" && cat project_state.json | python3 -c \"import json; s=json.load(open('project_state.json')); print(f\\\"Duration {s['totalDuration']}s | FPS {s['fps']} | Tracks {len(s['tracks'])} | Video {len(s['tracks'][0]['items'])} | Audio {len(s['tracks'][2]['items'])} | Glitch at boundaries\\\")\"\n"],metadata:{},execution_count:null,outputs:[]},
    {cell_type:"code",source:["# Step 3b: Render (CPU 2 workers, ~150 frames/s, ~60s for 314s)\n","BUNDLE=$(ls -d colab-render-*/ 2>/dev/null | head -n1); BUNDLE=${BUNDLE:-.}\n","!cd $BUNDLE 2>/dev/null || cd .; node scripts/render_colab.mjs --state project_state.json --out output.mp4 2>&1 | tail -n 100\n"],metadata:{},execution_count:null,outputs:[]},
    {cell_type:"code",source:["# Step 4: Preview & Download\n","from IPython.display import Video as IPVideo, display\n","import pathlib\n","cand=list(pathlib.Path('.').rglob('output.mp4'))\n","p=str(cand[0]) if cand else 'output.mp4'\n","print(f\"Preview {p} size {pathlib.Path(p).stat().st_size/1024/1024:.1f} MB\" if pathlib.Path(p).exists() else \"Not found\")\n","try: display(IPVideo(p, width=640))\n","except Exception as e: print(e)\n","from google.colab import files\n","try: files.download(p)\nexcept Exception as e: print(f\"Download via Files panel: {e}\")\n"],metadata:{},execution_count:null,outputs:[]},
  ]};
  return JSON.stringify(nb,null,2);
}

const warnings=[];
const warningsHeader=[];
const jobId="ghost-fleet";
const rootDir=frontendRoot;
const updatedState={...projectState, render_engine:"remotion-colab"};
// Embed local audio assets
const embeddedAssets=[];
for(const track of updatedState.tracks){
  for(const item of track.items||[]){
    for(const key of ["storageUrl","storagePath","assetId"]){
      const val=item[key];
      if(!val || typeof val!=="string") continue;
      if(val.startsWith("http://")||val.startsWith("https://")||val.startsWith("assets/")) continue;
      const clean=val.replace("file://","");
      const tryPaths=[clean, path.join(rootDir,clean), path.join(pipelineRoot,clean), path.resolve(clean)];
      const found=tryPaths.find(p=> fs.existsSync(p) && fs.statSync(p).isFile());
      if(found){
        const basename=path.basename(found);
        const isAudio=key==="assetId" || /\.(wav|mp3|m4a|aac|ogg|flac)$/i.test(basename);
        const zippedAs=isAudio? `assets/audio/${basename}` : `assets/${basename}`;
        if(!embeddedAssets.some(a=>a.zippedAs===zippedAs)) embeddedAssets.push({original:found, zippedAs});
        item[key]=zippedAs;
        if(key==="storagePath" && !item.storageUrl) item.storageUrl=zippedAs;
        if(key==="assetId" && found.endsWith(".wav")) { item.storagePath=zippedAs; item.storageUrl=zippedAs; }
      } else {
        warnings.push(`Local asset not found: ${val} (${item.id})`);
      }
    }
  }
}
console.log(`Embedded assets: ${embeddedAssets.length} audio wavs (${(embeddedAssets.reduce((s,a)=>s+fs.statSync(a.original).size,0)/1024/1024).toFixed(1)} MB)`);

const zip=new JSZip();
const scopedFiles=collectScopedFiles(rootDir);
const bundleDir=`colab-render-${jobId}`;
for(const f of scopedFiles) zip.file(`${bundleDir}/${f.rel}`, fs.readFileSync(f.abs));
zip.file(`${bundleDir}/project_state.json`, JSON.stringify(updatedState,null,2));
zip.file(`${bundleDir}/package.json`, buildMinimalPackageJson(rootDir,warnings));
zip.file(`${bundleDir}/Colab_Video_Renderer.ipynb`, buildNotebookJson(jobId));
for(const a of embeddedAssets) zip.file(`${bundleDir}/${a.zippedAs}`, fs.readFileSync(a.original));

const buffer=await zip.generateAsync({type:"nodebuffer", compression:"DEFLATE", compressionOptions:{level:9}});
const outPath=path.join(frontendRoot, "public/renders/colab_ghost_fleet.zip");
fs.writeFileSync(outPath, buffer);
console.log(`✅ Ghost Fleet Colab zip: ${outPath} (${(buffer.length/1024/1024).toFixed(2)} MB)`);
console.log(`  scoped:${scopedFiles.length} + embedded:${embeddedAssets.length} audio, warnings:${warnings.length}`);
if(warnings.length) console.log(warnings.slice(0,3).join(" | "));
