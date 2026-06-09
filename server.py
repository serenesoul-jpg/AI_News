#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
冰块 AI 资讯日报 - Web 服务
端口: 8088
"""

from __future__ import print_function

import json
import os
import re
import sys
from datetime import datetime
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, 'data')
PUBLIC_DIR = os.path.join(BASE_DIR, 'public')
LATEST_FILE = os.path.join(DATA_DIR, 'latest.json')
HOST = '0.0.0.0'
PORT = 8088

DATE_PATTERN = re.compile(r'^\d{4}-\d{2}-\d{2}$')


def read_json(path):
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)


def write_json(path, data):
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def get_latest_date():
    if os.path.exists(LATEST_FILE):
        try:
            info = read_json(LATEST_FILE)
            date = info.get('date')
            if date and os.path.exists(daily_path(date)):
                return date
        except (IOError, ValueError, KeyError):
            pass
    return get_available_dates()[0] if get_available_dates() else None


def daily_path(date):
    return os.path.join(DATA_DIR, date + '.json')


def get_available_dates():
    dates = []
    if not os.path.isdir(DATA_DIR):
        return dates
    for name in os.listdir(DATA_DIR):
        if name.endswith('.json') and name != 'latest.json':
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


def save_daily(data):
    date = data.get('date')
    if not date or not DATE_PATTERN.match(date):
        raise ValueError('invalid date field, expected YYYY-MM-DD')

    for sid in ('tech', 'edu', 'culture'):
        if sid not in data.get('sections', {}):
            raise ValueError('missing section: ' + sid)

    write_json(daily_path(date), data)
    write_json(LATEST_FILE, {'date': date, 'updated_at': datetime.now().isoformat()})
    return data


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


class DailyNewsHandler(BaseHTTPRequestHandler):
    protocol_version = 'HTTP/1.1'

    def log_message(self, fmt, *args):
        sys.stderr.write('[{}] {}\n'.format(
            self.log_date_time_string(), fmt % args))

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path.rstrip('/') or '/'

        if path == '/api/dates':
            json_response(self, get_available_dates())
            return

        if path == '/api/daily/latest':
            date = get_latest_date()
            if not date:
                json_response(self, {'error': 'no data'}, 404)
                return
            data = load_daily(date)
            json_response(self, data)
            return

        m = re.match(r'^/api/daily/(\d{4}-\d{2}-\d{2})$', path)
        if m:
            data = load_daily(m.group(1))
            if data is None:
                json_response(self, {'error': 'not found'}, 404)
                return
            json_response(self, data)
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

        if path != '/api/daily':
            text_response(self, 'Not Found', 404)
            return

        length = int(self.headers.get('Content-Length', 0))
        raw = self.rfile.read(length) if length else b''

        try:
            payload = json.loads(raw.decode('utf-8'))
            saved = save_daily(payload)
            json_response(self, {'ok': True, 'date': saved['date']})
        except ValueError as e:
            json_response(self, {'error': str(e)}, 400)
        except (IOError, ValueError) as e:
            json_response(self, {'error': 'invalid json: ' + str(e)}, 400)


def main():
    os.makedirs(DATA_DIR, exist_ok=True)
    os.makedirs(PUBLIC_DIR, exist_ok=True)

    server = HTTPServer((HOST, PORT), DailyNewsHandler)
    print('AI Daily News server running at http://{}:{}'.format(HOST, PORT))
    print('Data directory: {}'.format(DATA_DIR))
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\nShutting down...')
        server.server_close()


if __name__ == '__main__':
    main()
