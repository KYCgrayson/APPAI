import test from 'node:test';
import assert from 'node:assert/strict';
import { messages, locales, chooseLocale, matchLocale, translate } from '../src/i18n.js';
test('all nine locales have exactly the English keys, nonempty text and identical placeholders',()=>{
  assert.equal(locales.length,9);
  for(const locale of locales) {
    assert.deepEqual(Object.keys(messages[locale]).sort(),Object.keys(messages.en).sort());
    for(const [key,value] of Object.entries(messages[locale])) {
      const variants=typeof value==='string'?{text:value}:value;
      const english=typeof messages.en[key]==='string'?{text:messages.en[key]}:messages.en[key];
      assert.deepEqual(Object.keys(variants).sort(),Object.keys(english).sort(),`${locale}:${key} forms`);
      for(const [form,variant] of Object.entries(variants)) {
        assert.ok(typeof variant==='string'&&variant.trim(),`${locale}:${key}:${form}`);
        assert.doesNotMatch(variant,/[\p{L}\p{M}]\([\p{L}\p{M}]{1,3}\)/u,`${locale}:${key}:${form} has a bracketed plural`);
        assert.deepEqual((variant.match(/\{\w+\}/g)||[]).sort(),(english[form].match(/\{\w+\}/g)||[]).sort(),`${locale}:${key}:${form}`);
        // “Computer” is also the normal German word.
        if(locale!=='en' && !(locale==='de'&&key==='computer'))assert.notEqual(variant,english[form],`${locale}:${key}:${form} is untranslated`);
      }
    }
  }
  assert.match(messages.hi.rule1,/[\u0900-\u097f]/);
});
test('query wins, browser languages resolve, unsupported defaults to English',()=>{
  assert.equal(chooseLocale('ja',['es']), 'ja');assert.equal(chooseLocale(null,['xx','fr']), 'fr');
  assert.equal(chooseLocale(null,['ko-KR']), 'ko');assert.equal(chooseLocale('unknown',['de']), 'de');
  assert.equal(chooseLocale(null,['xx']), 'en');assert.equal(matchLocale('EN-us'),'en');
  assert.equal(chooseLocale(null,['zh-HK','en']),'zh-TW');assert.equal(chooseLocale(null,['es-MX','en']),'es');
});
test('Chinese scripts and regions map to the proper writing system',()=>{
  for(const l of ['zh-Hant','zh-HK','zh-MO','zh-Hant-HK','zh-TW'])assert.equal(chooseLocale(l,[]),'zh-TW');
  for(const l of ['zh','zh-Hans','zh-SG','zh-CN'])assert.equal(chooseLocale(l,[]),'zh-CN');
});
test('parameter interpolation works without an English fallback',()=>{
  assert.equal(translate('es','player',{n:3}),'Jugador 3');assert.throws(()=>translate('ja','missing-key'));
});
test('capture notices use natural singular and plural sentences in all nine locales',()=>{
  const expected={
    en:['Alex sent 1 token to the yard.','Alex sent 2 tokens to the yard.'],
    es:['Alex devolvió 1 ficha al patio.','Alex devolvió 2 fichas al patio.'],
    'zh-TW':['Alex將 1 顆棋子送回起點區。','Alex將 2 顆棋子送回起點區。'],
    'zh-CN':['Alex将 1 颗棋子送回起点区。','Alex将 2 颗棋子送回起点区。'],
    ja:['Alexが1個のコマを庭へ戻しました。','Alexが2個のコマを庭へ戻しました。'],
    ko:['Alex: 말 1개를 마당으로 돌려보냈어요.','Alex: 말 2개를 마당으로 돌려보냈어요.'],
    de:['Alex hat 1 Figur in den Hof geschickt.','Alex hat 2 Figuren in den Hof geschickt.'],
    fr:['Alex a renvoyé 1 pion dans la cour.','Alex a renvoyé 2 pions dans la cour.'],
    hi:['Alex ने 1 गोटी आँगन भेजी।','Alex ने 2 गोटियाँ आँगन भेजीं।'],
  };
  for(const locale of locales) {
    assert.deepEqual(Object.keys(messages[locale].captured).sort(),['one','other'],locale);
    for(const n of [1,2]) assert.equal(translate(locale,'captured',{player:'Alex',n}),expected[locale][n-1],`${locale}:${n}`);
  }
});
test('plural selection follows locale rules for zero and larger counts',()=>{
  assert.equal(translate('en','captured',{player:'Alex',n:0}),'Alex sent 0 tokens to the yard.');
  assert.equal(translate('fr','captured',{player:'Alex',n:0}),'Alex a renvoyé 0 pion dans la cour.');
  assert.equal(translate('hi','captured',{player:'Alex',n:0}),'Alex ने 0 गोटी आँगन भेजी।');
  assert.equal(translate('fr','captured',{player:'Alex',n:1000000}),'Alex a renvoyé 1000000 pions dans la cour.');
});
