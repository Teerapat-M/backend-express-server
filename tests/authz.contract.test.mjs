import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import app from "../app.mjs";

let server;
let baseUrl;

before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

async function send(method, path, { body, token } = {}) {
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = text;
  }
  return { status: response.status, body: parsed };
}

describe("auth contract", () => {
  it("POST /auth/login requires email and password", async () => {
    const res = await send("POST", "/auth/login", { body: {} });
    assert.equal(res.status, 400);
    assert.equal(res.body.accessToken, undefined);
  });

  it("GET /auth/get-user without token is 401", async () => {
    const res = await send("GET", "/auth/get-user");
    assert.equal(res.status, 401);
  });

  it("PUT /auth/update-profile without token is 401", async () => {
    const res = await send("PUT", "/auth/update-profile", {
      body: { name: "Ada" },
    });
    assert.equal(res.status, 401);
  });
});

describe("admin and user guards", () => {
  it("POST /categories without token is 401", async () => {
    const res = await send("POST", "/categories", { body: { name: "Cat" } });
    assert.equal(res.status, 401);
  });

  it("PUT /categories/:id without token is 401", async () => {
    const res = await send("PUT", "/categories/1", { body: { name: "Cat" } });
    assert.equal(res.status, 401);
  });

  it("DELETE /categories/:id without token is 401", async () => {
    const res = await send("DELETE", "/categories/1");
    assert.equal(res.status, 401);
  });

  it("POST /posts/:id/comments without token is 401", async () => {
    const res = await send("POST", "/posts/1/comments", {
      body: { comment: "Hi" },
    });
    assert.equal(res.status, 401);
  });

  it("POST /posts/:id/likes without token is 401", async () => {
    const res = await send("POST", "/posts/1/likes");
    assert.equal(res.status, 401);
  });

  it("DELETE /posts/:id/likes without token is 401", async () => {
    const res = await send("DELETE", "/posts/1/likes");
    assert.equal(res.status, 401);
  });
});
