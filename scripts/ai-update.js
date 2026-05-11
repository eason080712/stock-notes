import fs from "fs"

const STOCKS = [
  {
    ticker: "2330",
    stockName: "台積電",
    exchange: "TWSE",
    file: "content/台股分析/台積電 2330 完整分析.md",
    lang: "zh-TW",
  },
  {
    ticker: "3592",
    stockName: "瑞鼎",
    exchange: "TWSE",
    file: "content/台股分析/瑞鼎 3592 完整分析.md",
    lang: "zh-TW",
  },
  {
    ticker: "MSFT",
    stockName: "Microsoft",
    exchange: "NASDAQ",
    file: "content/美股分析/MSFT Microsoft 完整分析.md",
    lang: "en",
  },
  {
    ticker: "TSLA",
    stockName: "Tesla",
    exchange: "NASDAQ",
    file: "content/美股分析/TSLA Tesla 完整分析.md",
    lang: "en",
  },
  {
    ticker: "VCX",
    stockName: "Fundrise Innovation Fund",
    exchange: "NYSE",
    file: "content/美股分析/VCX Fundrise Innovation Fund 完整分析.md",
    lang: "en",
  },
]

async function fetchNews(stock) {
  const query = `${stock.stockName} ${stock.ticker}`
  const gl = stock.lang === "zh-TW" ? "TW" : "US"
  const ceid = stock.lang === "zh-TW" ? "TW:zh-Hant" : "US:en"
  const rss = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=${stock.lang}&gl=${gl}&ceid=${ceid}`

  const r = await fetch(rss, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; StockNewsBot/1.0)" },
  })
  const xml = await r.text()

  const items = []
  const itemRegex = /<item>([\s\S]*?)<\/item>/g
  let match
  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1]
    const titleMatch = block.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) || block.match(/<title>(.*?)<\/title>/)
    const linkMatch = block.match(/<link>(.*?)<\/link>/)
    const pubDateMatch = block.match(/<pubDate>(.*?)<\/pubDate>/)
    if (titleMatch) {
      items.push({
        title: titleMatch[1].trim(),
        link: linkMatch?.[1]?.trim() || "",
        pubDate: pubDateMatch?.[1]?.trim() || new Date().toISOString(),
      })
    }
  }

  console.log(`  → RSS 回傳 ${items.length} 則`)
  return items.slice(0, 8)
}

async function generateSummary(stock, news) {
  const newsLines = news
    .slice(0, 6)
    .map((item, i) => {
      const date = new Date(item.pubDate).toLocaleDateString("zh-TW")
      return `${i + 1}. [${date}] ${item.title}`
    })
    .join("\n")

  const prompt =
    stock.lang === "zh-TW"
      ? `你是一位專業股票分析師。請根據以下關於 ${stock.stockName}（${stock.ticker}）的最新新聞，用繁體中文寫一段「近期動態摘要」，約 100–150 字。\n- 重點摘述最重要的 2–3 個事件\n- 說明對股價可能的影響\n- 語氣客觀，不給買賣建議\n\n新聞列表：\n${newsLines}\n\n請直接輸出摘要，不要加標題或額外說明。`
      : `You are a professional stock analyst. Based on the following recent news about ${stock.stockName} (${stock.ticker}), write a brief "Recent Updates" summary in Traditional Chinese (繁體中文), around 100–150 characters.\n- Highlight 2–3 key developments\n- Note potential impact on stock price\n- Be objective, no buy/sell advice\n\nNews:\n${newsLines}\n\nOutput the summary directly without any title or extra explanation.`

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 400, temperature: 0.3 },
    }),
  })

  const j = await r.json()
  return j.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || ""
}

function updateMarkdown(filePath, summary, dateStr) {
  let content = fs.readFileSync(filePath, "utf-8")

  const block = `<!-- AI_UPDATE_START -->
> [!note] AI 近期動態（${dateStr} 自動更新）
> ${summary.replace(/\n/g, "\n> ")}
<!-- AI_UPDATE_END -->`

  if (content.includes("<!-- AI_UPDATE_START -->")) {
    content = content.replace(
      /<!-- AI_UPDATE_START -->[\s\S]*?<!-- AI_UPDATE_END -->/,
      block
    )
  } else {
    // 插入在第一個 iframe 之後
    if (content.includes("</iframe>")) {
      content = content.replace("</iframe>", `</iframe>\n\n${block}`)
    } else {
      // 插入在 h1 標題之後
      content = content.replace(/^(# .+)$/m, `$1\n\n${block}`)
    }
  }

  fs.writeFileSync(filePath, content, "utf-8")
}

async function main() {
  const dateStr = new Date().toLocaleDateString("zh-TW", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })

  let updated = 0

  for (const stock of STOCKS) {
    try {
      console.log(`\n處理 ${stock.stockName} (${stock.ticker})...`)
      const news = await fetchNews(stock)

      if (!news.length) {
        console.log(`  → 無新聞，略過`)
        continue
      }

      console.log(`  → 取得 ${news.length} 則新聞`)
      const summary = await generateSummary(stock, news)

      if (!summary) {
        console.log(`  → Claude 未回傳內容，略過`)
        continue
      }

      console.log(`  → 摘要：${summary.slice(0, 50)}...`)
      updateMarkdown(stock.file, summary, dateStr)
      console.log(`  → 已更新 ${stock.file}`)
      updated++

      // 避免 API rate limit
      await new Promise((r) => setTimeout(r, 1500))
    } catch (e) {
      console.error(`  → 錯誤：${e.message}`)
    }
  }

  console.log(`\n完成，共更新 ${updated} 個檔案`)
}

main()
