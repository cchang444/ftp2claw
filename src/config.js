import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const CONFIG_DIR = path.join(os.homedir(), ".config", "ftp2claw");
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");

export function getConfigPath() {
  return CONFIG_FILE;
}

export function loadConfig() {
  try {
    if (!fs.existsSync(CONFIG_FILE)) {
      return {};
    }
    const raw = fs.readFileSync(CONFIG_FILE, "utf8");
    const data = JSON.parse(raw);
    return data && typeof data === "object" ? data : {};
  } catch {
    return {};
  }
}

export function saveConfig(partial) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  const next = { ...loadConfig(), ...partial };
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(next, null, 2) + "\n", {
    encoding: "utf8",
    mode: 0o600,
  });
  try {
    fs.chmodSync(CONFIG_FILE, 0o600);
  } catch {
    // best effort on platforms that ignore chmod
  }
  return next;
}

/**
 * Resolve host/user/pass/port with priority:
 * URL fields > CLI flags > env > config file
 */
export function resolveCredentials({
  host,
  user,
  password,
  port,
  secure,
} = {}) {
  const cfg = loadConfig();
  const resolved = {
    host: firstNonEmpty(
      host,
      process.env.FTP_HOST,
      cfg.host,
      "10.83.3.36",
    ),
    user: firstNonEmpty(
      user,
      process.env.FTP_USER,
      cfg.user,
      "ftpuser",
    ),
    password: firstNonEmpty(
      password,
      process.env.FTP_PASS,
      process.env.FTP_PASSWORD,
      cfg.password,
    ),
    port: Number(
      firstNonEmpty(port, process.env.FTP_PORT, cfg.port, 21),
    ),
    // Lab server requires encryption ("Non-anonymous sessions must use encryption").
    secure: parseSecure(
      firstNonEmpty(secure, process.env.FTP_SECURE, cfg.secure, true),
    ),
    // Internal FTPS often uses a self-signed cert; set FTP_TLS_STRICT=1 to enforce CA check.
    tlsStrict: parseBool(
      firstNonEmpty(process.env.FTP_TLS_STRICT, cfg.tlsStrict, false),
    ),
  };

  if (!resolved.password) {
    const err = new Error(
      "FTP password missing. Run `f2c setup` or set FTP_PASS / write ~/.config/ftp2claw/config.json",
    );
    err.exitCode = 2;
    throw err;
  }

  return resolved;
}

function firstNonEmpty(...values) {
  for (const value of values) {
    if (value === undefined || value === null) continue;
    const text = String(value).trim();
    if (text !== "") return text;
  }
  return undefined;
}

function parseSecure(value) {
  if (typeof value === "boolean") return value;
  const text = String(value).trim().toLowerCase();
  if (text === "implicit") return "implicit";
  return text === "1" || text === "true" || text === "yes";
}

function parseBool(value) {
  if (typeof value === "boolean") return value;
  const text = String(value).trim().toLowerCase();
  return text === "1" || text === "true" || text === "yes";
}
