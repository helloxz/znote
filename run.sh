#!/bin/sh
set -e

SCRIPT_DIR=$(pwd)

# 加载环境变量
if [ -f "$SCRIPT_DIR/.env" ]; then
  set -a
  . "$SCRIPT_DIR/.env"
  set +a
fi

# 确保运行时目录存在
mkdir -p "$SCRIPT_DIR/data/db"

# 安全开关：启动时自动关闭管理员密码重置端点
# 用户需要重置密码时，手动执行 touch data/reset.txt，用完后下次启动会自动删除
if [ -f "$SCRIPT_DIR/data/reset.txt" ]; then
  rm "$SCRIPT_DIR/data/reset.txt"
fi

# dev 模式：热重载开发服务器
# 生产模式：先执行数据库迁移，再启动生产服务
if [ "$1" = "dev" ]; then
  bun run dev
else
  bun run db:migrate
  bun run ./dist/index.js
fi
