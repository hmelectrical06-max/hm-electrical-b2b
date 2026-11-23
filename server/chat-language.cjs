'use strict';
// Language handling stays local. Only canonical enquiry text reaches the existing
// public catalogue/service engine; translations cannot create commercial facts.
const LANGUAGES=['auto','en','hi','mr','ur','roman'];
const CONTACT='8085560156 / 7905681022 | hmelectrical06@gmail.com';
function detect(messages,choice='auto'){
 if(!LANGUAGES.includes(choice))throw Error('Choose a supported chat language.');
 if(choice!=='auto')return choice;
 for(const m of messages.filter(m=>m.role==='user').slice().reverse()){
  const q=m.content;
  if(/[\u0600-\u06ff]/.test(q))return 'ur';
  if(/[\u0904-\u0939]/.test(q)){
   if(/मराठी|मला|आहे|आहेत|पाहिजे|तुमच्याकडे|किती|चाहिजे|करायचे|आम्हाला|सांगा|कामासाठी/.test(q))return 'mr';
   if(/मुझे|हमें|चाहिए|बताओ|बताइए|हिंदी/.test(q))return 'hi';
   return messages.some(x=>x.role==='user'&&/मला|आहे|पाहिजे|तुमच्याकडे|आम्हाला/.test(x.content))?'mr':'hi';
  }
  if(/\b(chahiye|chaiye|chaheye|pahije|mala|ahe|aahe|sanga|mujhe|muje|aapke|apke|aap|apka|tumhare|kitna|kitne|batao|bataiye|kya|hai|hain|taar|bijli|bijlee|mazdoor|majdoor|kaam|kam ka|nahi|nhi|namaste|salam|salaam|assalam|wala|wale|karna)\b/i.test(q))return 'roman';
  // Short product/brand/size follow-ups keep the customer's earlier language.
  if((q.match(/[a-z]{2,}/gi)||[]).filter(x=>!/^(mm|sqmm|pcs|nos|mtr|rolls?|kg|amp|polycab|ashirvad|supreme|havells|finolex)$/i.test(x)).length>=3)return 'en';
 }
 return 'en';
}
const aliases=[
 ['electrical',['इलेक्ट्रिकल','इलेक्ट्रिक','विद्युत','बिजली','बिजली का','الیکٹریکل','الیکٹرک','بجلی','bijli','bijlee']],
 ['electrician',['इलेक्ट्रीशियन','इलेक्ट्रिशियन','इलेक्ट्रिशन','बिजली मिस्त्री','الیکٹریشن','الیکٹريشن','electrican','eletrician']],
 ['plumber',['प्लंबर','प्लम्बर','नळ कारागीर','प्लंबर्स','پلمبر','پلمبرز']],
 ['plumbing',['प्लंबिंग','प्लम्बिंग','प्लंबींग','پلمبنگ']],
 ['fire fighting',['फायर फायटिंग','फायर फाइटिंग','अग्निशमन','فائر فائٹنگ','firefiting']],
 ['wire',['वायर','तार','वायरी','तारा','وائر','تار','taar']],
 ['cable',['केबल','केबल्स','کیبل','کیبلز']],
 ['pipe',['पाईप','पाइप','पाईप्स','پائپ','پائپس']],
 ['valve',['व्हॉल्व्ह','वाल्व','वाल्व्ह','والو']],
 ['flange',['फ्लैंज','फ्लेंज','فلینج']],
 ['elbow',['एल्बो','एल्बोव','ایلبو']],
 ['tee',['टी फिटिंग','टीज','ٹی فٹنگ']],
 ['reducer',['रिड्यूसर','रिड्युसर','ریڈیوسر']],
 ['socket',['सॉकेट','साकेट','ساکٹ']],
 ['sprinkler',['स्प्रिंकलर','स्प्रिंकलर्स','اسپرنکلر']],
 ['gland',['ग्लैंड','ग्लँड','گلینڈ']],
 ['lug',['लग्स','लग','لگس']],
 ['switch',['स्विच','سوئچ']],
 ['light',['लाइट','लाईट','बत्ती','لائٹ']],
 ['earthing',['अर्थिंग','ارتھنگ']],
 ['grinder',['ग्राइंडर','ग्राइंडिंग मशीन','گرائنڈر']],
 ['drill machine',['ड्रिल मशीन','ڈرل مشین']],
 ['welding machine',['वेल्डिंग मशीन','ویلڈنگ مشین']],
 ['welder',['वेल्डर','ویلڈر']],
 ['helper',['हेल्पर','مددگار','ہیلپر']],
 ['labour',['मजदूर','मज़दूर','मजूर','लेबर','मजदूरी','مزدور','لیبر','mazdoor','majdoor']],
 ['fitter',['फिटर','فٹر']],
 ['rigger',['रिगर','ریگر']],
 ['supervisor',['सुपरवायझर','सुपरवाइजर','سپروائزر']],
 ['technician',['टेक्निशियन','तकनीशियन','ٹیکنیشن']],
 ['material',['मटेरियल','मटेरिअल','मटेरियल्स','सामान','साहित्य','माल','میٹریل','سامان','metrial','materiyal']],
 ['hardware',['हार्डवेयर','हार्डवेअर','ہارڈویئر']],
 ['fasteners',['फास्टनर','फास्टनर्स','فاسٹنر']],
 ['tools',['औजार','औज़ार','टूल्स','उपकरण','اوزار','ٹولز']],
 ['safety',['सेफ्टी','सुरक्षा','سیفٹی']],
 ['company',['कंपनी','कम्पनी','کمپنی']],
 ['profile',['प्रोफाइल','پروفائل']],
 ['services',['सेवाएं','सेवाएँ','सेवा','خدمات']],
 ['projects',['प्रोजेक्ट','प्रोजेक्ट्स','परियोजना','प्रकल्प','پروجیکٹ','منصوبے']],
 ['active',['चालू','सुरू','सक्रिय','جاری']],
 ['completed',['पूर्ण','पूरे हुए','مکمل']],
 ['how many',['कितने','किती','کتنے']],
 ['list',['कौन कौन','कौन-कौन','कौनसे','कौन से','कोणते','काय काय','کون کون','کون سے','فہرست']],
 ['all',['सभी','सारे','सब','सगळे','تمام','سب']],
 ['price',['कीमत','क़ीमत','भाव','रेट','दर','قیمت','ریٹ','کیمت','kimat','keemat']],
 ['discount',['छूट','डिस्काउंट','सवलत','رعایت','ڈسکاؤنٹ']],
 ['quantity',['मात्रा','संख्या','क्वांटिटी','प्रमाण','تعداد','مقدار']],
 ['size',['साइज','साईज','आकार','سائز']],
 ['brand',['ब्रांड','ब्रँड','मेक','برانڈ','میک']],
 ['polycab',['पॉलीकैब','पॉलीकॅब','पोलीकैब','پولی کیب']],['ashirvad',['आशीर्वाद','आशिर्वाद','آشیرواد']],['havells',['हैवेल्स','हॅवेल्स','ہیولز']],['finolex',['फिनोलेक्स','فنولیکس']],
 ['repair',['दुरुस्ती','मरम्मत','मरम्मत का','تعمیر و مرمت','مرمت']],
 ['installation',['इंस्टॉलेशन','इन्स्टॉलेशन','लगाना','फिट करायचे','تنصیب','لگانا']],
 ['wiring',['वायरिंग','وائرنگ']],
 ['leak',['लीक','गळती','रिसाव','لیک']],
 ['work',['काम','कार्य','کام','kaam']],
 ['location',['लोकेशन','ठिकाण','जगह','مقام','لوکیشن']],
 ['mumbra',['मुंब्रा','मुम्ब्रा','ممبرا']],['mumbai',['मुंबई','मुम्बई','ممبئی']],['thane',['ठाणे','थाने','تھانے']],
 ['today',['आज','آج','aaj']],['tomorrow',['कल','उद्या','کل','kal']],
 ['mm',['मिमी','एमएम','मिलीमीटर','ملی میٹر']],['sqmm',['स्क्वेअर मिमी','वर्ग मिमी','اسکوائر ملی میٹر']],
 ['pcs',['पीस','नग','عدد']],['metres',['मीटर','मीटर्स','میٹر']],['rolls',['रोल','رول']],['kg',['किलो','किलोग्राम','کلو']],
 ['1',['एक','ایک']],['2',['दो','दोन','دو']],['3',['तीन','تین']],['4',['चार','چار']],['5',['पांच','पाँच','पाच','پانچ']],['10',['दस','दहा','دس']],['100',['सौ','शंभर','سو']],
 ['civil',['सिविल','सिव्हिल','سول']],
 ['buying rate',['खरीद रेट','खरेदी दर','خریداری ریٹ']],['salary',['वेतन','सैलरी','पगार','تنخواہ']],['bank details',['बैंक विवरण','बँक माहिती','بینک تفصیلات']],
 ['employee',['कर्मचारी','ملازم']],
 ['call',['कॉल','फोन','رابطہ','کال']],['email',['ईमेल','मेल','ای میل']],
 ['hi',['नमस्ते','नमस्कार','हेलो','हॅलो','سلام','السلام علیکم','salam','salaam']]
].flatMap(([to,words])=>words.map(from=>({from,to}))).sort((a,b)=>b.from.length-a.from.length);
const esc=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
function normalise(text){
 let q=String(text).normalize('NFC').replace(/[०-९۰-۹٠-٩]/g,c=>String(c.charCodeAt(0)-(c>='०'&&c<='९'?0x966:c>='۰'&&c<='۹'?0x6f0:0x660)));
 for(const {from,to}of aliases)q=q.replace(new RegExp('(?<![\\p{L}\\p{M}])'+esc(from)+'(?![\\p{L}\\p{M}])','giu'),to);
 return q.replace(/[؟।]/g,'?').replace(/\s+/g,' ').trim().slice(0,1300);
}
function history(messages){return messages.map(m=>({...m,content:m.role==='user'?normalise(m.content):/^(?:हाँ|होय|جی ہاں|Haan),? HM ELECTRICAL/.test(m.content)?'Yes, HM ELECTRICAL provides skilled manpower.':m.content}));}
const t={
 hi:{hello:'नमस्ते! आपको कौन सा मटेरियल या किस काम के लिए कारीगर चाहिए?',listed:'हाँ, यह मटेरियल हमारे HM ELECTRICAL कैटलॉग में दर्ज है।',make:'ब्रांड / मेक',size:'साइज',unit:'यूनिट',code:'प्रोडक्ट कोड',mrp:'MRP',price:'हमारा रेट',discount:'MRP पर छूट',gst:'GST दर',reference:'MRP संदर्भ के लिए है। फाइनल रेट और स्टॉक हमारी टीम कन्फर्म करेगी।',missingPrice:'मौजूदा रेट पूछताछ पर मिलेगा।',both:'कौन सा साइज और कितनी मात्रा चाहिए?',sizeAsk:'कौन सा साइज / स्पेसिफिकेशन चाहिए?',qtyAsk:'फाइनल कोटेशन के लिए कितनी मात्रा चाहिए?',noted:'साइज और मात्रा नोट कर ली है।',contact:'कृपया कॉल या ईमेल करें: ',approval:'फाइनल रेट, उपलब्धता और बुकिंग हमारी टीम कन्फर्म करेगी।',manpower:'हाँ, HM ELECTRICAL कुशल कारीगर और मैनपावर की पूछताछ लेता है।',share:'कृपया ये जानकारी दें: ',fields:['काम का विवरण','लोकेशन','कारीगरों की संख्या','शुरू करने की तारीख'],serviceNoted:'आपके काम और मैनपावर की जरूरत नोट कर ली है। नीचे पूछताछ फॉर्म से भेजें।',notFound:'यह आइटम अभी हमारे कैटलॉग में दर्ज नहीं है। हमारी टीम सप्लायर से उपलब्धता और रेट पता कर सकती है।',stock:'यह मटेरियल अभी स्टॉक में नहीं है। हमारी टीम इसे सप्लायर से मंगाने की संभावना देख सकती है।',discontinued:'यह मटेरियल बंद किए गए मॉडल के रूप में दर्ज है। हमारी टीम विकल्प या सप्लायर से व्यवस्था देख सकती है।',unavailable:'कैटलॉग अभी उपलब्ध नहीं हो पा रहा है। हमारी टीम से मटेरियल और रेट की जानकारी लें।',private:'सप्लायर के निजी रेट, खरीद लागत, बैंक विवरण, पासवर्ड और कर्मचारियों के निजी रिकॉर्ड इस सार्वजनिक चैट में नहीं दिए जाते।',civil:'हम सिविल काम या सिविल लेबर नहीं देते। Electrical, Fire Fighting, Plumbing/PHE, HVAC, fabrication और मटेरियल की जरूरत बताएं।',list:'कैटलॉग में दर्ज मटेरियल',listAsk:'आइटम, साइज और मात्रा बताएं। बिना रेट वाले मटेरियल का भी कोटेशन मांगा जा सकता है।',profile:'HM ELECTRICAL मुंबई, मुंब्रा और ठाणे में B2B मटेरियल सप्लाई, प्रोजेक्ट और तकनीशियन सेवाओं की पूछताछ लेता है।',services:'हम Electrical, Fire Fighting, Plumbing/PHE, HVAC/mechanical, fabrication, मटेरियल सप्लाई और कुशल मैनपावर से जुड़े काम करते हैं।',team:'हमारी सार्वजनिक टीम और कंपनी की जानकारी यहां देखें: ',portfolio:'स्वीकृत सार्वजनिक प्रोजेक्ट रिकॉर्ड',dated:'यह तारीख वाला सार्वजनिक रिकॉर्ड है, लाइव साइट अपडेट नहीं। आज की स्थिति ऑफिस से कन्फर्म करें।',records:'रिकॉर्ड',running:'चालू',completed:'पूर्ण'},
 mr:{hello:'नमस्कार! कोणते मटेरियल किंवा कोणत्या कामासाठी कारागीर पाहिजे?',listed:'होय, हे मटेरियल आमच्या HM ELECTRICAL कॅटलॉगमध्ये नोंदवले आहे.',make:'ब्रँड / मेक',size:'साइज',unit:'युनिट',code:'प्रॉडक्ट कोड',mrp:'MRP',price:'आमचा दर',discount:'MRP वरील सवलत',gst:'GST दर',reference:'MRP संदर्भासाठी आहे. अंतिम दर आणि स्टॉक आमची टीम निश्चित करेल.',missingPrice:'सध्याचा दर चौकशीवर मिळेल.',both:'कोणता साइज आणि किती प्रमाण पाहिजे?',sizeAsk:'कोणता साइज / स्पेसिफिकेशन पाहिजे?',qtyAsk:'अंतिम कोटेशनसाठी आवश्यक प्रमाण सांगा.',noted:'साइज आणि प्रमाण नोंदवले आहे.',contact:'कृपया कॉल किंवा ईमेल करा: ',approval:'अंतिम दर, उपलब्धता आणि बुकिंग आमची टीम निश्चित करेल.',manpower:'होय, HM ELECTRICAL कुशल कारागीर आणि मनुष्यबळाची चौकशी स्वीकारते.',share:'कृपया ही माहिती द्या: ',fields:['कामाचा तपशील','ठिकाण','कारागिरांची संख्या','सुरुवातीची तारीख'],serviceNoted:'तुमच्या कामाची आणि मनुष्यबळाची गरज नोंदवली आहे. खालील चौकशी फॉर्ममधून पाठवा.',notFound:'हा आयटम सध्या कॅटलॉगमध्ये नोंदवलेला नाही. आमची टीम पुरवठादाराकडून उपलब्धता आणि दर तपासू शकते.',stock:'हे मटेरियल सध्या स्टॉकमध्ये नाही. आमची टीम पुरवठादाराकडून व्यवस्था होऊ शकते का ते तपासेल.',discontinued:'हा आयटम बंद मॉडेल म्हणून नोंदवला आहे. आमची टीम पर्याय किंवा पुरवठादाराकडून व्यवस्था तपासू शकते.',unavailable:'कॅटलॉग सध्या उपलब्ध होत नाही. मटेरियल आणि दरासाठी आमच्या टीमशी संपर्क करा.',private:'पुरवठादारांचे गोपनीय दर, खरेदी खर्च, बँक तपशील, पासवर्ड आणि कर्मचाऱ्यांच्या खासगी नोंदी सार्वजनिक चॅटमध्ये दिल्या जात नाहीत.',civil:'आम्ही सिव्हिल काम किंवा सिव्हिल कामगार सेवा देत नाही. Electrical, Fire Fighting, Plumbing/PHE, HVAC, fabrication किंवा मटेरियलची गरज सांगा.',list:'कॅटलॉगमध्ये नोंदवलेले मटेरियल',listAsk:'आयटम, साइज आणि प्रमाण सांगा. दर नसलेल्या मटेरियलचेही कोटेशन मागू शकता.',profile:'HM ELECTRICAL मुंबई, मुंब्रा आणि ठाणे येथे B2B मटेरियल पुरवठा, प्रोजेक्ट आणि तंत्रज्ञ सेवांची चौकशी स्वीकारते.',services:'आम्ही Electrical, Fire Fighting, Plumbing/PHE, HVAC/mechanical, fabrication, मटेरियल पुरवठा आणि कुशल मनुष्यबळाशी संबंधित कामे करतो.',team:'आमची सार्वजनिक टीम आणि कंपनीची माहिती येथे पहा: ',portfolio:'मान्य सार्वजनिक प्रोजेक्ट नोंदी',dated:'हा दिनांकित सार्वजनिक रजिस्टर आहे; थेट साइट अपडेट नाही. आजची स्थिती ऑफिसकडून निश्चित करा.',records:'नोंदी',running:'चालू',completed:'पूर्ण'},
 ur:{hello:'السلام علیکم! آپ کو کون سا میٹریل یا کس کام کے لیے کاریگر چاہیے؟',listed:'جی ہاں، یہ میٹریل ہمارے HM ELECTRICAL کیٹلاگ میں درج ہے۔',make:'برانڈ / میک',size:'سائز',unit:'یونٹ',code:'پروڈکٹ کوڈ',mrp:'MRP',price:'ہمارا ریٹ',discount:'MRP پر رعایت',gst:'GST شرح',reference:'MRP صرف حوالہ ہے۔ حتمی ریٹ اور اسٹاک ہماری ٹیم تصدیق کرے گی۔',missingPrice:'موجودہ ریٹ درخواست پر ملے گا۔',both:'کون سا سائز اور کتنی مقدار چاہیے؟',sizeAsk:'کون سا سائز / تفصیل چاہیے؟',qtyAsk:'حتمی کوٹیشن کے لیے مطلوبہ مقدار بتائیں۔',noted:'سائز اور مقدار نوٹ کر لی ہے۔',contact:'براہ کرم کال یا ای میل کریں: ',approval:'حتمی ریٹ، دستیابی اور بکنگ ہماری ٹیم کی تصدیق سے ہوگی۔',manpower:'جی ہاں، HM ELECTRICAL ہنر مند کاریگروں اور افرادی قوت کی انکوائری لیتا ہے۔',share:'براہ کرم یہ معلومات دیں: ',fields:['کام کی تفصیل','مقام','کاریگروں کی تعداد','کام شروع کرنے کی تاریخ'],serviceNoted:'آپ کے کام اور افرادی قوت کی ضرورت نوٹ کر لی ہے۔ نیچے انکوائری فارم سے بھیجیں۔',notFound:'یہ آئٹم فی الحال ہمارے کیٹلاگ میں درج نہیں۔ ہماری ٹیم سپلائر سے دستیابی اور ریٹ معلوم کر سکتی ہے۔',stock:'یہ میٹریل فی الحال اسٹاک میں نہیں ہے۔ ہماری ٹیم سپلائر سے بندوبست کی گنجائش دیکھ سکتی ہے۔',discontinued:'یہ آئٹم بند ماڈل کے طور پر درج ہے۔ ہماری ٹیم متبادل یا سپلائر سے بندوبست دیکھ سکتی ہے۔',unavailable:'کیٹلاگ فی الحال دستیاب نہیں ہو رہا۔ میٹریل اور ریٹ کے لیے ہماری ٹیم سے رابطہ کریں۔',private:'سپلائر کے خفیہ ریٹ، خریداری لاگت، بینک تفصیلات، پاس ورڈ اور ملازمین کے ذاتی ریکارڈ عوامی چیٹ میں نہیں دیے جاتے۔',civil:'ہم سول کام یا سول لیبر فراہم نہیں کرتے۔ Electrical، Fire Fighting، Plumbing/PHE، HVAC، fabrication یا میٹریل کی ضرورت بتائیں۔',list:'کیٹلاگ میں درج میٹریل',listAsk:'آئٹم، سائز اور مقدار بتائیں۔ جن اشیا کا ریٹ درج نہیں ان کا بھی کوٹیشن مانگ سکتے ہیں۔',profile:'HM ELECTRICAL ممبئی، ممبرا اور تھانے میں B2B میٹریل سپلائی، پروجیکٹ اور ٹیکنیشن خدمات کی انکوائری لیتا ہے۔',services:'ہم Electrical، Fire Fighting، Plumbing/PHE، HVAC/mechanical، fabrication، میٹریل سپلائی اور ہنر مند افرادی قوت سے متعلق کام کرتے ہیں۔',team:'ہماری عوامی ٹیم اور کمپنی کی معلومات یہاں دیکھیں: ',portfolio:'منظور شدہ عوامی پروجیکٹ ریکارڈ',dated:'یہ تاریخ والا عوامی رجسٹر ہے، لائیو سائٹ اپڈیٹ نہیں۔ آج کی حالت دفتر سے تصدیق کریں۔',records:'ریکارڈ',running:'جاری',completed:'مکمل'},
 roman:{hello:'Hi! Aapko kaunsa material ya kis kaam ke liye technician chahiye?',listed:'Haan, ye material HM ELECTRICAL ke catalogue mein listed hai.',make:'Brand / Make',size:'Size',unit:'Unit',code:'Product code',mrp:'MRP',price:'Hamara rate',discount:'MRP par discount',gst:'GST rate',reference:'MRP reference ke liye hai. Final rate aur stock hamari team confirm karegi.',missingPrice:'Abhi ka rate poochhne par milega.',both:'Kaunsa size aur kitni quantity chahiye?',sizeAsk:'Kaunsa size / specification chahiye?',qtyAsk:'Final quotation ke liye required quantity batayein.',noted:'Size aur quantity note kar li hai.',contact:'Call ya email karein: ',approval:'Final rate, availability aur booking hamari team confirm karegi.',manpower:'Haan, HM ELECTRICAL skilled manpower ki enquiry leta hai.',share:'Ye details batayein: ',fields:['kaam ki details','location','kitne workers chahiye','kaam shuru karne ki date'],serviceNoted:'Aapka kaam aur manpower requirement note kar liya hai. Neeche enquiry form se bhejein.',notFound:'Ye item abhi hamare catalogue mein listed nahi hai. Hamari team supplier se availability aur rate check kar sakti hai.',stock:'Ye material abhi stock mein nahi hai. Hamari team supplier se arrange karne ki possibility check karegi.',discontinued:'Ye item discontinued model ke taur par listed hai. Hamari team alternative ya supplier se sourcing check kar sakti hai.',unavailable:'Catalogue abhi load nahi ho raha. Material aur rate ke liye hamari team se baat karein.',private:'Supplier ke private rates, buying costs, bank details, passwords aur employees ke personal records public chat mein share nahi hote.',civil:'Hum Civil work ya Civil labour offer nahi karte. Electrical, Fire Fighting, Plumbing/PHE, HVAC, fabrication ya material ki enquiry batayein.',list:'Catalogue mein listed material',listAsk:'Item, size aur quantity batayein. Jinka rate nahi hai, unka bhi quotation maang sakte hain.',profile:'HM ELECTRICAL Mumbai, Mumbra aur Thane mein B2B material supply, project aur technician services ki enquiries leta hai.',services:'Hum Electrical, Fire Fighting, Plumbing/PHE, HVAC/mechanical, fabrication, material supply aur skilled manpower se related kaam karte hain.',team:'Hamari public team aur company ki details yahan dekhein: ',portfolio:'Approved public project records',dated:'Ye dated public register hai, live site update nahi. Aaj ka status office se confirm karein.',records:'records',running:'running',completed:'completed'}
};
function question(messages,pack,result){const text=result?.reply||'';if(text.includes('What size and quantity'))return pack.both;if(text.includes('What size/specification'))return pack.sizeAsk;if(text.includes('Please share your required quantity'))return pack.qtyAsk;if(text.includes('Size and quantity noted'))return pack.noted;const q=require('./simple-customer-chat.cjs').specifications(messages);return !q.size&&!q.qty?pack.both:!q.size?pack.sizeAsk:!q.qty?pack.qtyAsk:pack.noted;}
function localise(result,language,messages){
 if(language==='en')return {...result,language};const p=t[language],contact=p.contact+CONTACT,finish=p.approval;
 let reply;
 if(result.products?.length){
  const products=result.products.slice(0,2);
  if(result.step==='sourcing')reply=(products.every(x=>x.availability==='discontinued')?p.discontinued:p.stock)+' '+question(messages,p,result)+' '+contact;
  else{
   const priced=products.some(x=>x.mrp!=null||x.sellingPrice!=null);
   reply=p.listed+'\n'+products.map(x=>[x.name,x.size?p.size+': '+x.size:null,[x.brand?p.make+': '+x.brand:null,x.unit?p.unit+': '+x.unit:null,x.sku||x.id?p.code+': '+(x.sku||x.id):null].filter(Boolean).join(' | '),x.mrp!=null?p.mrp+': ₹'+Number(x.mrp).toFixed(2)+(x.unit?'/'+x.unit:''):null,x.sellingPrice!=null?p.price+': ₹'+Number(x.sellingPrice).toFixed(2)+(x.unit?'/'+x.unit:'')+(x.minimumQuantity?' (min. '+x.minimumQuantity+' '+x.unit+')':''):null,x.discountPercent!=null?p.discount+': '+x.discountPercent+'%':null,x.gstRate!=null?p.gst+': '+x.gstRate+'%; '+finish:null].filter(Boolean).join('\n')).join('\n\n')+'\n'+(priced?p.reference:p.missingPrice)+' '+question(messages,p,result);
  }
 }else if(result.step==='category-list')reply=result.categoryLists.map(x=>x.category+' — '+p.list+':\n'+x.names.map((n,i)=>(i+1)+'. '+n).join('\n')).join('\n\n')+'\n\n'+p.listAsk+' '+finish;
 else if(result.step==='work'){
  const fields=['work type','location','required manpower','starting date'];const missing=fields.flatMap((f,i)=>result.reply.includes(f)?[p.fields[i]]:[]);
  reply=p.manpower+' '+p.share+(missing.length?missing:p.fields).join(', ')+'. '+finish;
 }else if(result.step==='private')reply=p.private+' '+contact;
 else if(result.step==='outside')reply=p.civil+' '+contact;
 else if(result.step==='not-found')reply=p.notFound+' '+contact;
 else if(result.step==='unavailable')reply=p.unavailable+' '+contact;
 else if(result.step==='scope')reply=p.hello;
 else if(result.step==='company'){
  const url=(result.reply.match(/https:\/\/hmelectricalb2b\.com\/[^ ]+/)||[])[0]||'https://hmelectricalb2b.com/company-profile.html';
  if(url.includes('projects')){
   const count=result.reply.match(/lists (\d+) (running|completed|project) records/),split=result.reply.match(/\((\d+) running, (\d+) completed\)/),date=result.reply.match(/dated ([^ ;.]+)/);
   const summary=count?count[1]+' '+(p[count[2]]||'project')+' '+p.records+(split?' ('+split[1]+' '+p.running+', '+split[2]+' '+p.completed+')':'')+(date?' ['+date[1]+']':''):result.reply.replace(/^.*?(?:portfolio: |records: )/,'').split('. Register')[0].replace(/\(Running\)/g,'('+p.running+')').replace(/\(Completed\)/g,'('+p.completed+')');
   reply=p.portfolio+': '+summary+'. '+p.dated+' '+url;
  }else if(url.includes('team'))reply=p.team+url+' '+contact;
  else if(/handles/.test(result.reply))reply=p.services+' '+contact;
  else reply=p.profile+' '+contact+' '+url;
 }else if(result.step==='handoff')reply=(/work and manpower/.test(result.reply)?p.serviceNoted+' ':'')+contact+' '+finish;
 else reply=p.hello+' '+contact;
 return {...result,reply:reply.slice(0,3900),language};
}
module.exports={LANGUAGES,detect,normalise,history,localise};
