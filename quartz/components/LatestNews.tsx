import { QuartzComponentConstructor, QuartzComponentProps } from "./types"
import style from "./styles/latestNews.scss"

export default (() => {
  function LatestNews({ fileData }: QuartzComponentProps) {
    const ticker = fileData.frontmatter?.ticker as string | undefined
    if (!ticker) return null

    const stockName = fileData.frontmatter?.stockName as string | undefined
    const exchange = fileData.frontmatter?.exchange as string | undefined
    const isTWSE = exchange === "TWSE"
    const query = isTWSE
      ? `${stockName ?? ""} ${ticker}`
      : `${stockName ?? ticker} ${ticker}`

    return (
      <div class="latest-news" data-query={query} data-ticker={ticker}>
        <div class="ln-header">
          <span class="ln-title">即時新聞</span>
          <span class="ln-badge" id={`ln-cnt-${ticker}`}>載入中</span>
        </div>
        <div class="ln-list" id={`ln-list-${ticker}`}>
          <div class="ln-loading">
            <span class="ln-spinner"></span>
          </div>
        </div>
      </div>
    )
  }

  LatestNews.css = style

  LatestNews.afterDOMLoaded = `
    document.addEventListener('nav', async function lnFetch() {
      const w = document.querySelector('.latest-news');
      if (!w) return;
      const tk = w.dataset.ticker;
      const query = w.dataset.query;
      const listEl = document.getElementById('ln-list-' + tk);
      const cntEl = document.getElementById('ln-cnt-' + tk);
      if (!listEl || !cntEl) return;

      try {
        const rss = 'https://news.google.com/rss/search?q='
          + encodeURIComponent(query)
          + '&hl=zh-TW&gl=TW&ceid=TW:zh-Hant';
        const api = 'https://api.rss2json.com/v1/api.json?rss_url='
          + encodeURIComponent(rss) + '&count=6';
        const r = await fetch(api, { cache: 'default' });
        const j = await r.json();

        if (j.status !== 'ok' || !j.items?.length) throw new Error('no items');

        cntEl.textContent = j.items.length + ' 則';
        listEl.innerHTML = '';

        j.items.forEach(item => {
          const age = (Date.now() - new Date(item.pubDate)) / 1000;
          const title = (item.title || '').replace(/ - .+$/, '').trim();
          const src = item.author || '媒體';
          const a = document.createElement('a');
          a.className = 'ln-item';
          a.href = item.link || '#';
          a.target = '_blank';
          a.rel = 'noopener';
          a.innerHTML =
            '<div class="ln-meta">'
            + '<span class="ln-src">' + src + '</span>'
            + '<span class="ln-ago">' + lnAge(age) + '</span>'
            + (age < 3600 ? '<span class="ln-hot">最新</span>' : '')
            + '</div>'
            + '<div class="ln-text">' + title + '</div>';
          listEl.appendChild(a);
        });
      } catch(_) {
        cntEl.textContent = '暫無';
        listEl.innerHTML = '<div class="ln-empty">新聞載入失敗</div>';
      }
    });

    function lnAge(s) {
      if (s < 60) return '剛剛';
      if (s < 3600) return Math.floor(s / 60) + ' 分鐘前';
      if (s < 86400) return Math.floor(s / 3600) + ' 小時前';
      return Math.floor(s / 86400) + ' 天前';
    }
  `

  return LatestNews
}) satisfies QuartzComponentConstructor
