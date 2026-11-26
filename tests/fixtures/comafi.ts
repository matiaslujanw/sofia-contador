import type {ComafiLine} from '../../src/lib/imports/comafi';

// Entirely synthetic. Column coordinates model the verified bank layout, never client data.
export function syntheticComafiRows(month='2026-09'):ComafiLine[]{
 const rows:ComafiLine[]=[];
 const start=new Date(`${month}-01T00:00:00Z`);start.setUTCDate(0);
 const end=new Date(`${month}-01T00:00:00Z`);end.setUTCMonth(end.getUTCMonth()+1);end.setUTCDate(0);
 const bankDate=(date:Date)=>date.toISOString().slice(0,10).split('-').reverse().join('/');
 const push=(parts:[string,number][])=>{const items=parts.map(([text,x])=>({text,x,width:text.length*4.448}));rows.push({text:items.map(i=>i.text).join(' '),items,page:1,line:rows.length+1});};
 const money=(value:string,right:number):[string,number]=>[value,right-value.length*4.448];
 const header=()=>{push([['DETALLE DE MOVIMIENTOS',28]]);push([['Fecha',33],['Conceptos',66],['Referencias',196],['Débitos',381],['Créditos',453],['Saldo',545]]);push([[bankDate(start),28],['Saldo Anterior',293],money('1.000,00',570)]);};
 push([['COMAFI PYME CUENTA CORRIENTE BANCARIA EN PESOS',28]]);push([['Número 0001-00001-1',28]]);header();
 push([[`03/${month.slice(5)}/${month.slice(0,4)}`,28],['Transferencia recibida',66]]);
 push([['REF-SINTETICA',196],money('500,00',490),money('1.500,00',570)]);
 const movement=(concept:string,debit:string,credit:string,balance?:string)=>push([[`04/${month.slice(5)}/${month.slice(0,4)}`,28],[concept,66],['TEST',196],...(debit?[money(debit,415)]:[]),...(credit?[money(credit,490)]:[]),...(balance?[money(balance,570)]:[])]);
 movement('Impuesto a los creditos-tasa g','3,00','','1.497,00');
 movement('Transferencia Terceros eBankin','200,00','','1.297,00');
 movement('Comision transferencias e-Bank','10,00','');
 movement('IVA - Alicuota General','2,10','');
 movement('Percepcion IVA RG 2408','0,30','');
 movement('Intereses por descubierto','20,00','');
 movement('IVA - Alicuota Reducida','2,10','');
 movement('Impuesto a los Sellos Tucuman','1,00','');
 movement('Impuesto a los debitos - tasa','0,50','');
 movement('Reverso comision','', '2,00');
 movement('Ajuste a identificar','3,00','','1.260,00');
 push([[`Saldo al: ${bankDate(end)}`,297],money('1.260,00',570)]);
 push([['DEBITOS DIRECTOS RECHAZADOS',28]]);push([['04/09/2026 IVA rechazo no contabilizado',28],money('99,00',415)]);
 for(const [number,currency] of [['0001-00002-1','PESOS'],['0001-00003-1','DOLARES']]){
  push([[`COMAFI PYME CUENTA CORRIENTE ESPECIAL EN ${currency}`,28]]);push([[`Nro. ${number}`,28]]);header();push([['SIN MOVIMIENTOS',320]]);push([[`Saldo al: ${bankDate(end)}`,297],money('1.000,00',570)]);
 }
 return rows;
}

export function syntheticComafiPdf(month?:string){
 const rows=syntheticComafiRows(month);
 const escape=(text:string)=>text.replaceAll('\\','\\\\').replaceAll('(','\\(').replaceAll(')','\\)');
 const stream=rows.flatMap((row,i)=>row.items.map(item=>`BT /F1 8 Tf ${item.x.toFixed(3)} ${780-i*14} Td (${escape(item.text)}) Tj ET`)).join('\n');
 const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 800] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',`<< /Length ${Buffer.byteLength(stream,'latin1')} >>\nstream\n${stream}\nendstream`];
 let result='%PDF-1.4\n';const offsets=[0];
 for(const [i,object] of objects.entries()){offsets.push(Buffer.byteLength(result,'latin1'));result+=`${i+1} 0 obj\n${object}\nendobj\n`;}
 const xref=Buffer.byteLength(result,'latin1');result+=`xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(n=>`${String(n).padStart(10,'0')} 00000 n \n`).join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
 return {name:'comafi-movimientos-sinteticos.pdf',mimeType:'application/pdf',buffer:Buffer.from(result,'latin1')};
}
