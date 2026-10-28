// Cloudflare Turnstile, used ONLY when an anonymous visitor hits the
// per-visitor daily cap (abuse-shaped behaviour). Normal visitors never
// see it. Inert until TURNSTILE_SECRET_KEY is set on the server and
// NEXT_PUBLIC_TURNSTILE_SITE_KEY at build time (both free to create).

export function turnstileConfigured(): boolean {
  return Boolean(process.env.TURNSTILE_SECRET_KEY);
}

export async function verifyTurnstile(token: string, ip?: string): Promise<boolean> {
  const secretKey = process.env.TURNSTILE_SECRET_KEY;
  if (!secretKey || !token) return false;
  try {
    const form = new URLSearchParams({ secret: secretKey, response: token });
    if (ip && ip !== "local") form.set("remoteip", ip);
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form,
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}
