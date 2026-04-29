// Sample shown in the textarea for the AI modes (Cloud / Local). It's
// a *task prompt* — the AI reads it and emits Markdown.
export const DEFAULT_PROMPT = `[プレゼン作成リクエスト]

■ タイトル: プロダクトローンチ計画 2026 Q2
■ 対象: 経営会議 (発表 10 分 / 質疑 10 分)
■ トーン: McKinsey 風 / 数字ファースト / 結論先出し
■ 構成: 課題 → 解決策 → ロードマップ → KPI → まとめ
■ スライド枚数: 8〜12 枚
■ デザイン: ネイビー基調、Yu Gothic、シンプル

[強調したいポイント]
- 競合 A 社に 3 ヶ月遅れているので緊急性が最大の論点
- 顧客アンケート 78% が新機能を要望
- 売上前年比 +20% の KPI は外せない

[含めたい数字 / ファクト]
- 既存ユーザ解約率: 30% → 15% に半減目標
- サポート問合せ -40% 見込み
- NPS +12pt
- M1: API 設計 (5月) / M2: フロント実装 (6月) / M3: ベータ (7月)

[避けたいこと]
- 専門用語の連発
- 1 スライドに 7 行以上の箇条書き
- 過剰なグラデーション

[出力形式]
Markdown で各スライドを出力。
- # = カバー
- ## = 各スライドのタイトル
- - / * = 箇条書き
- | ... | = 表
- > = 引用 / 強調ボックス
`;

// Sample shown in the textarea for AI なし (offline) mode. Unlike
// DEFAULT_PROMPT, this is *real Markdown* — the parser converts it
// directly to slides. Without this swap, offline users hit
// "スライドを抽出できませんでした" because the AI-prompt sample has
// no actual # / ## headers (the headers in there are documentation
// inside a `[出力形式]` block, not real Markdown).
export const OFFLINE_SAMPLE_MARKDOWN = `# プロダクトローンチ計画 2026 Q2
> サブタイトル: 経営会議用プレゼン
> タグライン: 緊急性 × 数字ファースト × 結論先出し

## 現状の課題
- 競合 A 社に 3 ヶ月の遅れ
- 既存ユーザ解約率 30% で高止まり
- サポート問合せが月次で増加傾向

## なぜ今やるか
- 顧客アンケート 78% が新機能を要望
- 売上 KPI 前年比 +20% は外せない
- 6 月リリースで競合に追いつく最後の機会

## 解決策の概要
- 解約率 30% → 15% に半減
- サポート問合せ -40% を実現
- NPS +12pt を 1 四半期で達成

## ロードマップ
| マイルストーン | 期日 | 担当 |
| --- | --- | --- |
| API 設計 (M1) | 5 月末 | バックエンド |
| フロント実装 (M2) | 6 月末 | フロント |
| ベータ公開 (M3) | 7 月中旬 | プロダクト |

## KPI 目標
- 解約率 15% 以下
- NPS +12pt
- サポート問合せ -40%
- ARR +20% (前年比)

## リスクと対策
- 開発遅延 → 週次でスコープ見直し
- 採用追いつかない → 既存メンバーの再配置
- 競合の同時リリース → 差別化機能を 1 つ温存

## まとめ
- 緊急性が最大の論点
- 数字で語る、結論を先に出す
- 6 月にベータ、7 月に本番
`;
