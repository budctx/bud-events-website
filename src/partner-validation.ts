export function normalizePartnerUrl(value:string):string {
 const trimmed=value.trim();
 const markdown=trimmed.match(/^\[[^\]\n]*\]\((https:\/\/[^\s)]+)\)$/i);
 return markdown?markdown[1]:trimmed;
}
export function partnerUrlError(value:string,logo:boolean):string {
 if(!value)return logo?'أدخل رابط صورة الشعار.':'';
 if(value.length>500)return 'الرابط أطول من المسموح (500 حرف).';
 let url:URL;try{url=new URL(value);}catch{return 'أدخل رابطًا كاملًا يبدأ بـ https://.';}
 if(url.protocol!=='https:'||!url.hostname)return 'يجب أن يبدأ الرابط بـ https://.';
 if(url.username||url.password||url.hash)return 'استخدم رابطًا دون بيانات دخول أو جزء يبدأ بـ #.';
 if(logo&&!/\.(png|jpe?g|webp)$/i.test(url.pathname))return 'استخدم رابط الصورة المباشر بصيغة PNG أو JPG أو JPEG أو WebP، وليس رابط صفحة أو SVG.';
 return '';
}
