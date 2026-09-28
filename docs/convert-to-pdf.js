const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const mdPath = path.resolve('c:/Coding Projects/ctc-erp/docs/KULLANIM-KILAVUZU.md')
const htmlPath = path.resolve('c:/Coding Projects/ctc-erp/docs/KULLANIM-KILAVUZU.html')
const pdfPath = path.resolve('c:/Coding Projects/ctc-erp/docs/KULLANIM-KILAVUZU.pdf')

const mdContent = fs.readFileSync(mdPath, 'utf8')

// Basit Markdown to HTML çevirici
function mdToHtml(md) {
  let html = md
    // Kod blokları
    .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
    // Başlıklar
    .replace(/^# (.*$)/gim, '<h1 class="main-title">$1</h1>')
    .replace(/^## (.*$)/gim, '<h2 class="section-title">$1</h2>')
    .replace(/^### (.*$)/gim, '<h3 class="scenario-title">$1</h3>')
    .replace(/^#### (.*$)/gim, '<h4 class="sub-title">$1</h4>')
    // Blok alıntı (Blockquote)
    .replace(/^\> (.*$)/gim, '<div class="callout">$1</div>')
    // Kalın & İtalik
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    // Kod
    .replace(/\`(.*?)\`/g, '<code>$1</code>')
    // Yatay Çizgi
    .replace(/^---$/gim, '<hr class="divider"/>')
    // Listeler (girintili maddeler dahil)
    .replace(/^\s*\* (.*$)/gim, '<li>$1</li>')
    .replace(/^\s*[0-9]+\. (.*$)/gim, '<li class="num-li">$1</li>')

  // Paragraflar
  const lines = html.split('\n')
  let inList = false
  let result = []

  for (let line of lines) {
    if (line.includes('<li>')) {
      if (!inList) {
        result.push('<ul>')
        inList = true
      }
      result.push(line)
    } else {
      if (inList) {
        result.push('</ul>')
        inList = false
      }
      if (line.trim() && !line.startsWith('<h') && !line.startsWith('<div') && !line.startsWith('<hr') && !line.startsWith('<pre') && !line.startsWith('</')) {
        result.push(`<p>${line}</p>`)
      } else {
        result.push(line)
      }
    }
  }
  if (inList) result.push('</ul>')

  return result.join('\n')
}

const bodyHtml = mdToHtml(mdContent)

const fullHtml = `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <title>Bilgisayar Hastanesi - Kullanım Kılavuzu</title>
  <style>
    @page {
      size: A4;
      margin: 18mm 15mm 18mm 15mm;
      @bottom-right {
        content: counter(page);
      }
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      font-size: 10.5pt;
      line-height: 1.55;
      color: #1e293b;
      background: #ffffff;
      margin: 0;
      padding: 0;
    }
    .header-box {
      border-bottom: 2.5px solid #4f46e5;
      padding-bottom: 12px;
      margin-bottom: 20px;
    }
    .main-title {
      font-size: 18pt;
      font-weight: 800;
      color: #0f172a;
      margin: 0 0 6px 0;
      letter-spacing: -0.5px;
    }
    .meta-info {
      font-size: 9pt;
      color: #64748b;
      margin-bottom: 12px;
    }
    .section-title {
      font-size: 13pt;
      font-weight: 700;
      color: #1e1b4b;
      border-left: 4px solid #4f46e5;
      padding-left: 10px;
      margin-top: 24px;
      margin-bottom: 10px;
      page-break-after: avoid;
    }
    .scenario-title {
      font-size: 11.5pt;
      font-weight: 700;
      color: #0369a1;
      margin-top: 18px;
      margin-bottom: 8px;
      page-break-after: avoid;
    }
    .sub-title {
      font-size: 10.5pt;
      font-weight: 700;
      color: #334155;
      margin-top: 12px;
      margin-bottom: 6px;
      page-break-after: avoid;
    }
    .callout {
      background: #f8fafc;
      border-left: 3px solid #0284c7;
      padding: 8px 12px;
      margin: 8px 0;
      border-radius: 0 6px 6px 0;
      font-size: 9.5pt;
      color: #0f172a;
    }
    p {
      margin: 6px 0;
    }
    ul, ol {
      margin: 6px 0 10px 18px;
      padding: 0;
    }
    li {
      margin-bottom: 4px;
    }
    code {
      font-family: Consolas, "Courier New", monospace;
      background: #f1f5f9;
      color: #b45309;
      padding: 1px 4px;
      border-radius: 4px;
      font-size: 9pt;
    }
    strong {
      color: #0f172a;
    }
    .divider {
      border: none;
      border-top: 1px dashed #cbd5e1;
      margin: 16px 0;
    }
  </style>
</head>
<body>
  ${bodyHtml}
</body>
</html>`

fs.writeFileSync(htmlPath, fullHtml, 'utf8')
console.log('HTML oluşturuldu:', htmlPath)

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const cmd = `"${edgePath}" --headless --disable-gpu --run-all-compositor-stages-before-draw --print-to-pdf="${pdfPath}" --no-pdf-header-footer "file:///${htmlPath.replace(/\\/g, '/')}"`

console.log('PDF dönüştürülüyor...')
execSync(cmd)

if (fs.existsSync(pdfPath)) {
  const stats = fs.statSync(pdfPath)
  console.log(`BAŞARILI: PDF oluşturuldu! Boyut: ${stats.size} bayt, Konum: ${pdfPath}`)
  
  // Public klasörüne de kopyala (Kullanıcılar webden doğrudan indirsin)
  const publicPdf = path.resolve('c:/Coding Projects/ctc-erp/public/KULLANIM-KILAVUZU.pdf')
  fs.copyFileSync(pdfPath, publicPdf)
  console.log(`Web indirme kopyası güncellendi: ${publicPdf}`)
} else {
  console.error('HATA: PDF oluşturulamadı.')
}
