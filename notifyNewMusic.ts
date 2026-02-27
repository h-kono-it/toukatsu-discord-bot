/**
 * @file Spotifyプレイリストの変更を検知し、Discordに通知するモジュール。
 * Denoの組み込みfetch()とDeno KVを使用する。
 */

import { APIEmbed } from "discord.js";
import { initRestClient, sendDiscordNotification } from "./notifyDiscord.ts";
const MESSAGE_TARGET_CHANNEL_ID = Deno.env.get("MESSAGE_TARGET_CHANNEL_ID") ||
  "YOUR_TARGET_CHANNEL_ID"; // 通知先のチャンネルID

// 🔑 環境変数から認証情報を取得
const CLIENT_ID = Deno.env.get("SPOTIFY_CLIENT_ID")!;
const CLIENT_SECRET = Deno.env.get("SPOTIFY_CLIENT_SECRET")!;

const DETAIL_LINK =
  "https://scrapbox.io/toukatsu-dev/%E3%81%BF%E3%82%93%E3%81%AA%E3%81%A7%E9%9F%B3%E6%A5%BD%E3%83%97%E3%83%AC%E3%82%A4%E3%83%AA%E3%82%B9%E3%83%88%E3%82%92%E4%BD%9C%E3%82%8D%E3%81%86%E3%81%AE%E4%BC%9A";

// 🎧 チェック対象のプレイリストID
const PLAYLIST_ID = "78PN9O8cF563eazR5lT4tu"; // 例: Spotifyの公開プレイリストID

/** Deno KVのスナップショットIDキー */
const KV_KEY_SNAPSHOT = ["spotify", PLAYLIST_ID, "snapshot_id"];
/** Deno KVのトラックIDリストキー */
const KV_KEY_TRACKS = ["spotify", PLAYLIST_ID, "track_ids"];

/** 通知で表示するトラック数の上限 */
const MAX_DISPLAY = 10;

interface SpotifyTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface SpotifyTrack {
  id: string;
  name: string;
  artists: { name: string }[];
  album: { name: string };
}

interface SpotifyPlaylistItem {
  track: { id: string } | null;
}

interface SpotifyPlaylistMetaData {
  snapshot_id: string;
  tracks: { total: number };
}

interface SpotifyPlaylistTracksData {
  items: SpotifyPlaylistItem[];
}

/**
 * Spotifyのアクセストークンを取得する。
 * 公開プレイリストへのアクセスにはClient Credentials Flowを使用する。
 * @returns アクセストークン文字列
 * @throws アクセストークンの取得に失敗した場合
 */
async function getAccessToken(): Promise<string> {
  const authHeader = btoa(`${CLIENT_ID}:${CLIENT_SECRET}`);

  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Authorization": `Basic ${authHeader}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!response.ok) {
    const errorBody = await response.text();
    let errorMessage =
      `HTTP Status: ${response.status} (${response.statusText})`;
    try {
      const errorJson = JSON.parse(errorBody);
      errorMessage += `\nSpotify Error: ${
        errorJson.error_description || errorJson.error
      }`;
    } catch {
      errorMessage += `\nRaw Body: ${errorBody}`;
    }
    throw new Error(`Failed to get access token: ${errorMessage}`);
  }

  const data = await response.json() as SpotifyTokenResponse;
  return data.access_token;
}

/**
 * Spotify APIからプレイリストのメタデータとトラックIDリストを取得する。
 * @param accessToken Spotifyのアクセストークン
 * @param playlistId 取得対象のプレイリストID
 * @returns スナップショットIDとトラックIDの配列
 * @throws APIリクエストに失敗した場合
 */
