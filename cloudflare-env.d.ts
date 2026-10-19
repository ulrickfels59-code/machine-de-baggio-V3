declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    ADMIN_SETUP_KEY?: string;
    BUCKET?: R2Bucket;
  }
}
