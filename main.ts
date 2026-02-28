import { notifyActiveForumPosts } from "./notifyForumPosts.ts";
import { notifyNewMusics } from "./notifyNewMusic.ts";
import { notifyTopic } from "./notifyTopic.ts";

/**
 * フォーラムのアクティブな投稿を特定チャンネルに通知する周期の定義
 * 毎朝9時00分 JST, 月・木曜日
 */
Deno.cron(
  "Active Forum Posts Daily Notification",
  "0 0 * * 1,4",
  async () => {
    console.log("--- Deno Cron 実行開始 (JST 9:00) ---");
    await notifyActiveForumPosts();
    console.log("--- Deno Cron 実行終了 ---");
  },
);

/**
 * Spotifyで追加された新しい音楽を特定チャンネルに通知する周期の定義
 * 毎日10時00分 JST
 */
Deno.cron(
  "Spotify Add New Music Notification",
  "0 1 * * *",
  async () => {
    console.log("--- Deno Cron 実行開始 (JST 10:00) ---");
    await notifyNewMusics();
    console.log("--- Deno Cron 実行終了 ---");
  },
);

/**
 * ランダムで話題を特定チャンネルに投稿する周期の定義
 * 毎週月曜日の19時00分 JST
 */
Deno.cron(
  "Random Topic Notification",
  "0 10 * * 2",
  async () => {
    console.log("--- Deno Cron 実行開始 (話題提供) ---");
    await notifyTopic();
    console.log("--- Deno Cron 実行終了 ---");
  },
);

/**
 * ランダムで話題を英語で特定チャンネルに投稿する周期の定義
 * 毎週木曜日の19時00分 JST
 */
Deno.cron(
  "Random English Topic Notification",
  "0 10 * * 5",
  async () => {
    console.log("--- Deno Cron 実行開始 (英語の話題提供) ---");
    await notifyTopic(true);
    console.log("--- Deno Cron 実行終了 ---");
  },
);

Deno.serve(() => new Response("NOT FOUND", { status: 404 }));