async function fetchPlaylistData(
  accessToken: string,
  playlistId: string,
): Promise<{ snapshotId: string; trackIds: string[] }> {
  // 1. メタデータ (snapshot_id) の取得
  const metaRes = await fetch(
    `https://api.spotify.com/v1/playlists/${playlistId}?fields=snapshot_id,tracks.total`,
    {
      headers: { "Authorization": `Bearer ${accessToken}` },
    },
  );
  if (!metaRes.ok) {
    throw new Error(`Failed to fetch playlist meta: ${metaRes.statusText}`);
  }
  const metaData = await metaRes.json() as SpotifyPlaylistMetaData;
  const snapshotId = metaData.snapshot_id;

  // トラックリストの取得 (ページネーションは省略、上限100件)
  const tracksRes = await fetch(
    `https://api.spotify.com/v1/playlists/${playlistId}/items?fields=items(track(id))&limit=100`,
    {
      headers: { "Authorization": `Bearer ${accessToken}` },
    },
  );
  if (!tracksRes.ok) {
    throw new Error(`Failed to fetch playlist tracks: ${tracksRes.statusText}`);
  }
  const tracksData = await tracksRes.json() as SpotifyPlaylistTracksData;

  const trackIds = tracksData.items
    .map((item) => item.track?.id)
    .filter((id): id is string => !!id); // IDがないもの（エピソードなど）を除外

  return { snapshotId, trackIds };
}

/**
 * 最新のトラックIDリストと保存済みIDセットを比較し、新規追加分を返す。
 * @param latestTrackIds 最新のトラックIDの配列
 * @param lastTrackIds 前回保存済みのトラックIDのセット
 * @returns 新たに追加されたトラックIDの配列
 */
function findAddedTrackIds(
  latestTrackIds: string[],
  lastTrackIds: Set<string>,
): string[] {
  return latestTrackIds.filter((id) => !lastTrackIds.has(id));
}

/**
 * 指定されたトラックIDの詳細情報をSpotify APIから取得する（最大{@link MAX_DISPLAY}件）。
 * @param accessToken Spotifyのアクセストークン
 * @param trackIds 詳細情報を取得するトラックIDの配列
 * @returns 取得成功したトラック情報の配列
 */
async function fetchTrackDetails(
  accessToken: string,
  trackIds: string[],
): Promise<SpotifyTrack[]> {
  const targetIds = trackIds.slice(0, MAX_DISPLAY);
  console.log("ℹ️ 追加された曲の詳細情報を取得中...");

  const results = await Promise.all(
    targetIds.map(async (id) => {
      const res = await fetch(`https://api.spotify.com/v1/tracks/${id}`, {
        headers: { "Authorization": `Bearer ${accessToken}` },
      });
      if (!res.ok) {
        const errorBody = await res.text();
        let errorMessage = `HTTP Status: ${res.status} (${res.statusText})`;
        try {
          const errorJson = JSON.parse(errorBody);
          errorMessage +=
            `\nSpotify Error Detail: ${errorJson.error.message} (Status: ${errorJson.error.status})`;
        } catch {
          errorMessage += `\nRaw Body: ${errorBody}`;
        }
        console.error(
          `❌ トラック ${id} の詳細情報の取得に失敗:`,
          errorMessage,
        );
        return null;
      }
      return await res.json() as SpotifyTrack;
    }),
  );

  return results.filter((t): t is SpotifyTrack => t !== null);
}

/**
 * 新曲追加通知用のDiscord Embedオブジェクトを生成する。
 * @param tracks 通知に含めるトラック情報の配列
 * @param totalAddedCount 実際に追加されたトラックの総数（表示上限超過分も含む）
 * @returns Discord APIに送信するEmbedオブジェクト
 */
function buildNotificationEmbed(
  tracks: SpotifyTrack[],
  totalAddedCount: number,
): APIEmbed {
  const fields = tracks.map((track) => {
    const artists = track.artists.map((a) => a.name).join(" & ");
    console.log(`  曲名: ${track.name} / アーティスト: ${artists}`);
    return {
      name: `🎧️ ${track.name}`,
      value: `🎤アーティスト名: ${artists}　💿️アルバム: ${track.album.name}`,
      inline: false,
    };
  });

  return {
    title: `📢 「東葛.devのお気に入り」新曲追加通知`,
    description:
      `新曲が${totalAddedCount}曲追加されました！ぜひ聞いてみてください。`,
    color: 0x5865F2, // Discordカラー (Blurple)
    fields,
    timestamp: new Date().toISOString(),
    footer: { text: DETAIL_LINK },
  };
}

