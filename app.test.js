const { app } = require("./app");
const { tokensMatch } = require("./middlewares/csrf");
const { encryptText, decryptText } = require("./models/chatModel");

describe("Starfleet Communications", () => {
  let listener;
  let baseUrl;

  beforeAll((done) => {
    listener = app.listen(0, "127.0.0.1", () => {
      const { port } = listener.address();
      baseUrl = `http://127.0.0.1:${port}`;
      done();
    });
  });

  afterAll((done) => {
    listener.close(done);
  });

  it("reports service health without exposing framework details", async () => {
    const response = await fetch(`${baseUrl}/health`);
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(response.headers.get("x-powered-by")).toBeNull();
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(body).toEqual({ status: "degraded", database: "disconnected" });
  });

  it("issues a CSRF token on the login form", async () => {
    const response = await fetch(`${baseUrl}/login`);
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("starfleet.sid");
    expect(body).toContain('name="_csrf"');
  });

  it("rejects form submissions without a valid CSRF token", async () => {
    const response = await fetch(`${baseUrl}/login`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: "username=test&password=test",
      redirect: "manual",
    });

    expect(response.status).toBe(403);
  });

  it("compares CSRF tokens safely", () => {
    expect(tokensMatch("abc123", "abc123")).toBe(true);
    expect(tokensMatch("abc123", "abc124")).toBe(false);
    expect(tokensMatch("abc123", "short")).toBe(false);
    expect(tokensMatch(undefined, "abc123")).toBe(false);
  });

  it("encrypts chat messages before storage and decrypts them on read", () => {
    const plaintext = "Captain's log: all systems nominal.";
    const encrypted = encryptText(plaintext);

    expect(encrypted).not.toBe(plaintext);
    expect(encrypted).not.toContain(plaintext);
    expect(decryptText(encrypted)).toBe(plaintext);
  });
});
