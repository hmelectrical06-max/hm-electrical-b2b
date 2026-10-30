'use strict';

const PDFDocument=require('pdfkit');
const {company}=require('./core.cjs');

function printable(value){
  return String(value??'').replaceAll('₹','INR ').replaceAll('·','-')
    .replace(/[^\x20-\x7e]/g,' ').replace(/\s+/g,' ').trim();
}
function money(value){
  return 'INR '+new Intl.NumberFormat('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(value)||0);
}
function lineText(doc,text,width,fontSize=8){
  doc.font('Helvetica').fontSize(fontSize);
  return doc.heightOfString(printable(text),{width});
}
function quotePdf(quotation){
  return new Promise((resolve,reject)=>{
    const doc=new PDFDocument({size:'A4',margin:42,bufferPages:true,info:{
      Title:`Quotation ${quotation.quotation_number} Rev ${quotation.revision}`,
      Author:company.brand||'HM ELECTRICAL',
      Subject:'Material quotation'
    }});
    const chunks=[];
    doc.on('data',chunk=>chunks.push(chunk));
    doc.on('error',reject);
    doc.on('end',()=>resolve(Buffer.concat(chunks)));
    try{
      const left=42,right=doc.page.width-42,width=right-left;
      const drawHeader=()=>{
        doc.fillColor('#173653').font('Helvetica-Bold').fontSize(20).text(printable(company.brand),left,42,{width:width*.62});
        doc.fillColor('#334155').font('Helvetica').fontSize(8)
          .text(printable(company.address),left,68,{width:width*.62,lineGap:2});
        doc.text(`Phone: ${printable(company.phone)}  GSTIN: ${printable(company.gstin)}`,left,doc.y+3,{width:width*.62});
        doc.fillColor('#173653').font('Helvetica-Bold').fontSize(17)
          .text('QUOTATION',right-width*.34,44,{width:width*.34,align:'right'});
        doc.fillColor('#344054').font('Helvetica').fontSize(9)
          .text(`No: ${printable(quotation.quotation_number)}`,right-width*.48,69,{width:width*.48,align:'right'})
          .text(`Revision: ${quotation.revision}  |  Status: ${printable(quotation.status).toUpperCase()}`,right-width*.48,83,{width:width*.48,align:'right'})
          .text(`Date: ${new Intl.DateTimeFormat('en-IN',{dateStyle:'medium',timeZone:'Asia/Kolkata'}).format(new Date(quotation.updated_at||quotation.created_at||Date.now()))}`,right-width*.48,97,{width:width*.48,align:'right'});
        doc.moveTo(left,125).lineTo(right,125).strokeColor('#d0d5dd').stroke();
        doc.y=137;
      };
      const ensureSpace=height=>{
        if(doc.y+height>doc.page.height-55){doc.addPage();drawHeader();}
      };
      drawHeader();
      doc.fillColor('#173653').font('Helvetica-Bold').fontSize(10).text('CUSTOMER',left,doc.y);
      doc.fillColor('#101828').font('Helvetica-Bold').fontSize(11).text(printable(quotation.customer_name),left,doc.y+15,{width:width*.52});
      let customerY=doc.y+31;
      for(const value of [quotation.company_name,quotation.mobile,quotation.email,quotation.customer_gstin,quotation.billing_address]){
        if(!value)continue;
        const height=lineText(doc,value,width*.52,8);
        ensureSpace(height+3);
        doc.font('Helvetica').fontSize(8).fillColor('#344054').text(printable(value),left,customerY,{width:width*.52});
        customerY=doc.y+3;
      }
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#173653')
        .text('Place of supply: '+printable(quotation.place_of_supply||'Not specified'),right-width*.43,doc.y+15,{width:width*.43,align:'right'});
      doc.y=Math.max(customerY+8,doc.y+34);
      if(quotation.shipping_address){
        const h=lineText(doc,quotation.shipping_address,width,8)+4;
        ensureSpace(h);
        doc.font('Helvetica-Bold').fontSize(8).fillColor('#344054').text('Ship to: ',left,doc.y,{continued:true});
        doc.font('Helvetica').text(printable(quotation.shipping_address),{width});
        doc.moveDown(.6);
      }
      const columns=[
        {label:'Item / description',x:left,w:width*.31,align:'left'},
        {label:'HSN/SAC',x:left+width*.31,w:width*.1,align:'left'},
        {label:'Qty',x:left+width*.41,w:width*.08,align:'right'},
        {label:'Rate',x:left+width*.49,w:width*.14,align:'right'},
        {label:'Discount',x:left+width*.63,w:width*.13,align:'right'},
        {label:'Tax',x:left+width*.76,w:width*.08,align:'right'},
        {label:'Amount',x:left+width*.84,w:width*.16,align:'right'}
      ];
      const drawTableHeader=()=>{
        ensureSpace(22);
        doc.rect(left,doc.y,right-left,21).fill('#eaf0f6');
        columns.forEach(col=>doc.fillColor('#173653').font('Helvetica-Bold').fontSize(7).text(col.label,col.x+3,doc.y+7,{width:col.w-6,align:col.align,lineBreak:false}));
        doc.y+=21;
      };
      drawTableHeader();
      for(const item of quotation.items||[]){
        const description=`${item.item_type==='service'?'Custom service':item.product_code} - ${item.description} (${item.unit})`;
        const descriptionHeight=lineText(doc,description,columns[0].w-8,7);
        const rowHeight=Math.max(26,descriptionHeight+12);
        ensureSpace(rowHeight);
        const y=doc.y;
        doc.moveTo(left,y+rowHeight).lineTo(right,y+rowHeight).strokeColor('#e4e7ec').stroke();
        doc.font('Helvetica').fontSize(7).fillColor('#101828').text(printable(description),columns[0].x+3,y+6,{width:columns[0].w-8});
        const values=[
          item.hsn_sac||'-',
          `${item.quantity} ${item.unit}`,
          money(item.unit_rate),
          money(item.discount_amount),
          item.tax_rate===null?'—':`${item.tax_rate}%`,
          money(item.taxable_amount+item.tax_amount)
        ];
        values.forEach((value,index)=>{
          const col=columns[index+1];
          doc.font('Helvetica').fontSize(7).fillColor('#344054')
            .text(printable(value),col.x+3,y+7,{width:col.w-6,align:col.align});
        });
        doc.y=y+rowHeight;
        if(doc.y>doc.page.height-100)drawTableHeader();
      }
      const totals=[
        ['Subtotal',money(quotation.subtotal)],
        ['Discount',money(quotation.discount_total)],
        ['Taxable value',money(quotation.taxable_total)],
        ...(quotation.tax_mode==='intra_state'?[['CGST',money(quotation.cgst_amount)],['SGST',money(quotation.sgst_amount)]]:[]),
        ...(quotation.tax_mode==='inter_state'?[['IGST',money(quotation.igst_amount)]]:[]),
        ['Freight (tax treatment to verify)',money(quotation.freight)],
        ['Other charges (tax treatment to verify)',money(quotation.other_charges)]
      ];
      ensureSpace(totals.length*16+35);
      const totalX=right-width*.48;
      for(const [label,value] of totals){
        doc.font('Helvetica').fontSize(8).fillColor('#344054').text(label,totalX,doc.y,{width:width*.3});
        doc.text(value,right-width*.18,doc.y,{width:width*.18,align:'right'});
        doc.moveDown(.65);
      }
      doc.moveTo(totalX,doc.y).lineTo(right,doc.y).strokeColor('#98a2b3').stroke();
      doc.moveDown(.35);
      doc.font('Helvetica-Bold').fontSize(12).fillColor('#173653')
        .text('GRAND TOTAL  '+money(quotation.grand_total),totalX,doc.y,{width:width*.48,align:'right'});
      doc.moveDown(1.3);
      const terms=[
        ['Validity',quotation.valid_until||'Not specified'],
        ['Payment terms',quotation.payment_terms],
        ['Delivery terms',quotation.delivery_terms],
        ['Warranty terms',quotation.warranty_terms],
        ['Notes',quotation.notes]
      ].filter(([,value])=>value);
      if(terms.length){
        ensureSpace(20);
        doc.font('Helvetica-Bold').fontSize(9).fillColor('#173653').text('TERMS AND NOTES',left,doc.y);
        doc.moveDown(.45);
        for(const [label,value] of terms){
          const text=`${label}: ${value}`,h=lineText(doc,text,width,8)+5;
          ensureSpace(h);
          doc.font('Helvetica').fontSize(8).fillColor('#344054').text(printable(text),left,doc.y,{width});
          doc.moveDown(.25);
        }
      }
      ensureSpace(42);
      doc.moveDown(.8);
      doc.font('Helvetica-Bold').fontSize(8).fillColor('#8a632c')
        .text('This is a quotation, not a tax invoice or confirmed order.',left,doc.y,{width});
      doc.font('Helvetica').fontSize(7).fillColor('#667085')
        .text('Review tax rates, place of supply, freight/other-charge tax treatment, company details and terms before issuing. No payment has been collected.',left,doc.y+12,{width});
      const pages=doc.bufferedPageRange();
      for(let index=pages.start;index<pages.start+pages.count;index++){
        doc.switchToPage(index);
        doc.font('Helvetica').fontSize(8).fillColor('#667085')
          .text('HM ELECTRICAL | Quotation only - not a tax invoice',42,doc.page.height-28,{align:'left',lineBreak:false})
          .text(`Page ${index-pages.start+1} of ${pages.count}`,42,doc.page.height-28,{align:'right',lineBreak:false});
      }
      doc.end();
    }catch(error){reject(error);}
  });
}

module.exports={quotePdf,money,printable};