/**
 * 追加されたトラックの詳細を取得し、Discordチャンネルに通知する。
 * @param accessToken Spotifyのアクセストークン
 * @param addedTrackIds 新規追加されたトラックIDの配列
 */
async function notifyAddedTracks(
  accessToken: string,
  addedTrackIds: string[],
): Promise<void> {
  const tracks = await fetchTrackDetails(accessToken, addedTrackIds);
  if (tracks.length === 0) {
    console.error("❌ トラック詳細情報の取得に全件失敗しました。");
    return;
  }

  console.log("--- 新しく追加された曲 ---");
  const embed = buildNotificationEmbed(tracks, addedTrackIds.length);
  console.log("-------------------------\n");

  const rest = initRestClient();
  await sendDiscordNotification(rest, MESSAGE_TARGET_CHANNEL_ID, embed);
}

/**
 * Deno KVにプレイリストの最新スナップショットIDとトラックIDを保存する。
 * @param kv Deno KVインスタンス
 * @param snapshotId 保存するスナップショットID
 * @param trackIds 保存するトラックIDの配列
 */
async function updateKvSnapshot(
  kv: Deno.Kv,
  snapshotId: string,
  trackIds: string[],
): Promise<void> {
  const result = await kv.atomic()
    .set(KV_KEY_SNAPSHOT, snapshotId)
    .set(KV_KEY_TRACKS, trackIds)
    .commit();

  if (result.ok) {
    console.log("✅ Deno KVに最新のプレイリスト情報を保存しました。");
  } else {
    console.error("❌ Deno KVの更新に失敗しました。");
  }
}

/**
 * Spotifyプレイリストの変更を検知し、新規追加曲をDiscordに通知するメイン処理。
 * スナップショットIDをDeno KVで管理し、変更があった場合のみ通知する。
 */
export async function notifyNewMusics() {
  const kv = await Deno.openKv();
  console.log("--- Spotify プレイリスト変更チェックを開始 ---");

  let accessToken: string;
  try {
    accessToken = await getAccessToken();
    console.log("✅ アクセストークン取得成功");
  } catch (e) {
    console.error(e);
    kv.close();
    return;
  }

  const snapshotResult = await kv.get<string>(KV_KEY_SNAPSHOT);
  const lastSnapshotId = snapshotResult.value;

  let latestData;
  try {
    latestData = await fetchPlaylistData(accessToken, PLAYLIST_ID);
  } catch (e) {
    console.error("❌ プレイリストデータの取得に失敗:", e);
    kv.close();
    return;
  }

  if (latestData.snapshotId === lastSnapshotId) {
    console.log(
      "ℹ️ スナップショットIDが一致しました。プレイリストに変更はありません。",
    );
    kv.close();
    return;
  }

  console.log(
    `⚠️ プレイリストの変更を検出! (旧ID: ${
      lastSnapshotId || "なし"
    }, 新ID: ${latestData.snapshotId})`,
  );

  const tracksResult = await kv.get<string[]>(KV_KEY_TRACKS);
  const lastTrackIds = new Set(tracksResult.value || []);
  const addedTrackIds = findAddedTrackIds(latestData.trackIds, lastTrackIds);

  if (addedTrackIds.length > 0) {
    console.log(`🎉 新しく ${addedTrackIds.length} 曲が追加されました!`);
    await notifyAddedTracks(accessToken, addedTrackIds);
  } else {
    console.log(
      "ℹ️ 追加された曲はありませんでした。（並び替えや削除があった可能性があります）",
    );
  }

  await updateKvSnapshot(kv, latestData.snapshotId, latestData.trackIds);
  kv.close();
  console.log("--- 処理を終了 ---");
}

// Denoの実行コマンドの例:
// deno run --allow-net --allow-env --allow-sys notifyNewMusic.ts
