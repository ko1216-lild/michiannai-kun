# Development Log

## 2026-06-17

### 対象プロジェクト

- フォルダ名: 案内くん
- サービス表示名: 道案内くん
- サービス説明: 寄り道つきルート指示書
- 初回MVPコミット: `955e62f Create initial Michiannai-kun MVP`

### 実装済み内容

- Node.js + Express 構成
- ルート案件作成
- 不動産内覧テンプレート
- 寄り道ポイント追加・編集・削除・上下移動
- 共有URL作成
- 担当者用共有画面
- Google Mapsで開くボタン
- 周辺駐車場検索ボタン
- コインパーキング検索ボタン
- Google通常検索ボタン
- チェックリスト完了保存
- 任意チェック追加
- 完了確認画面
- LINE報告リンク
- スマホアプリ風UI
- アプリ全体をスマホ幅に固定
- 寄り道ポイントを番号付きカード表示へ改善
- 各ポイントの編集フォームは初期状態で閉じる
- 編集ボタンを押したポイントだけフォーム展開
- XSS対策として `escapeHtml` を使用
- `shareId` は `crypto.randomBytes` で推測困難化
- `routes.json` 保存は tmp 書き込み後 rename

### 実装しなかったもの

- Google Places API
- Google Routes API
- AI API
- GPSリアルタイム追跡
- 自前ナビ
- ログイン
- 決済
- PDF保存
- 駐車場満空情報
- 駐車場料金順ソート

### 現在のGit状態

- 初回コミット済み
- コミットID: `955e62f`
- コミットメッセージ: `Create initial Michiannai-kun MVP`
- `git status` は clean 確認済み
- `node_modules` は `.gitignore` で除外済み

### 次にやること

- 実際の不動産内覧想定で1件ルートを作成する
- スマホで共有URLを開いて操作確認する
- 駐車場検索ボタンが現場で使いやすいか確認する
- 担当者目線で迷わないか確認する
- 問題があればUI修正
- 新機能追加は実使用テスト後に判断する
