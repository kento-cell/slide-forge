# Slide Forge — 戦略相談プラン

次回ユーザーとプロダクト相談を行う際の議題と判断材料を、
現状把握 → 開いている決定事項 → リスク → 推奨議題順 の流れでまとめる。

---

## 1. 現状インベントリ (2026-04 末時点)

### 機能スコープ

| カテゴリ | 実装状況 |
|---|---|
| LLM プロバイダ | Gemini / Groq / Anthropic / OpenAI / Ollama / Offline |
| プロバイダ自動検出 | Ollama を起動時に1回だけ probe (リセット時は再発火しない) |
| API キー保管 | OS キーチェーン (Keychain / Credential Manager / Secret Service) |
| Slide type | 11 種: cover / bullets / two-column / table / quote / summary / section / stat / image / process / cards |
| テーマ | Navy / Light / Mono の 3 種 |
| 装飾 | 番号バッジ + ドロップシャドウ / 同心円 / 多層幾何 / アクセントドット / 角パターン |
| 自動アップデート | minisign 署名 + GitHub Releases endpoint |
| 画像生成 | Gemini (4 モデル fallback) / OpenAI (gpt-image-1) |
| 画像取込 | D&D / ファイル選択 / AI 生成 — いずれも image slide として deck に追加 |
| 多言語 | 日本語 UI のみ |
| 配布 | Tauri 2 で Win MSI / Mac DMG / Linux AppImage+deb |

### 検証カバー

- 静的 portability audit ✅ (7/7 PASS)
- 統合 E2E ✅ (10/10 PASS)
- テーマ色伝播 ✅ (3/3 PASS)
- プロンプト多様性 ✅ (7/7 PASS = SECTION/STAT/FLOW/CARDS/table/quote/bullets)
- Win 実機ランタイム ✅
- Mac/Linux 実機ランタイム ❌ (CI ビルドは通るが起動確認できる手元の機材なし)
- npm audit ✅ 0 件

---

## 2. 開いている決定事項 (User の判断待ち)

| # | 議題 | 選択肢 | 推奨 |
|---|---|---|---|
| 1 | v0.2.0 リリース | (a) すぐタグ切ってリリース / (b) もう少し検証してから / (c) v1.0.0 まで private | **(a)** 既に CI 通過、ユーザー検証も十分。GitHub Secrets セット → タグ切り → 配布開始 |
| 2 | コード署名 | (a) 自費でコードサイン証明書 / (b) 未署名で配布 (警告許容) / (c) 待つ | **(b)** 個人 OSS なら警告画面付きで OK。法人化したら (a) |
| 3 | テレメトリ | (a) Sentry 等で集計 / (b) 完全ローカル | **(b)** 「外部送信ゼロ」が売りなので一貫性のため |
| 4 | 多言語化 | (a) 英語 UI 追加 / (b) 日本語のみ / (c) 自動翻訳 | **(b)** 当面。海外ユーザーが付き始めたら (a) |
| 5 | ローカル画像生成統合 | (a) SD WebUI / (b) ComfyUI / (c) スルー (cloud only) | **(c)** 画像は Gemini 無料枠でほぼ足りる、両方追加は工数大 |
| 6 | プロバイダ拡張 | (a) Mistral / Cohere 追加 / (b) 既存 5 で十分 | **(b)** 主要枠は埋まってる |

---

## 3. 既知のリスク

### 3.1 技術的負債

- **CSP の `'unsafe-inline'` (style-src)** — Tailwind の compiled CSS が必要としてる。除去するには CSP nonce + Tailwind の preflight 切り替えが必要
- **Gemini 画像生成のモデル名揺れ** — 既に 4 モデル fallback で対応してるが、Google が再度名前変えると 1 モデル分すり減る
- **Ollama 検出が単発** — 後から Ollama 起動した場合、再起動するまで検出されない
- **Image slide の挿入位置** — 末尾 append のみ。任意位置への差し込みは未対応

### 3.2 プロダクト/UX

- **再生成しても似た内容** — プロンプトヒントで部分対応済み。LLM の sampling 設定 (temperature) を高めるオプションはまだ
- **大量画像生成時のクォータ枯渇** — Gemini 無料枠は 1 日 ~10 枚で枯渇しやすい。OpenAI 切替案内は出してるが、UX としては事前警告したい
- **オフラインモードのサンプルが固定** — 何度試しても同じ deck。ランダムサンプル切替欲しい

