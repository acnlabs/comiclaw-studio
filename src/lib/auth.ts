export function checkApiKey(req: Request): boolean {
  const header = req.headers.get("authorization") ?? "";
  const key = header.replace(/^Bearer\s+/i, "").trim();
  const expected = process.env.STUDIO_API_KEY;
  return Boolean(expected) && key === expected;
}

export function unauthorized() {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}

export function badRequest(message: string) {
  return Response.json({ error: message }, { status: 400 });
}

export function notFoundJson(message = "Not found") {
  return Response.json({ error: message }, { status: 404 });
}
