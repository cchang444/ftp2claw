import fs from "node:fs";
import path from "node:path";
import { Client } from "basic-ftp";

export async function withClient(creds, fn) {
  const client = new Client(60_000);
  client.ftp.verbose = process.env.FTP_VERBOSE === "1";
  try {
    const secure =
      creds.secure === "implicit"
        ? "implicit"
        : Boolean(creds.secure);
    await client.access({
      host: creds.host,
      user: creds.user,
      password: creds.password,
      port: creds.port || 21,
      secure,
      // Lab FTPS cert is often self-signed.
      secureOptions: creds.tlsStrict
        ? undefined
        : { rejectUnauthorized: false },
    });
    return await fn(client);
  } finally {
    client.close();
  }
}

export async function ping(creds) {
  return withClient(creds, async (client) => {
    const pwd = await client.pwd();
    return { ok: true, pwd, host: creds.host, user: creds.user, port: creds.port };
  });
}

export async function listRemote(creds, remotePath = "/") {
  return withClient(creds, async (client) => {
    const list = await client.list(remotePath || "/");
    return list.map((item) => ({
      name: item.name,
      type: item.isDirectory ? "dir" : item.isSymbolicLink ? "link" : "file",
      size: item.size,
      modifiedAt: item.modifiedAt ? item.modifiedAt.toISOString() : undefined,
      rawModifiedAt: item.rawModifiedAt,
    }));
  });
}

/**
 * Download a remote file or directory.
 * Directories are downloaded recursively into localDir/<basename>.
 */
export async function download(creds, remotePath, localDir = process.cwd()) {
  const absLocalDir = path.resolve(localDir);
  fs.mkdirSync(absLocalDir, { recursive: true });

  return withClient(creds, async (client) => {
    const normalized = normalizeRemote(remotePath);
    const isDir = await remoteIsDirectory(client, normalized);

    if (isDir) {
      const base = path.basename(normalized) || "ftp-download";
      const target = path.join(absLocalDir, base);
      fs.mkdirSync(target, { recursive: true });
      await client.downloadToDir(target, normalized);
      return {
        type: "dir",
        remotePath: normalized,
        localPath: target,
      };
    }

    const fileName = path.posix.basename(normalized) || "download.bin";
    const target = path.join(absLocalDir, fileName);
    await client.downloadTo(target, normalized);
    return {
      type: "file",
      remotePath: normalized,
      localPath: target,
      size: fs.statSync(target).size,
    };
  });
}

function normalizeRemote(remotePath) {
  let p = String(remotePath || "/").trim();
  if (!p.startsWith("/")) p = `/${p}`;
  if (p.length > 1 && p.endsWith("/")) p = p.slice(0, -1);
  return p;
}

async function remoteIsDirectory(client, remotePath) {
  if (remotePath === "/") return true;
  try {
    const pwd = await client.pwd();
    await client.cd(remotePath);
    await client.cd(pwd);
    return true;
  } catch {
    return false;
  }
}
