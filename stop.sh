#!/bin/bash
cd "$(dirname "$0")"
if [ -f logs/server.pid ]; then
  kill "$(cat logs/server.pid)" 2>/dev/null && echo "服务已停止" || echo "进程不存在"
  rm -f logs/server.pid
else
  pkill -f "python3 server.py" 2>/dev/null && echo "服务已停止" || echo "未找到运行中的服务"
fi
