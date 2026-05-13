/**
 * Cloudflare Worker — License key verification for Minimally apps
 *
 * Verify license keys against Lemon Squeezy API.
 * Deploy via: `npm run deploy` or wrangler CLI
 *
 * Environment variables (set in Cloudflare dashboard):
 *   LEMON_SQUEEZY_API_KEY — your LS API key (found in LS Settings > API)
 */

export default {
  async fetch(request) {
    // Only accept POST
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Parse body
    let body;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { licenseKey } = body;
    if (!licenseKey || typeof licenseKey !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing licenseKey' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Check cache first (for offline repeat verifications)
    const cacheKey = `license:${licenseKey}`;
    const cached = await LICENSE_CACHE.get(cacheKey);
    if (cached) {
      const result = JSON.parse(cached);
      return new Response(JSON.stringify(result), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Validate against Lemon Squeezy
    const lsResponse = await fetch('https://api.lemonsqueezy.com/v1/licenses/validate', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ license_key: licenseKey }),
    });

    const lsData = await lsResponse.json();

    if (lsData.valid && lsData.license_key?.status === 'active') {
      const result = { valid: true };

      // Cache for 7 days (so PWA works offline)
      await LICENSE_CACHE.put(cacheKey, JSON.stringify(result), {
        expirationTtl: 604800, // 7 days
      });

      return new Response(JSON.stringify(result), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ valid: false }), {
      headers: { 'Content-Type': 'application/json' },
    });
  },
};