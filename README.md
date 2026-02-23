# discord-toukatsu-dev

東葛.dev Discord サーバー向けの通知 Bot です。

## 機能

- **フォーラム募集通知** - アクティブなフォーラム投稿の一覧を定期通知
- **Spotify 新曲通知** - 共有プレイリストへの新曲追加を検知して通知
- **話題提供** - ランダムな話題をチャンネルに投稿（直前が Bot
  の投稿ならスキップ）

## 技術スタック

- [Deno](https://deno.land/)
- [Deno Deploy Classic](https://docs.deno.com/deploy/classic/)
  - Deno Cronが未対応であるためClassicを利用
- [discord.js](https://discord.js.org/) (REST API)
- Deno Cron / Deno KV

## セットアップ

### 1. 環境変数

`.env` ファイルをプロジェクトルートに作成し、以下を設定してください。

```
DISCORD_BOT_TOKEN=
GUILD_ID=
FORUM_CHANNEL_ID=
MESSAGE_TARGET_CHANNEL_ID=
TOPIC_CHANNEL_ID=
TOUKATSU_DEV_DISCORD_BOT_CLIENT_ID=
SPOTIFY_CLIENT_ID=
SPOTIFY_CLIENT_SECRET=
```

### 2. 実行

```sh
deno task dev
```

## コントリビューション

コントリビューションを歓迎します！詳細は [CONTRIBUTING.md](CONTRIBUTING.md)
を参照してください。

## ライセンス

[MIT](LICENSE)
