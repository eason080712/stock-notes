import { QuartzComponentConstructor, QuartzComponentProps } from "./types"
import style from "./styles/stockPrice.scss"

export default (() => {
  function StockPrice({ fileData }: QuartzComponentProps) {
    const ticker = fileData.frontmatter?.ticker as string | undefined
    if (!ticker) return null

    const exchange = fileData.frontmatter?.exchange as string | undefined
    const isTWSE = exchange === "TWSE"
    const lastPrice = fileData.frontmatter?.lastPrice as number | undefined
    const lastDate = fileData.frontmatter?.lastDate as string | undefined

    return (
      <div
        class="stock-price-widget"
        data-ticker={ticker}
        data-market={isTWSE ? "twse" : "us"}
        data-last-price={lastPrice?.toString() ?? ""}
        data-last-date={lastDate ?? ""}
      >
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
      const lastPr = parseFloat(w.dataset.lastPrice || '');
      const lastDt = w.dataset.lastDate || '';
      const pel = document.getElementById('spw-price-' + tk);
      const cel = document.getElementById('spw-change-' + tk);
      const mel = document.getElementById('spw-meta-' + tk);
      if (!pel || !cel || !mel) return;

      // 先顯示 frontmatter 備用價格
      if (lastPr && !isNaN(lastPr)) {
        pel.textContent = (mkt === 'twse' ? 'NT$' : '$') + lastPr.toFixed(mkt === 'twse' ? 1 : 2);
        mel.textContent = lastDt ? lastDt + ' 收盤（更新中）' : '更新中…';
      }

      async function fetchYahoo(url) {
        const r = await fetch(url, { cache: 'default' });
        const j = await r.json();
        return j?.chart?.result?.[0]?.meta;
      }

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
            const n = new Date();
            mel.textContent = n.getHours().toString().padStart(2,'0') + ':' + n.getMinutes().toString().padStart(2,'0') + ' 更新';
          } else {
            if (lastPr && !isNaN(lastPr)) mel.textContent = lastDt ? lastDt + ' 收盤' : '今日無交易';
            else mel.textContent = '今日無交易資料';
          }
        } else {
          const yfBase = ['https://query1.', 'finance.yahoo', '.com/v8/finance/chart/'].join('');
          const yfUrl = yfBase + tk + '?interval=1d&range=1d';
          let m = null;
          try {
            m = await fetchYahoo(yfUrl);
          } catch(corsErr) {
            // CORS 失敗，改走 proxy
            try {
              const proxy = ['https://api.all', 'origins.win/get?url='].join('');
              const r2 = await fetch(proxy + encodeURIComponent(yfUrl));
              const w2 = await r2.json();
              const j2 = JSON.parse(w2.contents || '{}');
              m = j2?.chart?.result?.[0]?.meta;
            } catch(e2) { m = null; }
          }
          if (m && m.regularMarketPrice) {
            const pr = m.regularMarketPrice;
            const prev = m.previousClose || m.chartPreviousClose;
            const ch = prev ? pr - prev : 0;
            const pct = prev ? ch / prev * 100 : 0;
            const s = ch >= 0 ? '+' : '';
            pel.textContent = '$' + pr.toFixed(2);
            if (prev) {
              cel.textContent = s + ch.toFixed(2) + ' (' + s + pct.toFixed(2) + '%)';
              cel.className = 'spw-change ' + (ch >= 0 ? 'up' : 'down');
            }
            const n = new Date();
            mel.textContent = n.getHours().toString().padStart(2,'0') + ':' + n.getMinutes().toString().padStart(2,'0') + ' 更新';
          } else {
            // API 無資料，保留備用價格並標示
            if (lastPr && !isNaN(lastPr)) mel.textContent = lastDt ? lastDt + ' 收盤' : '無即時資料';
            else mel.textContent = '無即時資料';
          }
        }
      } catch(e) {
        if (lastPr && !isNaN(lastPr)) mel.textContent = lastDt ? lastDt + ' 收盤' : '無即時資料';
        else if (mel) mel.textContent = '無法取得報價';
      }
    });
  `

  return StockPrice
}) satisfies QuartzComponentConstructor
