import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import JSZip from "jszip";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = "/Users/annasblackhat/Documents/Experiment/video-generation-frontend";

function getDimensions(o, q) {
  q = q || "720p"; o = o || "horizontal";
  if (o === "square") { const dim = q === "720p" ? 720 : q === "4k" ? 2160 : 1080; return { width: dim, height: dim }; }
  if (q === "1080p") return o === "vertical" ? { width: 1080, height: 1920 } : { width: 1920, height: 1080 };
  if (q === "4k") return o === "vertical" ? { width: 2160, height: 3840 } : { width: 3840, height: 2160 };
  return o === "vertical" ? { width: 720, height: 1280 } : { width: 1280, height: 720 };
}
function collectScopedFiles(rootDir) {
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
  const keepDeps=["remotion","@remotion/bundler","@remotion/renderer","@remotion/player","@remotion/tailwind","react","react-dom","clsx","tailwind-merge","tailwindcss","lucide-react"];
  const dependencies={}; for(const k of keepDeps){if(raw.dependencies?.[k]) dependencies[k]=raw.dependencies[k]; else if(raw.devDependencies?.[k]) dependencies[k]=raw.devDependencies[k]; else warnings.push(`Dep ${k} missing`);}
  if(!dependencies["tailwindcss"]&&raw.devDependencies?.["tailwindcss"]) dependencies["tailwindcss"]=raw.devDependencies["tailwindcss"];
  return JSON.stringify({name:`colab-render-${Date.now()}`,version:"1.0.0",private:true,type:"module",scripts:{render:"node scripts/render_colab.mjs --state project_state.json --out output.mp4"},dependencies},null,2);
}
function buildNotebookJson(jobId){
  const nb={nbformat:4,nbformat_minor:0,metadata:{colab:{provenance:[]},kernelspec:{name:"python3",display_name:"Python 3"}},cells:[
    {cell_type:"markdown",source:[`# 🎬 Colab Video Renderer — ${jobId.slice(0,8)}\n`,`One-click Remotion render (whip-pan demo) >500Mbps.\n`,`Upload companion \`colab-render-*.zip\` when prompted, then Run All.\n`],metadata:{}},
    {cell_type:"code",source:["# Step 1: Check Environment (Node, vCPUs, RAM, FFmpeg)\n","!node -v && echo \"---\" && echo \"vCPUs: $(nproc)\" && free -h | grep Mem && echo \"---\" && ffmpeg -version | head -n1\n"],metadata:{},execution_count:null,outputs:[]},
    {cell_type:"code",source:["# Step 2: Upload & Install\n","import os, glob, json, textwrap, pathlib\n","!ls -lh colab-render-*.zip 2>/dev/null || echo \"Please upload colab-render-*.zip via Files panel, then re-run this cell\"\n","!unzip -q -o colab-render-*.zip 2>/dev/null && echo \"✅ Unzipped\" || echo \"No zip found yet\"\n","!ls -d colab-render-*/ 2>/dev/null | head -n1\n"],metadata:{},execution_count:null,outputs:[]},
    {cell_type:"code",source:["# Step 2b: Install Dependencies\n","!cd $(ls -d colab-render-*/ 2>/dev/null | head -n1 || echo .) && npm install --no-audit --prefer-offline\n"],metadata:{},execution_count:null,outputs:[]},
    {cell_type:"code",source:["# Step 3: Inspect Bundle & Chunk Plan\n","BUNDLE_DIR=$(ls -d colab-render-*/ 2>/dev/null | head -n1); BUNDLE_DIR=${BUNDLE_DIR:-.}\n","!cd $BUNDLE_DIR 2>/dev/null || cd .; echo \"Bundle dir: $(pwd)\" && ls -lh project_state.json scripts/render_colab.mjs 2>&1 | head && echo \"---\" && cat project_state.json | python3 -c \"import json,sys; s=json.load(open('project_state.json')); print(f\\\"Duration: {s.get('totalDuration')}s | Frames: {int(s.get('totalDuration',0)*s.get('fps',30))} | Style: {s.get('transitionStyle')} | Chunks: N=min(6,max(2,cpu))\\\")\" 2>&1 | head\n"],metadata:{},execution_count:null,outputs:[]},
    {cell_type:"code",source:["# Step 3b: Parallel Chunk Render (whip-pan motion blur)\n","BUNDLE_DIR=$(ls -d colab-render-*/ 2>/dev/null | head -n1); BUNDLE_DIR=${BUNDLE_DIR:-.}\n","!cd $BUNDLE_DIR 2>/dev/null || cd .; node scripts/render_colab.mjs --state project_state.json --out output.mp4\n"],metadata:{},execution_count:null,outputs:[]},
    {cell_type:"code",source:["# Step 4: Preview & Download\n","from IPython.display import Video as IPVideo, display\n","import pathlib\n","cand = list(pathlib.Path('.').rglob('output.mp4'))\n","p = str(cand[0]) if cand else 'output.mp4'\n","print(f\"Preview: {p}\")\n","try:\n","    display(IPVideo(p, width=640))\n","except Exception as e:\n","    print(f\"Preview unavailable: {e}\")\n","from google.colab import files\n","try:\n","    files.download(p)\n","except Exception as e:\n","    print(f\"Download trigger failed (use Files panel): {e}\")\n"],metadata:{},execution_count:null,outputs:[]},
  ]};
  return JSON.stringify(nb,null,2);
}

