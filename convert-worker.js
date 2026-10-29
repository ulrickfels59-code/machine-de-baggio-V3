/* STEP conversion is performed off the page's main thread. */
importScripts('./occt-import-js.js','./pack-step.js');
const ready=occtimportjs({locateFile:name=>new URL(name,self.location.href).href});
self.onmessage=async event=>{
 try{
  self.postMessage({status:'Préparation du lecteur STEP…'});
  const occt=await ready;self.postMessage({status:'Conversion de l’assemblage 3D…'});
  const result=occt.ReadStepFile(new Uint8Array(event.data.buffer),{linearUnit:'meter',linearDeflectionType:'absolute_value',linearDeflection:.0002,angularDeflection:.4});
  const packed=globalThis.BaggioPackStep(result,event.data.id);
  self.postMessage({done:true,buffer:packed.buffer,catalog:packed.catalog},[packed.buffer]);
 }catch(error){self.postMessage({error:error instanceof Error?error.message:'Ce fichier STEP ne peut pas être converti.'});}
};
