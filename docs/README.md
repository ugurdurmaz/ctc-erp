# docs/

| Dosya | Ne için | Kim okur |
|---|---|---|
| `../CLAUDE.md` | Proje özeti, zorunlu çalışma kuralları, pointer map. **Her şeyden önce okunur.** | Herkes, her seferinde |
| `HANDBOOK.md` | Sistem nasıl çalışır: mimari, veri modeli, iş kuralları, modül rehberi, bilinen sorunlar | Kod yazan / değiştiren |
| `RUNBOOK.md` | Ne yapmalıyım: kurulum, deploy, günlük/aylık operasyon, arıza giderme, onarım SQL | İşleten / destek veren |
| `AUDIT-2026-09-16.md` | Mimari + güvenlik denetimi, şiddet sıralı bulgular, düzeltme fazları | Planlayan / önceliklendiren |

Okuma sırası yeni katılan için: `CLAUDE.md` → `HANDBOOK.md §3–6` → çalışılacak modülün `HANDBOOK.md §7` bölümü → `AUDIT` ilgili bulgular → gerekiyorsa `RUNBOOK`.

Güncelleme kuralı: kodla birlikte, aynı commit içinde (`CLAUDE.md › Çalışma kuralları §3`).
