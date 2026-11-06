// @vitest-environment happy-dom
import {it,expect,afterEach,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {EconomicReportUI} from './src/ui/EconomicReportUI.js';
import {NewsUI} from './src/ui/NewsUI.js';
import {PresentationUI} from './src/ui/PresentationUI.js';
const saved=JSON.parse(readFileSync('qa/continuity-latest-save.json','utf8'));
const report=saved.economicCycle.lastReport, news=saved.newsHistory.find(n=>n.round===report.round);
afterEach(()=>{vi.useRealTimers();document.body.replaceChildren();});
it('keeps every same-round headline impact in one report without changing settlement data',()=>{
 vi.useFakeTimers();const ui=new EconomicReportUI();const before=JSON.stringify({report,news});ui.show(report);
 const presentation={economicReportUI:ui,newsUI:new NewsUI()};
 PresentationUI.prototype.presentDomainEvent.call(presentation,{type:'NEWS_FLASH',news},saved);
 expect(document.querySelectorAll('[role=dialog]')).toHaveLength(1);
 const section=document.querySelector('.economic-round-news');expect(section.textContent).toContain(news.title);expect(section.textContent).toContain(news.desc);
 for(const impact of news.impacts){expect(section.textContent).toContain(impact.label);expect(section.textContent).toContain(impact.detail);}
 expect(document.querySelector('.economic-report-body').firstElementChild).toBe(section);
 expect(JSON.stringify({report,news})).toBe(before);
 vi.advanceTimersByTime(7000);expect(section.isConnected).toBe(true);
 document.querySelector('.economic-report-continue').click();vi.advanceTimersByTime(200);expect(document.querySelectorAll('[role=dialog]')).toHaveLength(0);
});
it('retains ordinary news for a different round or after the report closes',()=>{
 vi.useFakeTimers();const ui=new EconomicReportUI();ui.show(report);
 expect(ui.appendNews({...news,round:news.round+1})).toBe(false);ui.close();expect(ui.appendNews(news)).toBe(false);
 const newsUI=new NewsUI();PresentationUI.prototype.presentDomainEvent.call({economicReportUI:ui,newsUI},{type:'NEWS_FLASH',news},saved);
 expect(document.querySelector('.news-flash-description').textContent).toBe(news.desc);newsUI.close();
});
it('reopening a report restores only its matching news from existing history',()=>{
 vi.useFakeTimers();const ui=new EconomicReportUI();ui.show(report,saved.newsHistory);
 expect(document.querySelectorAll('.economic-round-news article')).toHaveLength(saved.newsHistory.filter(n=>n.round===report.round).length);
 expect(document.querySelector('.economic-round-news').textContent).toContain(news.title);ui.close();
});
