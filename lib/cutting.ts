export function cuttingNumber(value:string){const n=Number(value.trim().replace(',','.'));return value.trim()&&Number.isFinite(n)&&n>0?n:null}
export function cuttingCalculation(kind:'n'|'vc'|'milling'|'turning',values:{diameter:number;vc:number;n:number;fz:number;z:number;f:number}){
 const positive=(...xs:number[])=>xs.every(x=>Number.isFinite(x)&&x>0);
 let result:number|null=null;
 if(kind==='n'&&positive(values.diameter,values.vc))result=1000*values.vc/(Math.PI*values.diameter);
 if(kind==='vc'&&positive(values.diameter,values.n))result=Math.PI*values.diameter*values.n/1000;
 if(kind==='milling'&&positive(values.n,values.fz,values.z)&&Number.isInteger(values.z))result=values.n*values.z*values.fz;
 if(kind==='turning'&&positive(values.n,values.f))result=values.n*values.f;
 return result!==null&&Number.isFinite(result)?result:null;
}
