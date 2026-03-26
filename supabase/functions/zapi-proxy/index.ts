const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ProxyRequest {
  instanceId: string;
  token: string;
  clientToken?: string;
  path: string;          // e.g. "status", "send-text", "messages"
  method?: string;       // GET | POST
  body?: unknown;
  queryParams?: Record<string, string>;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const payload = (await req.json()) as ProxyRequest;
    const { instanceId, token, clientToken, path, method = "GET", body, queryParams } = payload;

    if (!instanceId || !token || !path) {
      return json({ error: "Parâmetros obrigatórios: instanceId, token, path" }, 400);
    }

    // Build Z-API URL
    let url = `https://api.z-api.io/instances/${instanceId}/token/${token}/${path}`;
    if (queryParams && Object.keys(queryParams).length > 0) {
      url += "?" + new URLSearchParams(queryParams).toString();
    }

    // Build headers — only include Client-Token if it differs from instance token
    const zapiHeaders: Record<string, string> = { "Content-Type": "application/json" };
    const ct = clientToken?.trim();
    if (ct && ct !== token.trim()) zapiHeaders["Client-Token"] = ct;

    // Call Z-API
    const zapiRes = await fetch(url, {
      method,
      headers: zapiHeaders,
      body: method !== "GET" && body ? JSON.stringify(body) : undefined,
    });

    const text = await zapiRes.text();
    let data: unknown;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }

    return json({ ok: zapiRes.ok, status: zapiRes.status, data }, 200);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return json({ error: msg }, 500);
  }
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
