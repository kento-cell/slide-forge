# 🎨 Slide Forge

> **プロンプトを書いて投げるだけで PowerPoint (.pptx) を生成するツール。**
> クラウド AI / ローカル AI / オフライン Markdown 変換 の 3 モードに対応。サブスクと別課金の API を強要しない設計。

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Tauri](https://img.shields.io/badge/Tauri-2-FFC131?logo=tauri)](https://tauri.app/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite)](https://vite.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3-06B6D4?logo=tailwindcss)](https://tailwindcss.com/)

## ⬇ ダウンロード (デスクトップ版)

| OS | ファイル | サイズ目安 |
|---|---|---|
| Windows | `Slide_Forge_*.msi` または `*-setup.exe` | 約 10 MB |
| macOS | `Slide_Forge_*.dmg` (Universal: Intel + Apple Silicon) | 約 15 MB |
| Linux | `slide-forge_*.AppImage` または `*.deb` | 約 12 MB |

**👉 [最新リリースページ](https://github.com/kento-cell/slide-forge/releases/latest) からダウンロード**

> **初回起動の注意**: コード署名なし OSS のため警告が出ます。
> - Windows: 「詳細情報」→「実行」
> - macOS: 右クリック → 「開く」

## 何ができるか

- **D&D 投入** — `.md` `.txt` を画面にドラッグ
- **コピペ可能な薄字サンプル** — 編集してなければサンプル文がそのまま使われる (典型プロンプトを参考にして書ける)
- **テーマ 3 種** — Navy / Light / Mono
- **3 つの AI モード** — Cloud (Gemini/Groq/Claude/GPT) / Local (Ollama) / Offline (md→pptx)
- **DL / 再生成 / 編集に戻る** — モダン UI で 1 クリック

## 「ばらまける」設計のポイント

| 課題 | このアプリの答え |
|---|---|
| **API キーが面倒で離脱** | キー無しでも **オフラインモード**で md→pptx 変換が動く |
| **サブスク済ユーザの二重課金** | サブスク (ChatGPT Plus / Claude Pro) と API は別請求 → 代わりに **無料 API キー (Gemini / Groq)** を案内 |
| **環境依存** | ブラウザ 1 つ動けば OK (将来 Tauri exe 化も視野) |
| **データ流出が嫌** | **Ollama ローカル LLM**で完全 PC 内で完結。外部送信ゼロ |
| **どのプロバイダ?** | 初回ウィザードで 1 画面選択 → ガイド付きセットアップ |

## クイックスタート (開発者向け)

ソースから動かす場合:

```bash
git clone https://github.com/kento-cell/slide-forge
cd slide-forge
npm install

# A. ブラウザで開発サーバ
npm run dev    # → http://localhost:1420

# B. デスクトップアプリで起動 (要 Rust toolchain)
npm run tauri:dev

# C. exe / dmg / AppImage を自分でビルド
npm run tauri:build
```

## AI セットアップ早見表

| モード | 必要なもの | 所要時間 | 費用 | 品質 | データ送信先 |
|---|---|---|---|---|---|
| **クラウド (Gemini)** | 無料 API キー 1 個 | 約 1 分 | 実質 ¥0 (無料枠) | ★★★★ | Google サーバ |
| **クラウド (Groq)** | 無料 API キー 1 個 | 約 1 分 | 実質 ¥0 (無料枠) | ★★★★ | Groq サーバ |
| **クラウド (Claude/GPT)** | 有料 API キー | 約 1 分 | 従量課金 | ★★★★★ | 各社サーバ |
| **ローカル (Ollama)** | Ollama 本体 + モデル DL | 5〜10 分 | 完全 ¥0 | ★★★ | あなたの PC のみ |
| **オフライン (AI なし)** | なし | 0 秒 | ¥0 | ★★ (md 変換) | 送信なし |

詳細: [docs/setup.md](docs/setup.md)

## 主要技術

| 層 | 採用 |
|---|---|
| Frontend | React 19 / Vite 8 / TypeScript 5 / Tailwind CSS 3 |
| 状態管理 | Zustand |
| LLM プロバイダ | Google Gemini / Groq / Anthropic / OpenAI / Ollama (REST 直叩き) |
| PPTX 生成 | [PptxGenJS](https://gitbrent.github.io/PptxGenJS/) v4 |
| Markdown パース | 自作 (シンプルな AST 抽出) |
| 永続化 | localStorage (将来 Tauri Keyring 移行) |

## ディレクトリ構成

```
slide-forge/
├ src/
│  ├ components/    画面 (Wizard / Header / Main / Result)
│  ├ providers/     LLM 各社の REST クライアント (統一 IF)
│  ├ pptx/          PPTX 生成エンジン + テーマ定義
│  ├ md/            Markdown → AST パーサ
│  ├ store/         Zustand
│  ├ samples/       灰色テキストエリアの典型プロンプト
│  ├ lib/           system prompt / localStorage helper
│  └ types.ts       共通型
├ public/
└ docs/             setup
```

## 使い方の流れ

```
1. 初回ウィザード
   ├ ☁ クラウド AI    (Gemini を 1 分でセットアップ)
   ├ 💻 ローカル AI    (Ollama 自動検出 → モデル DL)
   └ ✏ AI なし        (md→pptx 変換のみ。即動く)

2. メイン画面
   - 灰色サンプルプロンプトをそのまま生成 / 編集 / .md ドロップ
   - テーマ選択 (Navy / Light / Mono)
   - [▶ 生成]

3. 結果画面
   - スライドサムネ一覧 (16:9)
   - [⬇ DL] [♻ 再生成] [Markdown を見る] [編集に戻る]
```

## 典型プロンプト (灰色サンプル)

`src/samples/defaultPrompt.ts` に同梱。McKinsey 風プレゼン作成リクエストを「対象 / トーン / 構成 / 強調 / 数字 / 避けること / 出力形式」に分けて記述。**コピペ可能**で編集不要でも生成ボタンが押せる。

## ロードマップ

| 機能 | 状態 |
|---|---|
| 3 モード LLM (Cloud / Local / Offline) | ✅ |
| 6 種スライド型 (cover / bullets / two-column / table / quote / summary) | ✅ |
| テーマ 3 種 | ✅ |
| 再生成 / DL / プレビュー | ✅ |
| Ollama 自動検出 + モデル DL ウィザード | ✅ |
| **Tauri ラップ (zip → exe)** | 🔜 |
| スライド単位の再生成 | 🔜 |
| 出力フォーマット拡張 (PDF / md エクスポート) | 🔜 |
| 公式テンプレ集 (営業 / 経営報告 / LT / 製品紹介) | 🔜 |
| トークン消費量の可視化 | 🔜 |

## License

[MIT](LICENSE)

## 注意

- API キーはブラウザの localStorage に**平文**で保存されます (Tauri 化後に OS キーリングへ移行予定)
- ブラウザから直接 API を叩く構成のため、**Anthropic API は Origin 制約あり**(`anthropic-dangerous-direct-browser-access` を付与)
- Ollama はローカルで `localhost:11434` を起動している前提
