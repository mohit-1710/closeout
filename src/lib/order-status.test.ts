import {describe,it,expect} from 'vitest';
import {reconcileOrder,type VenueTrade,type VenueOrder} from './order-status';
import type {TrackedOrder} from './types';
const account='0x'+'a'.repeat(40),otherAccount='0x'+'b'.repeat(40),hash='0x'+'c'.repeat(64);
const prior:TrackedOrder={id:'o1',market:'Test',outcome:'Yes',tokenId:'1',requestedShares:'100',matchedShares:'0',settledShares:null,price:'0.5',netReceipt:null,status:'unknown',mode:'live',createdAt:0,transactionHashes:[],detail:'',canCancel:false,orderType:'FAK',accountAddress:account};
const order:VenueOrder={id:'o1',assetId:'1',tokenId:'1',makerAddress:account,side:'SELL',orderType:'FAK',sizeMatched:'60',originalSize:'100',status:'MATCHED',associateTrades:['t1']};
const trade:VenueTrade={id:'t1',takerOrderId:'o1',assetId:'1',tokenId:'1',makerAddress:account,side:'SELL',traderSide:'TAKER',size:'60',status:'TRADE_STATUS_MATCHED',transactionHash:hash,makerOrders:[]};
const confirmed:VenueTrade={...trade,status:'CONFIRMED'};
describe('order reconciliation',()=>{
 it('never equates matched or mined with settled',()=>{for(const status of ['MATCHED','MINED','RETRYING']){const r=reconcileOrder(prior,order,[{...trade,status}]);expect(r.status).toBe('settling');expect(r.settledShares).toBe('0');expect(r.transactionHashes).toEqual([])}});
 it('reports a confirmed partial fill with unsold remainder',()=>{const r=reconcileOrder(prior,order,[{...trade,status:'TRADE_STATUS_CONFIRMED'}]);expect(r.status).toBe('partial');expect(r.settledShares).toBe('60');expect(r.netReceipt).toBeNull();expect(r.canCancel).toBe(false)});
 it('deduplicates repeated fill records',()=>{const t={...trade,status:'CONFIRMED'};expect(reconcileOrder(prior,order,[t,t]).settledShares).toBe('60')});
 it('does not claim completion when a referenced trade is missing',()=>expect(reconcileOrder(prior,{...order,associateTrades:['t1','t2']},[{...trade,status:'CONFIRMED'}]).status).toBe('matched'));
 it('ignores unreferenced other orders trades',()=>expect(reconcileOrder(prior,order,[{...trade,id:'other-trade',takerOrderId:'other',status:'CONFIRMED'}]).settledShares).toBe('0'));
 it('cancellation does not erase a settling fill',()=>expect(reconcileOrder(prior,{...order,status:'CANCELLED'},[trade]).status).toBe('settling'));
 it('recognizes a zero-fill cancellation',()=>expect(reconcileOrder(prior,{...order,status:'CANCELED',sizeMatched:'0',associateTrades:[]},[]).status).toBe('cancelled'));
 it('shows failed settlement without fabricating proceeds',()=>{const r=reconcileOrder(prior,order,[{...trade,status:'FAILED'}]);expect(r.status).toBe('failed');expect(r.netReceipt).toBeNull()});
 it('rejects a mismatched order identity',()=>expect(()=>reconcileOrder(prior,{...order,id:'wrong'},[])).toThrow());
 it.each(['LIVE','OPEN','UNMATCHED'])('keeps a %s partial remainder active and cancellable',status=>{
  const r=reconcileOrder(prior,{...order,status},[confirmed]);expect(r.status).toBe('open');expect(r.canCancel).toBe(true);expect(r.settledShares).toBe('60');expect(r.detail).toContain('live remainder');
 });
 it('does not offer cancellation during pending settlement',()=>{
  const r=reconcileOrder(prior,{...order,status:'LIVE'},[trade]);expect(r.status).toBe('settling');expect(r.canCancel).toBe(false);
 });
 it('does not call an unknown partial remainder terminal',()=>{
  expect(reconcileOrder(prior,{...order,status:'NEW_UNRECOGNIZED_STATE'},[confirmed]).status).toBe('matched');
 });
 it('reports all shares confirmed only with matching quantities and references',()=>{
  const r=reconcileOrder(prior,{...order,sizeMatched:'100'},[{...confirmed,size:'100'}]);expect(r.status).toBe('settled');expect(r.settledShares).toBe('100');expect(r.canCancel).toBe(false);expect(r.transactionHashes).toEqual([hash]);
 });
 it('supports a bound FOK order without changing the local type',()=>{
  const r=reconcileOrder({...prior,orderType:'FOK'},{...order,orderType:'FOK',sizeMatched:'100'},[{...confirmed,size:'100'}]);expect(r.status).toBe('settled');expect(r.orderType).toBe('FOK');
 });
 it('deduplicates repeated references',()=>expect(reconcileOrder(prior,{...order,associateTrades:['t1','t1']},[confirmed]).settledShares).toBe('60'));
 it.each([{status:'FAILED'},{size:'59'},{transactionHash:'0x'+'d'.repeat(64)}])('rejects conflicting versions of a fill (%j)',change=>{
  expect(()=>reconcileOrder(prior,order,[confirmed,{...confirmed,...change}])).toThrow('conflicting');
 });
 it('does not call missing referenced failures final',()=>{
  const r=reconcileOrder(prior,{...order,sizeMatched:'20',associateTrades:['A','B']},[{...trade,id:'A',size:'20',status:'FAILED'}]);
  expect(r.status).toBe('matched');expect(r.netReceipt).toBeNull();
 });
 it('does not settle against an unknown referenced trade status',()=>{
  const r=reconcileOrder(prior,{...order,associateTrades:['t1','t2']},[confirmed,{...trade,id:'t2',size:'10',status:'NEW_STATE'}]);expect(r.status).toBe('matched');
 });
 it('rejects a referenced trade belonging to another order',()=>{
  expect(()=>reconcileOrder(prior,order,[{...confirmed,takerOrderId:'other'}])).toThrow('referenced trade');
 });
 it('does not mark a zero-match cancellation final when a trade reference is unexplained',()=>{
  expect(reconcileOrder(prior,{...order,status:'CANCELED',sizeMatched:'0',associateTrades:['missing']},[]).status).toBe('unknown');
 });
 it.each([
  ['asset',{assetId:'2'}],['token alias',{tokenId:'2'}],['maker',{makerAddress:otherAccount}],['side',{side:'BUY'}],
  ['type',{orderType:'FOK'}],['resting type',{orderType:'GTC'}],['original size',{originalSize:'99'}],['matched overflow',{sizeMatched:'101'}],
 ] as const)('rejects a remote %s mismatch',(_label,change)=>expect(()=>reconcileOrder(prior,{...order,...change},[])).toThrow());
 it.each(['-1','NaN','Infinity','1e2','0.0000000000000000001','1000000000000000000'])('rejects malformed/out-of-bounds remote quantities: %s',sizeMatched=>{
  expect(()=>reconcileOrder(prior,{...order,sizeMatched},[])).toThrow();
 });
 it('rejects missing or unbound saved account/type and zero requested size',()=>{
  for(const change of [{accountAddress:undefined},{accountAddress:'bad'},{orderType:undefined},{requestedShares:'0'}])expect(()=>reconcileOrder({...prior,...change},order,[])).toThrow();
 });
 it('accepts case-normalized addresses and equivalent decimal/hex asset IDs',()=>{
  const equivalent={...order,assetId:'0x'+'0'.repeat(63)+'1',makerAddress:'0x'+'A'.repeat(40),originalSize:'100.00'};
  expect(reconcileOrder(prior,equivalent,[confirmed]).status).toBe('partial');
 });
 it.each([{assetId:'2'},{tokenId:'2'},{makerAddress:otherAccount},{side:'BUY'},{traderSide:'MAKER' as const}])('rejects wrong taker-fill identity (%j)',change=>{
  expect(()=>reconcileOrder(prior,order,[{...confirmed,...change}])).toThrow();
 });
 it('validates its exact maker leg without assuming the counterparty token or side',()=>{
  const maker:VenueTrade={...confirmed,takerOrderId:'other',assetId:'2',tokenId:'2',makerAddress:otherAccount,side:'BUY',traderSide:'MAKER',size:'80',makerOrders:[{orderId:'o1',assetId:'1',tokenId:'1',makerAddress:account,side:'SELL',matchedAmount:'60'}]};
  expect(reconcileOrder(prior,order,[maker]).settledShares).toBe('60');
  for(const change of [{assetId:'2'},{tokenId:'2'},{makerAddress:otherAccount},{side:'BUY'}])expect(()=>reconcileOrder(prior,order,[{...maker,makerOrders:[{...maker.makerOrders[0],...change}]}])).toThrow();
 });
 it('rejects repeated or ambiguous own maker legs',()=>{
  const leg={orderId:'o1',assetId:'1',makerAddress:account,side:'SELL',matchedAmount:'30'};
  expect(()=>reconcileOrder(prior,order,[{...confirmed,makerOrders:[leg]}])).toThrow('ambiguous');
  expect(()=>reconcileOrder(prior,order,[{...confirmed,takerOrderId:'other',traderSide:'MAKER',makerOrders:[leg,leg]}])).toThrow('ambiguous');
 });
 it('rejects confirmed share totals above the reported matched amount',()=>{
  expect(()=>reconcileOrder(prior,order,[{...confirmed,size:'61'}])).toThrow('Confirmed fills exceed');
  expect(()=>reconcileOrder(prior,{...order,associateTrades:['t1','t2']},[{...confirmed,size:'40'},{...confirmed,id:'t2',size:'40'}])).toThrow('Confirmed fills exceed');
 });
 it('sums accepted small decimal fills exactly',()=>{
  const r=reconcileOrder({...prior,requestedShares:'1'},{...order,originalSize:'1',sizeMatched:'0.3',associateTrades:['t1','t2']},[{...confirmed,size:'0.1'},{...confirmed,id:'t2',size:'0.2'}]);expect(r.settledShares).toBe('0.3');
 });
 it('rejects a confirmed record without a valid settlement hash',()=>{
  expect(()=>reconcileOrder(prior,order,[{...confirmed,transactionHash:''}])).toThrow('transaction hash');
 });
 it('does not erase previously confirmed quantities when a later result is incomplete',()=>{
  expect(()=>reconcileOrder({...prior,settledShares:'60'},order,[])).toThrow('history is incomplete');
 });
 it('does not mutate prior records or source trades',()=>{
  const old=JSON.stringify({prior,order,confirmed});reconcileOrder(prior,order,[confirmed]);expect(JSON.stringify({prior,order,confirmed})).toBe(old);
 });
});
