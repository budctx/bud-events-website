import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizePartnerUrl,partnerUrlError} from '../src/partner-validation.ts';
const image='https://www.image2url.com/r2/default/images/1793361580646-eea85d21-ee87-4f1e-8fac-dca697d07307.png';
test('direct PNG and copied Markdown image links normalize to the same accepted URL',()=>{
 assert.equal(normalizePartnerUrl('  '+image+'  '),image);
 assert.equal(normalizePartnerUrl(`[${image}](${image})`),image);
 assert.equal(partnerUrlError(image,true),'');
 assert.equal(partnerUrlError('https://cdn.example.com/logo.webp?width=500',true),'');
});
test('partner fields explain insecure URLs and unsupported image formats',()=>{
 for(const url of ['http://example.com/a.png','javascript:alert(1)','https://user:pass@example.com/a.png','https://example.com/a.svg','https://example.com/page','https://example.com/a.png#x'])assert.ok(partnerUrlError(url,true));
 assert.equal(partnerUrlError('',true),'أدخل رابط صورة الشعار.');
 assert.equal(partnerUrlError('',false),'');
});
