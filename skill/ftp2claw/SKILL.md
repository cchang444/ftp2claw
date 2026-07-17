---
name: ftp2claw
description: >-
  Download FTP logs from Jira issue descriptions using the f2c/ftp2claw CLI.
  Use when the user mentions FTP log, ftp:// links, ftpserver, issue attachments
  on the internal FTP, or asks to fetch device logs for DLX/Jira tickets.
---

# ftp2claw (f2c)

## When to use

- Jira description/comment contains `ftp://user@host/path`
- User asks to download FTP logs for an issue
- Nightly issue triage needs log files before analysis

## Prerequisites

If `f2c` is missing, follow the Chinese install steps in the package README:

`ftp/ftp2claw-cli/README.md` → section **AI Agent 自动安装指令**

Default package path:

```text
/data/workspace/docker/A67LGo/ftp/ftp2claw-cli
```

## Credentials

Never commit passwords. Resolve in this order:

1. Ask user / existing `FTP_PASS`
2. `f2c setup --host ... --user ... --password ...`
3. Then `f2c ping`

Default lab server (password still required from user/env):

- host: `10.83.3.36`
- user: `ftpuser`
- transport: explicit FTPS on port 21 (self-signed cert accepted by default)

Install with user prefix (avoid `/usr` EACCES):

```bash
npm install -g . --prefix "$HOME/.local"
export PATH="$HOME/.local/bin:$PATH"
```

## Typical workflow with j2c

```bash
# 1) Read issue markdown
j2c read <ISSUE_ID> -e md > /tmp/issue.md

# 2) Extract FTP URL
URL=$(f2c extract-url -f /tmp/issue.md)

# 3) Download directory/file
mkdir -p "./logs/<ISSUE_ID>"
f2c get-url "$URL" -o "./logs/<ISSUE_ID>"
```

Or one-liner when the description text is already known:

```bash
f2c get-url 'ftp://ftpuser@10.83.3.36/2_DevicelockX/DLX-215' -o ./logs/DLX-215
```

## Rules

- Prefer `get-url` for full `ftp://` links from Jira
- Prefer `get` / `ls` when only a remote path is known
- After download, report local path and summarize findings; do not auto-close Jira unless user asks
- If ping/download fails, report the error; do not invent log contents
