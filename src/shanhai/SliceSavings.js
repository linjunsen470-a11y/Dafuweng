import {getBankTransferPreview,chooseAIBankTransfer} from '../game/BankRules.js';
export const SAVINGS_TILE=20;
export function savingsOptions(session){
 const {state}=session,p=session.currentPlayer;
 if(session.mapId!=='shanhai-highland'||!p)return [];
 const available=p.currentTile===SAVINGS_TILE&&state.phase==='LANDING_ACTION'&&session.landingResolved&&!state.pendingMove&&!p.isBankrupt;
 return [{id:'store',label:'存入 ¥1,000',direction:'DEPOSIT',amount:1000},{id:'take',label:'取出全部存款',direction:'WITHDRAW',amount:p.deposit||0}].map(choice=>{
  const quote=getBankTransferPreview(state,p,choice.direction,choice.amount);
  const settlementRound=state.round+(quote.roundsUntilSettlement||Math.max(1,Number(state.economicCycle?.roundsPerPeriod)||5));
  return {...choice,...quote,settlementRound,settlesThisSeason:settlementRound<=state.maxRounds,
   blockedReason:!available?'实际停靠20号、领完补给后可办理':choice.id==='take'&&!choice.amount?'暂无存款可取出':quote.reason};
 });
}
export function chooseSavings(session){
 if(session.focus?.result?.type==='BANK_TRANSFERRED')return null;
 const choice=chooseAIBankTransfer(session.state,session.currentPlayer);
 return savingsOptions(session).find(o=>!o.blockedReason&&o.direction===choice?.direction)||null;
}
