/**
 * Centralized feature detection. The platform is designed to run with zero
 * external credentials (everything degrades to a deterministic local mode),
 * and light up additional live capabilities as secrets are provided.
 */

export const env = {
  openaiKey: process.env.OPENAI_API_KEY?.trim() || "",
  openaiModel: process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini",
  anthropicKey: process.env.ANTHROPIC_API_KEY?.trim() || "",
  anthropicModel: process.env.ANTHROPIC_MODEL?.trim() || "claude-3-5-sonnet-latest",

  xApiKey: process.env.X_API_KEY?.trim() || "",
  xApiSecret: process.env.X_API_SECRET?.trim() || "",
  xAccessToken: process.env.X_ACCESS_TOKEN?.trim() || "",
  xAccessSecret: process.env.X_ACCESS_TOKEN_SECRET?.trim() || "",
  xBearer: process.env.X_BEARER_TOKEN?.trim() || "",

  pagespeedKey: process.env.PAGESPEED_API_KEY?.trim() || "",
  googleClientId: process.env.GOOGLE_CLIENT_ID?.trim() || "",
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET?.trim() || "",

  redditClientId: process.env.REDDIT_CLIENT_ID?.trim() || "",
  redditClientSecret: process.env.REDDIT_CLIENT_SECRET?.trim() || "",

  cronSecret: process.env.CRON_SECRET?.trim() || "dev-secret",
};

export const features = {
  get ai() {
    return Boolean(env.openaiKey || env.anthropicKey);
  },
  get aiProvider(): "openai" | "anthropic" | "local" {
    if (env.openaiKey) return "openai";
    if (env.anthropicKey) return "anthropic";
    return "local";
  },
  get xPosting() {
    return Boolean(env.xApiKey && env.xApiSecret && env.xAccessToken && env.xAccessSecret);
  },
  get pagespeed() {
    return true; // public endpoint works without a key
  },
  get googleOAuth() {
    return Boolean(env.googleClientId && env.googleClientSecret);
  },
};
