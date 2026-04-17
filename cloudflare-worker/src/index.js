const API_PATH = "/api/clockin-sync";

function jsonResponse(payload, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...extraHeaders,
    },
  });
}

function getCorsHeaders(origin = "*") {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET,PUT,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Max-Age": "86400",
  };
}

function parseBearerToken(authHeader) {
  if (!authHeader || typeof authHeader !== "string") return "";
  const prefix = "Bearer ";
  if (!authHeader.startsWith(prefix)) return "";
  return authHeader.slice(prefix.length).trim();
}

function resolveDatasetId(url, body) {
  const fromQuery = url.searchParams.get("datasetId");
  const fromBody = body && typeof body === "object" ? body.datasetId : "";
  return (fromQuery || fromBody || "default").trim() || "default";
}

function isSnapshotShapeValid(snapshot) {
  return (
    snapshot &&
    typeof snapshot === "object" &&
    typeof snapshot.updatedAt === "string" &&
    typeof snapshot.data === "object" &&
    snapshot.data !== null
  );
}

function normalizeSnapshot(input) {
  return {
    updatedAt: typeof input.updatedAt === "string" && input.updatedAt ? input.updatedAt : new Date().toISOString(),
    clientId: typeof input.clientId === "string" ? input.clientId : "",
    data: input.data,
  };
}

async function ensureAuthorized(request, env) {
  if (!env.AUTH_TOKEN) {
    return true;
  }

  const provided = parseBearerToken(request.headers.get("Authorization"));
  return provided && provided === env.AUTH_TOKEN;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const corsHeaders = getCorsHeaders("*");

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (url.pathname !== API_PATH) {
      return jsonResponse({ error: "Not Found" }, 404, corsHeaders);
    }

    if (!(await ensureAuthorized(request, env))) {
      return jsonResponse({ error: "Unauthorized" }, 401, corsHeaders);
    }

    if (request.method === "GET") {
      const datasetId = resolveDatasetId(url, null);
      const key = `dataset:${datasetId}`;
      const raw = await env.SYNC_KV.get(key);

      if (!raw) {
        return jsonResponse({ status: "empty", datasetId }, 200, corsHeaders);
      }

      try {
        const snapshot = JSON.parse(raw);
        return jsonResponse(snapshot, 200, corsHeaders);
      } catch {
        return jsonResponse({ error: "Corrupted snapshot" }, 500, corsHeaders);
      }
    }

    if (request.method === "PUT") {
      let body;
      try {
        body = await request.json();
      } catch {
        return jsonResponse({ error: "Invalid JSON body" }, 400, corsHeaders);
      }

      if (!isSnapshotShapeValid(body)) {
        return jsonResponse(
          { error: "Body must include updatedAt (string) and data (object)" },
          400,
          corsHeaders,
        );
      }

      const datasetId = resolveDatasetId(url, body);
      const key = `dataset:${datasetId}`;
      const incoming = normalizeSnapshot(body);

      const currentRaw = await env.SYNC_KV.get(key);
      if (currentRaw) {
        try {
          const current = JSON.parse(currentRaw);
          const currentTime = Date.parse(current.updatedAt || "") || 0;
          const incomingTime = Date.parse(incoming.updatedAt || "") || 0;

          if (currentTime > incomingTime) {
            return jsonResponse(
              {
                ...current,
                datasetId,
                serverStatus: "ignored_older_snapshot",
              },
              200,
              corsHeaders,
            );
          }
        } catch {
          // If old content is not parseable, overwrite with incoming snapshot.
        }
      }

      await env.SYNC_KV.put(key, JSON.stringify(incoming));
      return jsonResponse(
        {
          ...incoming,
          datasetId,
          serverStatus: "stored",
        },
        200,
        corsHeaders,
      );
    }

    return jsonResponse({ error: "Method Not Allowed" }, 405, corsHeaders);
  },
};