const warnings=[];
const jobId="whip-pan-demo";
const quality="720p"; const fps=30;
const {width,height}=getDimensions("horizontal",quality);
const testState={
  jobId: "whip-pan-test-job",
  fps,
  totalDuration: 6.0,
  width, height,
  orientation: "horizontal",
  transitionStyle: "whip-pan",
  tracks: [
    {id:"video",label:"Visuals",type:"video",items:[
      {id:"clip_1",trackStart:0,trackEnd:3.0,duration:3.0,assetType:"video",storageUrl:"https://cdn.pixabay.com/video/2015/08/10/228-135860602_medium.mp4",sourceIn:0,sourceOut:3.0,zIndex:1},
      {id:"clip_2",trackStart:3.0,trackEnd:6.0,duration:3.0,assetType:"video",storageUrl:"https://cdn.pixabay.com/video/2024/08/13/226200_medium.mp4",sourceIn:0,sourceOut:3.0,zIndex:1},
    ]},
    {id:"text",label:"Captions",type:"text",items:[
      {id:"txt_1",trackStart:0.5,trackEnd:2.8,duration:2.3,content:"Whip-Pan Transition Demo — Scene 1",style:"standard"},
      {id:"txt_2",trackStart:3.2,trackEnd:5.8,duration:2.6,content:"Scene 2 — whip-pan motion blur at cut",style:"standard"},
    ]},
  ],
};
const updatedState={...testState, width, height, fps, render_engine:"remotion-colab"};
const zip=new JSZip();
const scopedFiles=collectScopedFiles(rootDir);
const bundleDir=`colab-render-${jobId.slice(0,8)}`;
for(const f of scopedFiles){ zip.file(`${bundleDir}/${f.rel}`, fs.readFileSync(f.abs)); }
zip.file(`${bundleDir}/project_state.json`, JSON.stringify(updatedState,null,2));
zip.file(`${bundleDir}/package.json`, buildMinimalPackageJson(rootDir,warnings));
zip.file(`${bundleDir}/Colab_Video_Renderer.ipynb`, buildNotebookJson(jobId));
const buffer=await zip.generateAsync({type:"nodebuffer", compression:"DEFLATE", compressionOptions:{level:9}});
const outPath=path.join(rootDir,"public/renders/colab_export_whip-pan.zip");
fs.writeFileSync(outPath, buffer);
console.log(`✅ Whip-pan export created: ${outPath} (${(buffer.length/1024).toFixed(1)}KB)`);
console.log(`Files: ${scopedFiles.length} scoped + 3 + 0 assets`);
console.log(`State: transitionStyle=${updatedState.transitionStyle} width=${width} height=${height}`);
console.log(`Warnings: ${warnings.join(" | ")||"none"}`);
console.log(`Preview: cat ${outPath.replace(rootDir, ".")}/project_state.json | grep transitionStyle`);
