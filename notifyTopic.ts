import { APIEmbed, type APIMessage, Routes } from "discord.js";
import { initRestClient, sendDiscordNotification } from "./notifyDiscord.ts";

// --- 設定値 ---
const TOPIC_CHANNEL_ID = Deno.env.get("TOPIC_CHANNEL_ID") ||
  "YOUR_TOPIC_CHANNEL_ID";

const ENGLISH_TOPIC_CHANNEL_ID = Deno.env.get("ENGLISH_TOPIC_CHANNEL_ID") ||
  "YOUR_ENGLISH_TOPIC_CHANNEL_ID";

// 言語が増えるようであれば連想配列等、持ち方を考える
// keyを言語にして、チャンネル、話題のセットを持つイメージ？話題の日英をペアで持つほうがいいかも

// 話題のパターン（ここに話題を追加してください）
const TOPICS: string[] = [
  "一番最近行った外食はどんなお店でしたか？（チェーン店でもOKです！）",
  "最近見た技術記事、newsでオススメのリンクを貼ってください！",
  "エンジニアリング以外で続けている趣味や好きなことを教えて下さい！",
  "エディタやIDEのこだわりポイントを教えてください！",
  "行ってみたい場所、旅行先を教えてください！",
  "地元のおすすめスポットを教えてください！",
  "せっかく<地名>に来たなら<店名>の<メニュー名>を食べていき！！",
  "感謝を伝えたい人がいたら、ここで伝えてみましょう！",
  "最近「これやってみたいな」と思うエンジニアリング関連のことはありますか？",
  "エンジニアリング以外で、最近興味がある、または始めてみた趣味などはありますか？",
  "普段の作業環境で気に入っているところや、こだわっているところを教えてください！",
  "最近買ってよかったものを教えて下さい！",
  "最近見つけたほっこりニュースを共有してください！",
  "昔住んでいた場所の思い出を一つ教えてください！",
];

// 英語版の話題のパターン
const TOPICS_EN: string[] = [
  "What kind of restaurant did you visit most recently? (Chain restaurants are welcome too!)",
  "Share a link to a tech article or news you recently found interesting!",
  "Tell us about a hobby or something you enjoy outside of engineering!",
  "What are your favorite features or quirks of your editor or IDE?",
  "Tell us about a place or travel destination you'd like to visit!",
  "Share your recommended spots from your hometown!",
  "Since you're in <place>, you have to try <menu item> at <restaurant>!!",
  "If there's someone you'd like to thank, share it here!",
  "Is there anything engineering-related you've been wanting to try lately?",
  "Is there a hobby outside of engineering that you've recently become interested in or started?",
  "Tell us what you like or take pride in about your daily work setup!",
  "Share something you've bought recently that you're really glad you got!",
  "Share a heartwarming news story you've come across recently!",
  "Share one fond memory from a place you used to live!",
];

/**
 * ランダムで話題を特定チャンネルに投稿する。
 * 直前の投稿がbotの場合は投稿をスキップする。
 */
export async function notifyTopic(english: boolean = false): Promise<void> {
  const topics = english ? TOPICS_EN : TOPICS;
  const channelId = english ? ENGLISH_TOPIC_CHANNEL_ID : TOPIC_CHANNEL_ID;
  if (topics.length === 0) {
    console.log("話題が登録されていません。TOPICSに話題を追加してください。");
    return;
  }

  const rest = initRestClient();

  try {
    // 直前のメッセージを取得して、botの投稿かどうか確認する
    const messages = await rest.get(
      Routes.channelMessages(channelId),
      { query: new URLSearchParams({ limit: "1" }) },
    ) as APIMessage[];

    if (messages.length > 0 && messages[0].author.bot) {
      console.log("直前の投稿がbotのため、話題の提供をスキップします。");
      return;
    }

    const kv = await Deno.openKv();
    const key = english ? ["topics", "used_en"] : ["topics", "used"];
    const stored = await kv.get<string[]>(key);
    const usedTopics = (stored.value?.length ?? 0) >= topics.length
      ? []
      : (stored.value ?? []);

    const { topic, updatedUsed } = choiceTopic(topics, usedTopics);
    await kv.set(key, updatedUsed);

    const title = english ? "💬 Today's Topic" : "💬 今日の話題";

    const embed: APIEmbed = {
      title: title,
      description: topic,
      color: 0x57F287,
      timestamp: new Date().toISOString(),
    };

    await sendDiscordNotification(rest, channelId, embed);
  } catch (error) {
    console.error("❌ 話題の投稿中にエラーが発生しました:", error);
  }
}

/**
 * 話題をランダムに選択する（純粋関数）
 * 重複を避けるため、使用済み話題を受け取り、次の状態を返す。
 * @param topics 話題の配列
 * @param usedTopics 使用済み話題の配列
 * @returns 選択された話題と更新後の使用済み話題
 */
function choiceTopic(
  topics: string[],
  usedTopics: string[],
): { topic: string; updatedUsed: string[] } {
  const remaining = topics.filter((t) => !usedTopics.includes(t));
  const topic = remaining[Math.floor(Math.random() * remaining.length)];
  return { topic, updatedUsed: [...usedTopics, topic] };
}
