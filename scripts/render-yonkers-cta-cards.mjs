import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import sharp from 'sharp';
import { ImageResponse } from 'next/dist/compiled/@vercel/og/index.node.js';

// ABANDONED DRAFT: the user rejected flattened image cards. This script never
// changed WordPress and is not the approved CTA workflow. Use
// prepare-yonkers-approved-ctas.mjs and the live inline Westchester reference.
const output = '/Users/matthewsalvato/Documents/New project/wordpress-backups/yonkers-cta-2026-09-04';
const assets = path.resolve('public/cta');
const specs = [
  {key:'slip', id:7113, topic:'Slip and Fall', short:'Fall', intro:'A fall on unsafe property can raise questions about responsibility and evidence. Billy Cooper Law can explain your next steps.'},
  {key:'ebike', id:7126, topic:'E-Bike Accident', short:'E-Bike Injury', intro:'An e-bike crash can leave you facing injuries, lost work, and insurance questions. Billy Cooper Law can help you understand your options.'},
  {key:'car', id:7117, topic:'Car Accident', short:'Car Crash', intro:'After a car crash, get clear guidance about evidence, insurance, and deadlines. Billy Cooper Law can explain your next steps.'},
  {key:'rideshare', id:7115, topic:'Uber or Lyft Accident', short:'Rideshare Crash', intro:'Uber and Lyft claims can involve different insurance policies. Billy Cooper Law can investigate the trip and explain your options.'},
  {key:'delivery', id:7124, topic:'Delivery Accident', short:'Delivery Accident', intro:'A delivery accident may involve a driver, company, or several insurers. Billy Cooper Law can investigate who may be responsible.'},
];
const h=React.createElement;
const fonts=[{name:'Billy Serif',data:fs.readFileSync(path.join(assets,'BillySerif.otf')),weight:400,style:'normal'},{name:'Billy Sans',data:fs.readFileSync(path.join(assets,'BillySans.ttf')),weight:400,style:'normal'}];
const portrait='data:image/png;base64,'+fs.readFileSync(path.join(assets,'billy-cooper-cutout-v4.png')).toString('base64');
const manifest=[];
for(const spec of specs.filter(s=>process.argv.length<3||process.argv.slice(2).includes(s.key))){
  const background='data:image/jpeg;base64,'+(await sharp(path.join(output,`${spec.key}-background.png`)).resize(1200,800,{fit:'cover'}).jpeg({quality:88}).toBuffer()).toString('base64');
  for(const slot of ['opening','middle','closing']){
    const article=spec.key==='ebike'?'an':'a';
    const headline=(slot==='opening'?`${spec.topic} in Yonkers NY?`:slot==='middle'?`Questions About ${article} ${spec.short} in Yonkers NY?`:`Discuss Your Yonkers NY ${spec.short}`).replaceAll('Yonkers NY','Yonkers\u00a0NY');
    const message=slot==='opening'?spec.intro:slot==='middle'?`Get clear answers about your ${spec.topic.toLowerCase()} claim. We can explain the evidence, insurance issues, and next steps.`:`Tell Billy Cooper Law about your ${spec.topic.toLowerCase()}. We will listen and help you understand your options.`;
    const card=h('div',{style:{width:'1200px',height:'800px',display:'flex',position:'relative',overflow:'hidden',borderRadius:'30px',backgroundColor:'#082536',backgroundImage:`linear-gradient(90deg,rgba(8,37,54,.98) 0%,rgba(8,37,54,.95) 48%,rgba(8,37,54,.82) 72%,rgba(8,37,54,.54) 100%),url("${background}")`,backgroundSize:'cover',backgroundPosition:'center',color:'white',fontFamily:'Billy Sans'}},
      h('div',{style:{width:'70%',padding:'76px 74px 48px 78px',display:'flex',flexDirection:'column',alignItems:'flex-start',position:'relative'}},
        h('div',{style:{display:'flex',letterSpacing:'5px',fontSize:24,lineHeight:1,color:'#e6c274',fontWeight:800}},'BILLY COOPER LAW'),
        h('div',{style:{maxWidth:625,marginTop:27,fontFamily:'Billy Serif',fontSize:60,fontWeight:400,lineHeight:1.02,letterSpacing:'-2.1px'}},headline),
        h('div',{style:{maxWidth:580,marginTop:28,fontSize:26,lineHeight:1.48,color:'rgba(255,255,255,.94)'}},message),
        h('div',{style:{display:'flex',flexDirection:'column',alignItems:'flex-start',marginTop:32}},
          h('div',{style:{display:'flex',padding:'19px 34px',borderRadius:999,background:'#e6c274',color:'#082536',fontSize:27,fontWeight:900}},'Call (914) 730-5789'),
          h('div',{style:{maxWidth:560,marginTop:26,fontSize:24,lineHeight:1.3,fontWeight:800}},'Free consultation. No upfront legal fee.')
        )
      ),
      h('div',{style:{width:'48%',height:'100%',display:'flex',alignItems:'flex-end',justifyContent:'flex-end',position:'absolute',right:'-30px',bottom:0}},h('img',{src:portrait,alt:'Billy Cooper',width:540,height:585,style:{width:540,height:585,objectFit:'contain',objectPosition:'bottom right'}}))
    );
    const image=new ImageResponse(card,{width:1200,height:800,fonts});
    const file=path.join(output,`billy-yonkers-${spec.key}-cta-${slot}-v3-20260904.jpg`);
    await sharp(Buffer.from(await image.arrayBuffer())).jpeg({quality:90}).toFile(file);
    manifest.push({key:spec.key,id:spec.id,slot,file,headline,alt:`Billy Cooper Law: ${spec.topic.toLowerCase()} help in Yonkers NY. Free consultation. Call (914) 730-5789.`,width:1200,height:800});
  }
}
console.log(JSON.stringify(manifest));