### 3.3 配布/運用

- **私の手元に Mac / Linux 実機なし** — 実ユーザーで動作確認待ち
- **コードサイン未取得** — Win/Mac の警告 UI が出る。OSS バナーで容認可
- **更新鍵の単一管理** — `E:/slide-forge-update.key` 1 個のみ。バックアップ必須(別ストレージへ)

---

## 4. 推奨議題順 (次回相談で1時間枠取るなら)

### Round 1 (15分): リリース判断
- v0.2.0 を出すか / 何を待つか
- GitHub Secrets セット完了確認
- タグ切り → CI 待ちの段取り

### Round 2 (15分): 価値の優先順位
- 次の機能を 3 つ並べたら、最も急ぐのは?
  - スピーカーノート自動生成
  - スライド単位 regenerate (1 枚だけ別案で)
  - Result 画面でのスライド並べ替え/削除
  - 画像の任意位置挿入
- 「とりあえずリリースしてフィードバック待ち」も選択肢

### Round 3 (15分): 配布戦略
- ユーザー獲得チャネル (Zenn 記事 / Twitter / Product Hunt / Hacker News)
- ライセンス (現 MIT) のまま行くか
- Issue 受付方針 (個人で対応可能な範囲か)

### Round 4 (15分): バグ整理
- 上記「既知のリスク」から優先 3 件決定
- 修正は次セッションでやるか即対応か

---

## 5. 進行のための前提情報

### 5.1 リリースに必要なステップ (再確認)

```bash
# 1. GitHub Secrets を一度だけ設定
#    Settings → Secrets and variables → Actions
#    - TAURI_SIGNING_PRIVATE_KEY = E:/slide-forge-update.key の中身
#    - TAURI_SIGNING_PRIVATE_KEY_PASSWORD = (空文字)

# 2. private key を別所にバックアップ → ローカル削除
#    失うと将来のリリースに署名できず、autoupdate が永久に動かない

# 3. タグ切ってリリース起動
git tag v0.2.0 -m "feat: rich shapes, image gen, regenerate variance"
git push origin v0.2.0
# → CI が Win/Mac/Linux 用 installer + latest.json を Releases に publish
```

### 5.2 既存 v0.1.0 ユーザーの移行

- **v0.1.0 は updater 入ってない** → v0.2.0 への移行だけは手動 DL/インストール必須
- v0.2.0 以降は自動更新が効く

### 5.3 ベンチマーク数値

| 項目 | 計測値 |
|---|---|
| 起動時間 (cold) | 2-3 秒 (debug build), 1 秒以下 (release 想定) |
| Ollama 検出 | <500ms |
| Markdown → PPTX 生成 (offline) | 800ms |
| LLM → PPTX 生成 (Ollama qwen2.5:14b) | 80-200 秒 |
| LLM → PPTX 生成 (Gemini Flash) | 5-15 秒 |
| 画像生成 (Gemini) | 10-30 秒 |
| 画像生成 (OpenAI gpt-image-1) | 20-60 秒 |
| バンドルサイズ (initial) | 237 KB |
| バンドルサイズ (lazy generator) | 379 KB |
| インストーラサイズ | Win MSI ~10 MB / Mac DMG ~15 MB / Linux AppImage ~12 MB |

---

## 6. 議題に上がりそうな仮想 Q&A

- **Q: 個人ユーザー向け? 法人向け?**
  - 現状の作りは個人ユーザー前提 (キーは各自 / コスト各自負担)。法人なら SSO + 集中課金が必要、現アーキテクチャでは未対応

- **Q: 商用利用 OK?**
  - License は MIT → 商用 OK。ただし API キーは利用者の個人プラン or 自社プランを使う形

- **Q: 出力スライドの著作権は?**
  - LLM プロバイダの利用規約に従う。Gemini/OpenAI/Anthropic はいずれも生成物の商用利用可

- **Q: API キーが漏洩したら?**
  - OS キーチェーン保管なので OS のロック画面解除しないと取れない。Tauri 内のサンドボックスからも別アプリは読めない

- **Q: PPTX を編集して使えるか?**
  - 出力 PPTX は単純な OOXML 構造、PowerPoint / Keynote / LibreOffice で全要素編集可能
