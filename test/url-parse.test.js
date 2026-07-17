import test from "node:test";
import assert from "node:assert/strict";
import { extractFtpUrl, parseFtpUrl } from "../src/url-parse.js";

test("parse Jira-style FTP URL without password", () => {
  const parsed = parseFtpUrl(
    "ftp://ftpuser@10.83.3.36/2_DevicelockX/DLX-215",
  );
  assert.equal(parsed.host, "10.83.3.36");
  assert.equal(parsed.user, "ftpuser");
  assert.equal(parsed.password, undefined);
  assert.equal(parsed.remotePath, "/2_DevicelockX/DLX-215");
  assert.equal(parsed.port, 21);
});

test("parse URL with password", () => {
  const parsed = parseFtpUrl("ftp://ftpuser:p%40ss@10.83.3.36/logs/a");
  assert.equal(parsed.user, "ftpuser");
  assert.equal(parsed.password, "p@ss");
  assert.equal(parsed.remotePath, "/logs/a");
});

test("extract URL from description text", () => {
  const text =
    "please check ftp://ftpuser@10.83.3.36/2_DevicelockX/DLX-215 for logs.";
  assert.equal(
    extractFtpUrl(text),
    "ftp://ftpuser@10.83.3.36/2_DevicelockX/DLX-215",
  );
});
