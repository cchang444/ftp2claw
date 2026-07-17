# ftp2claw-cli（f2c）

从 Jira Issue 描述里的 `ftp://` 链接下载 log 的 Node CLI。命令别名：`ftp2claw` / `f2c`。

典型链接：

```text
ftp://ftpuser@10.83.3.36/2_DevicelockX/DLX-215
```

> 密码**不会**写进仓库。请用 `f2c setup` 或环境变量配置。

---

## AI Agent 自动安装指令（请原样执行）

当用户要求「安装 ftp2claw / f2c / FTP CLI」时，Agent **必须按顺序执行**下面步骤，不要跳过验证。

### 前置条件

- Node.js >= 18（`node -v`）
- npm 可用（`npm -v`）
- 本机可访问内网 FTP（默认 `10.83.3.36:21`）

### 步骤 1：定位包目录

优先使用用户给出的路径。若用户未指定，在工作区搜索：

```bash
find /data/workspace -maxdepth 5 -type d -name 'ftp2claw-cli' 2>/dev/null | head -5
```

本仓库默认路径：

```text
/data/workspace/docker/A67LGo/ftp/ftp2claw-cli
```

记为 `PKG_DIR`。

### 步骤 2：全局安装（用户目录，避免 sudo）

与本机 `j2c` 一样，安装到 `~/.local`，**不要**往 `/usr` 装（易 EACCES）：

```bash
cd "$PKG_DIR"
npm install
mkdir -p "$HOME/.local/bin"
npm install -g . --prefix "$HOME/.local"
export PATH="$HOME/.local/bin:$PATH"
```

若用户 shell 尚未持久化 PATH，追加到 `~/.bashrc`：

```bash
grep -q '.local/bin' ~/.bashrc || echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
```

验证（必须用带 PATH 的 shell）：

```bash
command -v f2c
# 期望: /home/<user>/.local/bin/f2c
# 注意: 若提示 apt install f2c，说明 PATH 未包含 ~/.local/bin
f2c --version
f2c --help
```

备选（已有 tgz 时）：

```bash
npm install -g "$PKG_DIR"/ftp2claw-cli-*.tgz --prefix "$HOME/.local"
```
### 步骤 3：配置凭证（非交互，适合 Agent）

**不要把密码写进 git。** 优先用环境变量；需要持久化时用 `setup`。

方式 A — 环境变量（推荐给 cron / 临时会话）：

```bash
export FTP_HOST="10.83.3.36"
export FTP_USER="ftpuser"
export FTP_PASS="<向用户索取密码，勿编造，勿提交>"
```

方式 B — 写入本机配置（权限 600）：

```bash
f2c setup --host 10.83.3.36 --user ftpuser --password "<向用户索取>" --port 21
```

默认 host/user 已内置为 `10.83.3.36` / `ftpuser`，但 **password 必须由用户提供**。

若用户已提供 `ftpserver_info.png` 或口头告知密码，Agent 可代为执行 `setup`，但：

1. 不得把密码写进 README / 代码 / commit
2. 配置文件路径：`~/.config/ftp2claw/config.json`

### 步骤 4：连通性验证

```bash
f2c ping
```

成功应看到 `"ok": true`。失败则检查网络、账号或防火墙，向用户报告，**不要假装下载成功**。

### 步骤 5（可选）：安装 Cursor Skill

把包内 Skill 拷到用户技能目录，便于后续对话自动调用：

```bash
mkdir -p ~/.cursor/skills
cp -a "$PKG_DIR/skill/ftp2claw" ~/.cursor/skills/
```

### 步骤 6：安装成功回执模板

Agent 完成后向用户汇报：

```text
已安装 ftp2claw-cli
- 命令: f2c / ftp2claw
- 版本: <f2c --version 输出>
- 配置: <已配置 / 仅环境变量 / 尚未配置密码>
- ping: <OK / FAILED: 原因>
```

---

## 人类手动安装

```bash
cd /data/workspace/docker/A67LGo/ftp/ftp2claw-cli
npm install
npm install -g . --prefix "$HOME/.local"
export PATH="$HOME/.local/bin:$PATH"
f2c setup --host 10.83.3.36 --user ftpuser --password '你的密码'
f2c ping
```
打包分享给同事：

```bash
cd /data/workspace/docker/A67LGo/ftp/ftp2claw-cli
npm pack
# 得到 ftp2claw-cli-1.0.0.tgz，对方执行：
# npm install -g ./ftp2claw-cli-1.0.0.tgz
```

---

## 命令一览

| 命令 | 说明 |
|------|------|
| `f2c setup` | 保存凭证到 `~/.config/ftp2claw/config.json` |
| `f2c ping` | 测试连通性 |
| `f2c ls [remotePath]` | 列出远端目录 |
| `f2c get <remotePath> [-o dir]` | 下载文件或目录（目录递归） |
| `f2c get-url <ftpUrl> [-o dir]` | 解析 Jira FTP 链接并下载 |
| `f2c extract-url -t "..."` | 从文本抽出第一个 `ftp://` |
| `f2c config-path` | 打印配置文件路径 |

### 示例

```bash
# 从 Jira 描述链接下载整个目录到 ./logs
f2c get-url 'ftp://ftpuser@10.83.3.36/2_DevicelockX/DLX-215' -o ./logs

# 与 j2c 联用：读 issue → 抽链接 → 下载
j2c read DLX-215 -e md | f2c extract-url
f2c get-url "$(j2c read DLX-215 -e md | f2c extract-url)" -o ./logs/DLX-215

# 只列目录
f2c ls /2_DevicelockX/DLX-215 --json
```

### 凭证优先级

1. URL 内嵌密码（`ftp://user:pass@host/path`）
2. CLI 参数 `--password`
3. 环境变量 `FTP_PASS` / `FTP_PASSWORD`
4. 配置文件 `~/.config/ftp2claw/config.json`

Host / user 同样支持 `FTP_HOST` / `FTP_USER`。调试协议可设 `FTP_VERBOSE=1`。

### FTPS 说明

实验室 FTP 返回 `530 Non-anonymous sessions must use encryption`，因此 **默认启用显式 FTPS（端口 21）**，并默认接受自签名证书。

| 变量 / 配置 | 说明 |
|-------------|------|
| `FTP_SECURE=true` | 显式 FTPS（默认） |
| `FTP_SECURE=false` | 关闭加密（该服务器通常会失败） |
| `FTP_TLS_STRICT=1` | 校验证书（自签名环境不要开） |

`ftp://...` 的 Jira 链接仍用 FTPS 连接；只有 `ftps://` 会强制 secure。
---

## 卸载

```bash
npm uninstall -g ftp2claw-cli
rm -f ~/.config/ftp2claw/config.json
```
