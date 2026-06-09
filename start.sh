#!/bin/bash
cd "$(dirname "$0")"
nohup python3 server.py >> logs/server.log 2>&1 &
echo $! > logs/server.pid
echo "AI日报服务已启动，PID: $(cat logs/server.pid)"
echo "访问地址: http://8.134.97.118:8088"
