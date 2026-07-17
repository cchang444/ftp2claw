# 给同事的一页纸

1. 拿到 `ftp2claw-cli` 目录或 `ftp2claw-cli-*.tgz`
2. 安装：`npm install -g . --prefix "$HOME/.local"`（并确保 `~/.local/bin` 在 PATH）
3. 配置：`f2c setup --host 10.83.3.36 --user ftpuser --password '***'`（默认 FTPS）
4. 验证：`f2c ping`
5. 下载：`f2c get-url 'ftp://ftpuser@10.83.3.36/路径' -o ./logs`

详细说明与 **AI Agent 自动安装步骤** 见上级 `README.md`。
