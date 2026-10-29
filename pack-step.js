/* GLB encoding for the OpenCascade import result, preserving each occurrence. */
globalThis.BaggioPackStep=function(result,id){
 if(!result.success||!result.meshes?.length)throw Error('Aucun solide 3D trouvé dans ce STEP.');
 if(result.meshes.length>2000)throw Error('Cet assemblage dépasse 2 000 éléments. Exporte un sous-assemblage.');
 const doc={asset:{version:'2.0',generator:'Atelier Baggio STEP import'},scene:0,scenes:[{nodes:[]}],nodes:[],meshes:[],materials:[],buffers:[{byteLength:0}],bufferViews:[],accessors:[]};
 const chunks=[];let length=0;
 function accessor(values,Type,componentType,type,target,bounds=false){
  const typed=new Type(values),bytes=new Uint8Array(typed.buffer);const bufferView=doc.bufferViews.push({buffer:0,byteOffset:length,byteLength:bytes.length,target})-1;chunks.push(bytes);length+=bytes.length;
  const pad=(4-length%4)%4;if(pad){chunks.push(new Uint8Array(pad));length+=pad;}
  const entry={bufferView,componentType,count:values.length/(type==='VEC3'?3:1),type};
  if(bounds){entry.min=[Infinity,Infinity,Infinity];entry.max=[-Infinity,-Infinity,-Infinity];for(let i=0;i<values.length;i++){entry.min[i%3]=Math.min(entry.min[i%3],values[i]);entry.max[i%3]=Math.max(entry.max[i%3],values[i]);}}
  return doc.accessors.push(entry)-1;
 }
 const counts={},seen={};result.meshes.forEach(m=>{const n=m.name||'Pièce';counts[n]=(counts[n]||0)+1});
 const catalog=[];
 result.meshes.forEach((mesh,i)=>{
  const name=(mesh.name||'Pièce').slice(0,160),partId=`${id}-part-${i+1}`;seen[mesh.name||'Pièce']=(seen[mesh.name||'Pièce']||0)+1;
  const label=counts[mesh.name||'Pièce']>1?`${name} · ${seen[mesh.name||'Pièce']}/${counts[mesh.name||'Pièce']}`:name;
  const attributes={POSITION:accessor(mesh.attributes.position.array,Float32Array,5126,'VEC3',34962,true)};
  if(mesh.attributes.normal)attributes.NORMAL=accessor(mesh.attributes.normal.array,Float32Array,5126,'VEC3',34962);
  const indices=accessor(mesh.index.array,Uint32Array,5125,'SCALAR',34963);
  doc.materials.push({pbrMetallicRoughness:{baseColorFactor:[.65,.7,.76,1],metallicFactor:.15,roughnessFactor:.6},doubleSided:true});
  doc.meshes.push({name,primitives:[{attributes,indices,material:i}]});doc.nodes.push({name,mesh:i,extras:{partId,label}});doc.scenes[0].nodes.push(i);
  catalog.push({id:partId,name,label,initialState:'todo'});
 });
 if(length>25*1024*1024)throw Error('La conversion dépasse 25 Mo. Exporte un assemblage simplifié.');
 doc.buffers[0].byteLength=length;
 const json=new TextEncoder().encode(JSON.stringify(doc)),jsonLength=(json.length+3)&~3,total=28+jsonLength+length;
 const output=new Uint8Array(total),view=new DataView(output.buffer);view.setUint32(0,0x46546c67,true);view.setUint32(4,2,true);view.setUint32(8,total,true);view.setUint32(12,jsonLength,true);view.setUint32(16,0x4e4f534a,true);output.fill(0x20,20,20+jsonLength);output.set(json,20);
 view.setUint32(20+jsonLength,length,true);view.setUint32(24+jsonLength,0x004e4942,true);let offset=28+jsonLength;for(const chunk of chunks){output.set(chunk,offset);offset+=chunk.length;}
 return {buffer:output.buffer,catalog};
};
