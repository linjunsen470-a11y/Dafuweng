export const LOTTERY_NUMBER_COUNT = 10;
export const LOTTERY_TICKET_PRICE = 200;
export const LOTTERY_MAX_SELECTION = 3;

function uniqueNumbers(values) {
  return [...new Set((Array.isArray(values) ? values : [values])
    .map(Number)
    .filter(Number.isInteger))];
}

export function getLotteryOffer(state, player) {
  const tickets = state.lottery?.tickets || [];
  const ownNumbers = tickets.filter(ticket => ticket.playerId === player.id).map(ticket => ticket.number);
  const numbers = Array.from({ length: LOTTERY_NUMBER_COUNT }, (_, index) => {
    const number = index + 1;
    const entries = tickets.filter(ticket => ticket.number === number);
    return {
      number,
      ticketCount: entries.length,
      rivalCount: entries.filter(ticket => ticket.playerId !== player.id).length,
      owned: ownNumbers.includes(number),
      holderNames: [...new Set(entries.map(ticket => state.players[ticket.playerId]?.name).filter(Boolean))]
    };
  });
  const cycle = Math.max(1, Number(state.economicCycle?.roundsPerPeriod) || 5);
  const roundsUntilDraw = (cycle - (state.round % cycle)) % cycle;
  const availableCounts = numbers.filter(item => !item.owned).map(item => item.ticketCount);
  const minimumCrowd = availableCounts.length ? Math.min(...availableCounts) : 0;
  return {
    ticketPrice: LOTTERY_TICKET_PRICE,
    maxSelection: LOTTERY_MAX_SELECTION,
    pot: state.lottery?.pot || 2000,
    lastNumber: state.lottery?.lastNumber ?? null,
    ownNumbers,
    totalTickets: tickets.length,
    roundsUntilDraw,
    numbers,
    recommendedNumbers: numbers.filter(item => !item.owned && item.ticketCount === minimumCrowd).map(item => item.number)
  };
}

export function getLotteryPurchasePreview(state, player, selectedNumbers) {
  const offer = getLotteryOffer(state, player);
  const raw = Array.isArray(selectedNumbers) ? selectedNumbers : [selectedNumbers];
  const selections = uniqueNumbers(raw);
  let reason = '';
  if (!raw.length || !selections.length) reason = '请至少选择一个号码';
  else if (selections.length !== raw.length) reason = '每个号码本次只能选择一次';
  else if (selections.some(number => number < 1 || number > LOTTERY_NUMBER_COUNT)) reason = '乐透号码无效';
  else if (selections.length > LOTTERY_MAX_SELECTION) reason = `单次最多购买 ${LOTTERY_MAX_SELECTION} 张`;
  else if (selections.some(number => offer.ownNumbers.includes(number))) reason = '本期不能重复购买已持有号码';
  const cost = selections.length * LOTTERY_TICKET_PRICE;
  if (!reason && player.cash < cost) reason = '现金不足';
  const projectedPot = offer.pot + cost;
  const expectedPayout = Math.floor(selections.reduce((total, number) => {
    const crowd = offer.numbers[number - 1]?.ticketCount || 0;
    return total + projectedPot / (crowd + 1) / LOTTERY_NUMBER_COUNT;
  }, 0));
  return {
    ...offer,
    selections,
    enabled: !reason,
    reason,
    cost,
    projectedPot,
    winChance: selections.length / LOTTERY_NUMBER_COUNT,
    expectedPayout,
    crowdedSelections: selections.filter(number => (offer.numbers[number - 1]?.ticketCount || 0) > 0)
  };
}

export function chooseAILotteryNumbers(state, player, maximum = 1) {
  const offer = getLotteryOffer(state, player);
  const affordable = Math.min(maximum, LOTTERY_MAX_SELECTION, Math.floor(player.cash / LOTTERY_TICKET_PRICE));
  return [...offer.numbers]
    .filter(item => !item.owned)
    .sort((a, b) => a.ticketCount - b.ticketCount || a.number - b.number)
    .slice(0, affordable)
    .map(item => item.number);
}
