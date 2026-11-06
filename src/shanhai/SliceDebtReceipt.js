/** Read existing settlement results; never change balances or replay a command. */
export function debtReceipt(session){
 const focus=session.focus,result=focus?.result;
 if(!['DEBT_PAID','PLAYER_BANKRUPT'].includes(result?.type))return null;
 const events=result.events||[],rent=result.rentResult||events.find(e=>e.type==='DEBT_REQUIRED');
 if(!Number.isFinite(rent?.amountDue))return null; // Older incomplete receipts cannot be reconstructed safely.
 const paid=result.type==='PLAYER_BANKRUPT'?result.amountPaid:result.amount;
 if(!Number.isFinite(paid))return null;
 const total=kind=>events.filter(e=>e.type==='ASSET_LIQUIDATED'&&e.kind===kind).reduce((sum,e)=>sum+(Number(e.value)||0),0);
 const player=session.currentPlayer;
 return {name:player.name,tileId:focus.tileId,creditor:session.state.players.find(p=>p.id===rent.ownerId)?.name||'债权方',
  due:rent.amountDue,paid,shortfall:Math.max(0,rent.amountDue-paid),bankrupt:result.type==='PLAYER_BANKRUPT',
  depositUsed:total('DEPOSIT'),stockSold:total('STOCK'),buildingSold:total('BUILDING'),mortgaged:total('PROPERTY'),
  cash:player.cash,deposit:player.deposit||0};
}
