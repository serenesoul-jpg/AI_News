#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
冰块 AI 资讯日报 - Web 服务
端口: 8088
"""

from __future__ import print_function

import hashlib
import json
import os
import re
import secrets
import sys
import time
from datetime import datetime, timedelta
from http.server import HTTPServer, BaseHTTPRequestHandler
from socketserver import ThreadingMixIn
from urllib.parse import urlparse

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, 'data')
PUBLIC_DIR = os.path.join(BASE_DIR, 'public')
ADMIN_DIR = os.path.join(PUBLIC_DIR, 'admin')
CONFIG_DIR = os.path.join(BASE_DIR, 'config')
ADMIN_CONFIG = os.path.join(CONFIG_DIR, 'admin.json')
LATEST_FILE = os.path.join(DATA_DIR, 'latest.json')
HOST = '0.0.0.0'
PORT = 8088

DATE_PATTERN = re.compile(r'^\d{4}-\d{2}-\d{2}$')
WEEKDAYS = ['星期一', '星期二', '星期三', '星期四', '星期五', '星期六', '星期日']

# token -> expiry timestamp
SESSIONS = {}


def read_json(path):
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)


def write_json(path, data):
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def load_admin_config():
    if not os.path.exists(ADMIN_CONFIG):
        default = {'username': 'admin', 'password': 'bingkuai2026', 'session_hours': 24}
        os.makedirs(CONFIG_DIR, exist_ok=True)
        write_json(ADMIN_CONFIG, default)
        return default
    return read_json(ADMIN_CONFIG)


def format_date_display(date_str):
    parts = date_str.split('-')
    dt = datetime(int(parts[0]), int(parts[1]), int(parts[2]))
    weekday = WEEKDAYS[dt.weekday()]
    return '{} 年 {} 月 {} 日 · {}'.format(parts[0], int(parts[1]), int(parts[2]), weekday)


def today_str():
    return datetime.now().strftime('%Y-%m-%d')


def get_latest_date():
    """前台默认展示当天日报；当天无内容时回退到最近一期（不晚于今天）。"""
    today = today_str()
    if os.path.exists(daily_path(today)):
        return today

    dates = get_available_dates()
    for date in dates:
        if date <= today:
            return date
    return dates[0] if dates else None


def daily_path(date):
    return os.path.join(DATA_DIR, date + '.json')


def get_available_dates():
    dates = []
    if not os.path.isdir(DATA_DIR):
        return dates
    for name in os.listdir(DATA_DIR):
        if name.endswith('.json') and name not in ('latest.json', 'template.json'):
            date = name[:-5]
            if DATE_PATTERN.match(date):
                dates.append(date)
    dates.sort(reverse=True)
    return dates


def load_daily(date):
    path = daily_path(date)
    if not os.path.exists(path):
        return None
    return read_json(path)


def save_daily(data, set_latest=True):
    date = data.get('date')
    if not date or not DATE_PATTERN.match(date):
        raise ValueError('日期格式无效，请使用 YYYY-MM-DD')

    if 'date_display' not in data:
        data['date_display'] = format_date_display(date)

    for sid in ('tech', 'edu', 'culture'):
        if sid not in data.get('sections', {}):
            raise ValueError('缺少板块: ' + sid)

    write_json(daily_path(date), data)
    if set_latest:
        today = today_str()
        # 仅发布「当天」日报时更新 latest 记录；历史日报只存档不影响前台默认展示
        if date == today:
            write_json(LATEST_FILE, {
                'date': date,
                'updated_at': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            })
    return data


def copy_from_previous(target_date):
    dates = get_available_dates()
    source_date = None
    for d in dates:
        if d < target_date:
            source_date = d
            break
    if not source_date:
        raise ValueError('没有可复制的历史日报')

    data = load_daily(source_date)
    data['date'] = target_date
    data['date_display'] = format_date_display(target_date)
    month = int(target_date.split('-')[1])
    day = int(target_date.split('-')[2])
    data['meta']['title'] = '冰块AI资讯日报 | ' + target_date
    data['meta']['og_title'] = '冰块AI资讯日报 · {}月{}日'.format(month, day)
    return data


def create_session():
    config = load_admin_config()
    hours = config.get('session_hours', 24)
    token = secrets.token_hex(32)
    SESSIONS[token] = time.time() + hours * 3600
    return token


def verify_token(handler):
    auth = handler.headers.get('Authorization', '')
    if auth.startswith('Bearer '):
        token = auth[7:]
    else:
        token = ''

    expiry = SESSIONS.get(token)
    if not expiry or time.time() > expiry:
        if token in SESSIONS:
            del SESSIONS[token]
        return None
    return token


def read_body(handler):
    length = int(handler.headers.get('Content-Length', 0))
    if length:
        return handler.rfile.read(length).decode('utf-8')
    return ''


def json_response(handler, data, status=200):
    body = json.dumps(data, ensure_ascii=False).encode('utf-8')
    handler.send_response(status)
    handler.send_header('Content-Type', 'application/json; charset=utf-8')
    handler.send_header('Content-Length', str(len(body)))
    handler.send_header('Access-Control-Allow-Origin', '*')
    handler.end_headers()
    handler.wfile.write(body)


def text_response(handler, text, status=200, content_type='text/plain; charset=utf-8'):
    body = text.encode('utf-8')
    handler.send_response(status)
    handler.send_header('Content-Type', content_type)
    handler.send_header('Content-Length', str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)


def file_response(handler, path, content_type):
    with open(path, 'rb') as f:
        body = f.read()
    handler.send_response(200)
    handler.send_header('Content-Type', content_type)
    handler.send_header('Content-Length', str(len(body)))
    handler.send_header('Cache-Control', 'public, max-age=3600')
    handler.end_headers()
    handler.wfile.write(body)


CONTENT_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
}


class ThreadedHTTPServer(ThreadingMixIn, HTTPServer):
    daemon_threads = True
    allow_reuse_address = True


class DailyNewsHandler(BaseHTTPRequestHandler):
    protocol_version = 'HTTP/1.1'
    timeout = 30

    def handle(self):
        try:
            self.request.settimeout(self.timeout)
            BaseHTTPRequestHandler.handle(self)
        except Exception:
            pass

    def log_message(self, fmt, *args):
        sys.stderr.write('[{}] {}\n'.format(
            self.log_date_time_string(), fmt % args))

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path.rstrip('/') or '/'

        # ---- 公开 API ----
        if path == '/api/dates':
            json_response(self, get_available_dates())
            return

        if path == '/api/daily/latest':
            date = get_latest_date()
            if not date:
                json_response(self, {'error': 'no data'}, 404)
                return
            json_response(self, load_daily(date))
            return

        m = re.match(r'^/api/daily/(\d{4}-\d{2}-\d{2})$', path)
        if m:
            data = load_daily(m.group(1))
            if data is None:
                json_response(self, {'error': 'not found'}, 404)
                return
            json_response(self, data)
            return

        # ---- 后台 API ----
        if path == '/admin/api/me':
            if not verify_token(self):
                json_response(self, {'error': '未登录'}, 401)
                return
            json_response(self, {'ok': True})
            return

        if path == '/admin/api/dates':
            if not verify_token(self):
                json_response(self, {'error': '未登录'}, 401)
                return
            json_response(self, get_available_dates())
            return

        m = re.match(r'^/admin/api/daily/(\d{4}-\d{2}-\d{2})$', path)
        if m:
            if not verify_token(self):
                json_response(self, {'error': '未登录'}, 401)
                return
            data = load_daily(m.group(1))
            if data is None:
                json_response(self, {'error': 'not found'}, 404)
                return
            json_response(self, data)
            return

        m = re.match(r'^/admin/api/copy-from/(\d{4}-\d{2}-\d{2})$', path)
        if m:
            if not verify_token(self):
                json_response(self, {'error': '未登录'}, 401)
                return
            try:
                data = copy_from_previous(m.group(1))
                json_response(self, data)
            except ValueError as e:
                json_response(self, {'error': str(e)}, 400)
            return

        # ---- 页面 ----
        if path in ('/admin', '/admin/'):
            file_response(self, os.path.join(ADMIN_DIR, 'index.html'), 'text/html; charset=utf-8')
            return

        if path.startswith('/admin/static/'):
            rel = path[len('/admin/static/'):]
            safe = os.path.normpath(rel)
            if safe.startswith('..'):
                text_response(self, 'Forbidden', 403)
                return
            fpath = os.path.join(ADMIN_DIR, safe)
            if os.path.isfile(fpath):
                ext = os.path.splitext(fpath)[1].lower()
                file_response(self, fpath, CONTENT_TYPES.get(ext, 'application/octet-stream'))
                return

        if path in ('/', '/index.html'):
            file_response(self, os.path.join(PUBLIC_DIR, 'index.html'), 'text/html; charset=utf-8')
            return

        if path.startswith('/static/'):
            rel = path[len('/static/'):]
            safe = os.path.normpath(rel)
            if safe.startswith('..'):
                text_response(self, 'Forbidden', 403)
                return
            fpath = os.path.join(PUBLIC_DIR, safe)
            if os.path.isfile(fpath):
                ext = os.path.splitext(fpath)[1].lower()
                file_response(self, fpath, CONTENT_TYPES.get(ext, 'application/octet-stream'))
                return

        text_response(self, 'Not Found', 404)

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path.rstrip('/') or '/'
        raw = read_body(self)

        if path == '/admin/api/login':
            try:
                payload = json.loads(raw) if raw else {}
            except ValueError:
                json_response(self, {'error': '请求格式错误'}, 400)
                return

            config = load_admin_config()
            username = payload.get('username', '')
            password = payload.get('password', '')

            if username != config.get('username') or password != config.get('password'):
                json_response(self, {'error': '用户名或密码错误'}, 401)
                return

            token = create_session()
            json_response(self, {'ok': True, 'token': token})
            return

        if path == '/admin/api/logout':
            token = verify_token(self)
            if token and token in SESSIONS:
                del SESSIONS[token]
            json_response(self, {'ok': True})
            return

        if path == '/admin/api/daily':
            if not verify_token(self):
                json_response(self, {'error': '未登录'}, 401)
                return
            try:
                payload = json.loads(raw) if raw else {}
                data = payload.get('data')
                publish = payload.get('publish', True)
                if not data:
                    raise ValueError('缺少数据')
                saved = save_daily(data, set_latest=publish)
                json_response(self, {
                    'ok': True,
                    'date': saved['date'],
                    'published': publish
                })
            except ValueError as e:
                json_response(self, {'error': str(e)}, 400)
            except (IOError, ValueError) as e:
                json_response(self, {'error': '数据格式错误: ' + str(e)}, 400)
            return

        if path == '/api/daily':
            try:
                payload = json.loads(raw) if raw else {}
                saved = save_daily(payload)
                json_response(self, {'ok': True, 'date': saved['date']})
            except ValueError as e:
                json_response(self, {'error': str(e)}, 400)
            except (IOError, ValueError) as e:
                json_response(self, {'error': 'invalid json: ' + str(e)}, 400)
            return

        text_response(self, 'Not Found', 404)


def main():
    os.makedirs(DATA_DIR, exist_ok=True)
    os.makedirs(PUBLIC_DIR, exist_ok=True)
    os.makedirs(ADMIN_DIR, exist_ok=True)
    load_admin_config()

    server = ThreadedHTTPServer((HOST, PORT), DailyNewsHandler)
    print('AI Daily News server running at http://{}:{}'.format(HOST, PORT))
    print('Admin panel: http://{}:{}/admin'.format(HOST, PORT))
    print('Data directory: {}'.format(DATA_DIR))
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\nShutting down...')
        server.server_close()


if __name__ == '__main__':
    main()
