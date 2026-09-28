import test from 'node:test';
import assert from 'node:assert/strict';
import {countText, dateText, safeURL, mergeVideos, sameConnection} from '../videos/video-model.mjs';

test('missing metrics remain distinct from real zero',()=>{
  assert.equal(countText(0),'0'); assert.equal(countText(1234),'1,234');
  for(const value of [undefined,null,true,-1,'12',NaN,Infinity,Number.MAX_SAFE_INTEGER+1]) assert.equal(countText(value),'—');
});
test('large video IDs remain strings and pagination deduplicates',()=>{
  const id='7688585767102500117';
  const result=mergeVideos([{id,view_count:1}],[{id,view_count:2},{id:'7688585767102500118'}]);
  assert.equal(result.length,2); assert.equal(result[0].id,id); assert.equal(result[0].view_count,2);
  for(const value of [Number(id),'１２３','1'.repeat(31),null]) assert.throws(()=>mergeVideos([],[{id:value}]));
});
test('links reject executable, credential-bearing and deceptive destinations',()=>{
  for(const url of ['javascript:alert(1)','http://tiktok.com/x','https://a:b@tiktok.com','https://tiktok.com.attacker.example/x','https://attacker.example']) assert.equal(safeURL(url,true),null);
  assert.equal(safeURL('https://www.tiktok.com/@example/video/1',true),'https://www.tiktok.com/@example/video/1');
});
test('account changes cannot mix profiles and result pages',()=>{
  assert.equal(sameConnection('account-a','account-a'),true);
  for(const pair of [['account-a','account-b'],[null,null],['','']]) assert.equal(sameConnection(...pair),false);
});
test('missing or overflowing dates are identified',()=>{
  for(const value of [null,'123',-1,Number.MAX_SAFE_INTEGER]) assert.equal(dateText(value),'Date unavailable');
  assert.notEqual(dateText(1789000000),'Date unavailable');
});
