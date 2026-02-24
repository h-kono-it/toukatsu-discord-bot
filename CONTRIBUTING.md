# Contributing to discord-toukatsu-dev

ご貢献ありがとうございます！このドキュメントでは、プロジェクトへの貢献方法を説明します。

## Issue の報告

バグの報告や機能リクエストは
[GitHub Issues](https://github.com/h-kono-it/toukatsu-discord-bot/issues)
から行ってください。

Issue には以下のラベルを付けてください：

| ラベル        | 説明                           |
| ------------- | ------------------------------ |
| `general`     | 全般的な改善・バグ修正         |
| `spotify`     | Spotify 新曲通知に関する変更   |
| `forum_board` | フォーラム募集通知に関する変更 |
| `thema_talk`  | 話題提供機能に関する変更       |

## 開発の流れ

1. このリポジトリをフォークする
2. フィーチャーブランチを作成する (`git checkout -b feature/your-feature`)
3. 変更を実装する
4. 型チェックを実行する (`deno check main.ts`)
5. 変更をコミットする (`git commit -m 'Add some feature'`)
6. ブランチをプッシュする (`git push origin feature/your-feature`)
7. Pull Request を作成する

## Pull Request のガイドライン

- PR のタイトルは変更内容を簡潔に説明してください
- 関連する Issue がある場合はリンクしてください
- 型エラーがないことを確認してください

## ローカル開発

### 前提条件

- [Deno](https://deno.land/) がインストールされていること

### セットアップ

1. リポジトリをクローンする
2. `.env` ファイルを設定する（[README](README.md) 参照）
3. 開発サーバーを起動する

```sh
deno task dev
```

### 型チェック

```sh
deno check main.ts
```
