import { QuartzComponentConstructor, QuartzComponentProps } from "./types"
import style from "./styles/stockPrice.scss"

export default (() => {
  function StockPrice({ fileData }: QuartzComponentProps) {
    const ticker = fileData.frontmatter?.ticker as string | undefined
    if (!ticker) return null

    const exchange = fileData.frontmatter?.exchange as string | undefined
    const isTWSE = exchange === "TWSE"

    return (
      <div class="stock-price-widget" data-ticker={ticker} data-market={isTWSE ? "twse" : "us"}>
        <div class="spw-main">
          <span class="spw-ticker">{ticker}</span>
          <span class="spw-price" id={`spw-price-${ticker}`}>--</span>
          <span class="spw-change neutral" id={`spw-change-${ticker}`}>--</span>
        </div>
        <span class="spw-meta" id={`spw-meta-${ticker}`}>載入中…</span>
      </div>
    )
  }

  StockPrice.css = style

  StockPrice.afterDOMLoaded = `
    document.addEventListener('nav', async function spwFetch() {
      const w = document.querySelector('.stock-price-widget');
      if (!w) return;
      const tk = w.dataset.ticker;
      const mkt = w.dataset.market;
      const pel = document.getElementById('spw-price-' + tk);
      const cel = document.getElementById('spw-change-' + tk);
      const mel = document.getElementById('spw-meta-' + tk);
      if (!pel || !cel || !mel) return;

      try {
        if (mkt === 'twse') {
          const ep = ['https://open', 'api.twse', '.com.tw/v1/', 'exchangeReport/STOCK_DAY_ALL'].join('');
          const r = await fetch(ep, { cache: 'default' });
          const d = await r.json();
          const it = d.find(x => x.Code === tk);
          if (it) {
            const pr = parseFloat(it.ClosingPrice);
            const raw = (it.Change || '0').replace(/\\s/g, '').replace(/^\\+/, '');
            const ch = parseFloat(raw) || 0;
            const prev = pr - ch;
            const pct = prev > 0 ? ch / prev * 100 : 0;
            const s = ch >= 0 ? '+' : '';
            pel.textContent = 'NT$' + pr.toFixed(1);
            cel.textContent = s + ch.toFixed(1) + ' (' + s + pct.toFixed(2) + '%)';
            cel.className = 'spw-change ' + (ch >= 0 ? 'up' : 'down');
          } else {
            mel.textContent = '今日無交易資料';
            return;
          }
        } else {
          const ep = ['https://query1.', 'finance.yahoo', '.com/v8/finance/chart/', tk, '?interval=1d&range=1d'].join('');
          const r = await fetch(ep, { cache: 'default' });
          const j = await r.json();
          const m = j?.chart?.result?.[0]?.meta;
          if (m) {
            const pr = m.regularMarketPrice;
            const prev = m.previousClose || m.chartPreviousClose;
            const ch = pr - prev;
            const pct = prev > 0 ? ch / prev * 100 : 0;
            const s = ch >= 0 ? '+' : '';
            pel.textContent = '$' + pr.toFixed(2);
            cel.textContent = s + ch.toFixed(2) + ' (' + s + pct.toFixed(2) + '%)';
            cel.className = 'spw-change ' + (ch >= 0 ? 'up' : 'down');
          } else {
            mel.textContent = '今日無交易資料';
            return;
          }
        }

        const n = new Date();
        mel.textContent = n.getHours().toString().padStart(2,'0') + ':' + n.getMinutes().toString().padStart(2,'0') + ' 更新';
      } catch(e) {
        if (mel) mel.textContent = '無法取得報價';
      }
    });
  `

  return StockPrice
}) satisfies QuartzComponentConstructor
