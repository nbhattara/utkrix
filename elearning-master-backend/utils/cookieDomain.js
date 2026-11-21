// Resolves the Domain attribute for auth cookies.
//
// COOKIE_DOMAIN env wins when set (production). Otherwise we infer a
// shareable parent domain from the request's Origin/Referer so local
// wildcard dev hosts work: *.lvh.me resolves to 127.0.0.1 and, unlike
// *.localhost (a public suffix), accepts Domain=.lvh.me cookies that are
// shared across subdomains. Plain localhost needs no Domain attribute
// because cookies already ignore ports.
const resolveCookieDomain = (req) => {
  if (process.env.COOKIE_DOMAIN) return process.env.COOKIE_DOMAIN;

  const source = req?.headers?.origin || req?.headers?.referer || '';
  try {
    const host = new URL(source).hostname;
    if (host.endsWith('.lvh.me')) return '.lvh.me';
  } catch {
    // Malformed or missing Origin/Referer — fall through to host-only.
  }
  return undefined;
};

module.exports = { resolveCookieDomain };
