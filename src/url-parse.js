/**
 * Parse FTP URLs commonly found in Jira descriptions, e.g.
 *   ftp://ftpuser@10.83.3.36/2_DevicelockX/DLX-215
 *   ftp://ftpuser:secret@10.83.3.36/path/to/log
 *   ftp://10.83.3.36/path
 */
export function parseFtpUrl(input) {
  const raw = String(input || "").trim();
  if (!raw) {
    throw new Error("FTP URL is empty");
  }

  // Allow bare paths that are not full URLs — reject them here.
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`Invalid FTP URL: ${raw}`);
  }

  if (url.protocol !== "ftp:" && url.protocol !== "ftps:") {
    throw new Error(`Unsupported protocol "${url.protocol}" (expect ftp: or ftps:)`);
  }

  const host = url.hostname;
  if (!host) {
    throw new Error(`FTP URL missing host: ${raw}`);
  }

  const user = url.username ? decodeURIComponent(url.username) : undefined;
  const password = url.password ? decodeURIComponent(url.password) : undefined;
  const port = url.port ? Number(url.port) : url.protocol === "ftps:" ? 990 : 21;

  // URL.pathname keeps leading "/"; keep it for FTP absolute paths.
  let remotePath = decodeURIComponent(url.pathname || "/");
  if (!remotePath.startsWith("/")) {
    remotePath = `/${remotePath}`;
  }
  // Trim trailing slash except root
  if (remotePath.length > 1 && remotePath.endsWith("/")) {
    remotePath = remotePath.slice(0, -1);
  }

  return {
    host,
    user,
    password,
    port,
    secure: url.protocol === "ftps:",
    remotePath,
    href: raw,
  };
}

/**
 * Extract first ftp(s):// URL from free text (issue description / comment).
 */
export function extractFtpUrl(text) {
  const match = String(text || "").match(/ftps?:\/\/[^\s<>"'`]+/i);
  if (!match) return undefined;
  // Strip trailing punctuation often left by markdown
  return match[0].replace(/[),.;]+$/g, "");
}
