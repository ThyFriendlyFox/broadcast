import { env, features } from "../env";

export interface PostResult {
  ok: boolean;
  simulated: boolean;
  id?: string;
  url?: string;
  error?: string;
}

/**
 * Publish a tweet. Uses the real X API v2 when OAuth1.0a user credentials are
 * present; otherwise records a simulated post so the rest of the platform
 * (drafts, scheduling, feed) works end to end without credentials.
 */
export async function postTweet(text: string): Promise<PostResult> {
  if (!features.xPosting) {
    const fakeId = `sim_${Date.now()}`;
    return {
      ok: true,
      simulated: true,
      id: fakeId,
      url: `https://x.com/i/web/status/${fakeId}`,
    };
  }

  try {
    // Lazy import keeps the heavy dependency out of the default bundle.
    const { TwitterApi } = await import("twitter-api-v2");
    const client = new TwitterApi({
      appKey: env.xApiKey,
      appSecret: env.xApiSecret,
      accessToken: env.xAccessToken,
      accessSecret: env.xAccessSecret,
    });
    const res = await client.v2.tweet(text);
    const id = res.data.id;
    return {
      ok: true,
      simulated: false,
      id,
      url: `https://x.com/i/web/status/${id}`,
    };
  } catch (err) {
    return { ok: false, simulated: false, error: (err as Error).message };
  }
}

export interface XAccount {
  ok: boolean;
  simulated: boolean;
  username?: string;
  name?: string;
  followers?: number;
  error?: string;
}

/** Verify and describe the connected X account (or a simulated one). */
export async function getXAccount(): Promise<XAccount> {
  if (!features.xPosting) {
    return { ok: true, simulated: true, username: "your_brand", name: "Your Brand", followers: 0 };
  }
  try {
    const { TwitterApi } = await import("twitter-api-v2");
    const client = new TwitterApi({
      appKey: env.xApiKey,
      appSecret: env.xApiSecret,
      accessToken: env.xAccessToken,
      accessSecret: env.xAccessSecret,
    });
    const me = await client.v2.me({ "user.fields": ["public_metrics", "name", "username"] });
    return {
      ok: true,
      simulated: false,
      username: me.data.username,
      name: me.data.name,
      followers: me.data.public_metrics?.followers_count ?? 0,
    };
  } catch (err) {
    return { ok: false, simulated: false, error: (err as Error).message };
  }
}
