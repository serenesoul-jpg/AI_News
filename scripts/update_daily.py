#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
每日新闻更新工具

用法:
  # 从 JSON 文件发布
  python3 scripts/update_daily.py data/2026-06-10.json

  # 从旧版 HTML 导入并发布
  python3 scripts/update_daily.py --from-html 6_10.html --date 2026-06-10
"""

from __future__ import print_function

import argparse
import json
import os
import re
import sys

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, 'data')
sys.path.insert(0, BASE_DIR)

from server import save_daily, daily_path  # noqa: E402


def parse_html(html_path, date):
    with open(html_path, 'r', encoding='utf-8') as f:
        content = f.read()
    content = content.replace('\xa0', ' ')

    date_match = re.search(r'<div class="date">([^<]+)</div>', content)
    date_display = date_match.group(1).strip() if date_match else date

    sections_config = {
        'tech': {'label': 'AI 科技', 'icon': '🌐', 'intro': '前沿动态与深度解读', 'comment_label': '深度解读'},
        'edu': {'label': 'AI + 教育', 'icon': '📖', 'intro': 'AI 教育与青年成长', 'comment_label': '教育观察'},
        'culture': {'label': 'AI + 文化', 'icon': '✒️', 'intro': 'AI 重塑文化发展', 'comment_label': '文化观察'},
    }

    def parse_section(tab_id):
        pattern = (
            r'<div class="tab-content[^"]*" id="tab-{0}">(.*?)(?=<div class="tab-content"|</div>\s*</div>\s*<div class="footer">)'
        ).format(tab_id)
        m = re.search(pattern, content, re.DOTALL)
        section_html = m.group(1) if m else ''
        cards = []
        parts = re.split(r'<div class="news-card">', section_html)
        for part in parts[1:]:
            title_m = re.search(r'<div class="news-title">(.*?)</div>', part, re.DOTALL)
            body_m = re.search(r'<div class="news-body">(.*?)</div>', part, re.DOTALL)
            comment_m = re.search(r'<div class="comment-text">(.*?)</div>', part, re.DOTALL)
            if not title_m:
                continue
            title = re.sub(r'<[^>]+>', '', title_m.group(1)).strip()
            body_html = body_m.group(1).strip() if body_m else ''
            comment = re.sub(r'<[^>]+>', '', comment_m.group(1)).strip() if comment_m else ''
            sources = [
                {'url': lm.group(1), 'text': lm.group(2).strip()}
                for lm in re.finditer(r'<a href="([^"]+)"[^>]*>([^<]+)</a>', body_html)
            ]
            body_text = re.sub(r'<a[^>]*>[^<]*</a>', '', body_html)
            body_text = re.sub(r'<[^>]+>', '', body_text).strip()
            cards.append({'title': title, 'body': body_text, 'sources': sources, 'comment': comment})
        return cards

    parts = date.split('-')
    month_day = '{}月{}日'.format(int(parts[1]), int(parts[2]))

    return {
        'date': date,
        'date_display': date_display,
        'meta': {
            'title': '冰块AI资讯日报 | {}'.format(date),
            'og_title': '冰块AI资讯日报 · {}'.format(month_day),
            'og_description': 'AI科技 × AI+教育 × AI+文化，三大板块一键切换',
            'og_image': 'https://www.coze.cn/s/A10awpVKceE/'
        },
        'sections': {
            sid: {**cfg, 'items': parse_section(sid)}
            for sid, cfg in sections_config.items()
        }
    }


def main():
    parser = argparse.ArgumentParser(description='更新 AI 日报数据')
    parser.add_argument('file', nargs='?', help='JSON 数据文件路径')
    parser.add_argument('--from-html', dest='html', help='从 HTML 文件导入')
    parser.add_argument('--date', help='日期 YYYY-MM-DD（配合 --from-html）')
    args = parser.parse_args()

    if args.html:
        if not args.date:
            print('错误: --from-html 需要配合 --date 使用')
            sys.exit(1)
        data = parse_html(args.html, args.date)
    elif args.file:
        with open(args.file, 'r', encoding='utf-8') as f:
            data = json.load(f)
    else:
        parser.print_help()
        sys.exit(1)

    save_daily(data)
    print('已保存: {}'.format(daily_path(data['date'])))
    counts = {k: len(v.get('items', [])) for k, v in data['sections'].items()}
    print('新闻条数: {}'.format(counts))


if __name__ == '__main__':
    main()
