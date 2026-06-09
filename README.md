# 冰块 AI 资讯日报

每日 AI 资讯聚合展示站点，涵盖 **AI 科技**、**AI + 教育**、**AI + 文化** 三大板块，支持前台浏览、历史存档与可视化后台管理。

## 功能特性

- **前台展示**：响应式页面，电脑端 / 移动端自适应
- **三大 Tab 切换**：AI 科技、AI+教育、AI+文化
- **历史日报**：按日期浏览往期内容
- **当天优先**：首页默认展示当天日报；当天无内容时回退到最近一期
- **管理后台**：表单化编辑，无需手写 JSON 或登录服务器
- **HTML 导入**：支持从扣子（Coze）生成的 HTML 一键解析
- **数据存档**：每日新闻以 JSON 文件独立存储

## 项目结构

```
AI_News/
├── server.py              # Web 服务（端口 8088）
├── public/                # 前台静态资源
│   ├── index.html
│   ├── css/style.css
│   └── js/app.js
├── public/admin/          # 管理后台
│   ├── index.html
│   ├── css/admin.css
│   └── js/admin.js
├── data/                  # 日报数据存档
│   ├── YYYY-MM-DD.json    # 每日新闻数据
│   ├── latest.json        # 最近一次「当天」发布记录
│   └── template.json      # 新日报模板
├── config/
│   └── admin.json         # 后台账号密码
├── scripts/
│   └── update_daily.py    # 命令行更新工具
├── start.sh / stop.sh     # 启停脚本
└── ai-daily.service       # systemd 服务配置
```

## 环境要求

- Python 3.6+
- 无第三方依赖（仅使用标准库）

## 快速部署

### 1. 启动服务

```bash
cd /root/AI_News
python3 server.py
```

服务默认监听 `0.0.0.0:8088`。

### 2. 配置开机自启（推荐）

```bash
cp ai-daily.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable ai-daily
systemctl start ai-daily
```

### 3. 访问地址

| 页面 | 地址 |
|------|------|
| 前台首页 | http://你的服务器IP:8088 |
| 管理后台 | http://你的服务器IP:8088/admin |

请确保防火墙 / 安全组已放行 **8088** 端口。

## 管理后台

### 登录

默认账号见 `config/admin.json`：

```json
{
  "username": "admin",
  "password": "bingkuai2026",
  "session_hours": 24
}
```

> 首次部署后请尽快修改密码。

### 每日更新流程

1. 打开 `/admin` 并登录
2. 选择日期，点击 **「新建空白日报」**（或 **「从昨日复制」**）
3. 在三个 Tab 中分别填写新闻：
   - **新闻标题**：一句话概括
   - **新闻正文**：纯文字，直接粘贴即可
   - **来源链接**：可添加多条
   - **解读内容**：深度解读 / 教育观察 / 文化观察
4. 点击 **「🚀 发布上线」**

### 发布规则

| 操作 | 效果 |
|------|------|
| 发布 **当天** 日报 | 更新前台首页 |
| 发布 **历史日期** | 仅存档，不改变首页默认展示 |
| **保存草稿** | 写入数据文件，不更新首页 |

### 其他功能

- **导入 HTML**：粘贴或上传扣子生成的 HTML 文件，自动解析为表单内容
- **加载**：读取指定日期的已有日报进行编辑
- **预览前台**：右上角链接可跳转查看效果

## 命令行更新（可选）

适合技术人员或自动化脚本。

### 从 JSON 发布

```bash
cp data/template.json data/2026-06-10.json
# 编辑 data/2026-06-10.json
python3 scripts/update_daily.py data/2026-06-10.json
```

### 从 HTML 导入

```bash
python3 scripts/update_daily.py --from-html 6_10.html --date 2026-06-10
```

## API 接口

### 公开接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/daily/latest` | 获取首页默认日报（优先当天） |
| GET | `/api/daily/YYYY-MM-DD` | 获取指定日期日报 |
| GET | `/api/dates` | 获取所有可用日期列表 |
| POST | `/api/daily` | 发布/更新日报（JSON  body） |

### 后台接口（需登录 Token）

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/admin/api/login` | 登录，返回 token |
| POST | `/admin/api/logout` | 退出 |
| GET | `/admin/api/me` | 验证登录状态 |
| GET | `/admin/api/daily/YYYY-MM-DD` | 读取指定日期 |
| POST | `/admin/api/daily` | 保存/发布（`{ data, publish }`） |
| GET | `/admin/api/copy-from/YYYY-MM-DD` | 从最近一期复制 |

## 数据格式

每日数据存储为 `data/YYYY-MM-DD.json`，结构示例：

```json
{
  "date": "2026-06-09",
  "date_display": "2026 年 6 月 9 日 · 星期二",
  "meta": {
    "title": "冰块AI资讯日报 | 2026-06-09",
    "og_title": "冰块AI资讯日报 · 6月9日",
    "og_description": "AI科技 × AI+教育 × AI+文化，三大板块一键切换",
    "og_image": "https://www.coze.cn/s/A10awpVKceE/"
  },
  "sections": {
    "tech": {
      "label": "AI 科技",
      "icon": "🌐",
      "intro": "前沿动态与深度解读",
      "comment_label": "深度解读",
      "items": [
        {
          "title": "新闻标题",
          "body": "新闻正文",
          "sources": [{ "text": "来源：示例", "url": "https://example.com" }],
          "comment": "深度解读内容"
        }
      ]
    },
    "edu": { "...": "..." },
    "culture": { "...": "..." }
  }
}
```

## 服务管理

```bash
# 查看状态
systemctl status ai-daily

# 重启
systemctl restart ai-daily

# 停止
bash stop.sh

# 启动
bash start.sh
```

## 常见问题

**Q：发布后前台没有更新？**

确认发布的是当天日期，且点击的是「发布上线」而非「保存草稿」。刷新前台页面（Ctrl+Shift+R）。

**Q：补发历史日报后首页变成了历史日期？**

已修复：首页始终优先展示当天日报，补发历史内容不会影响首页。

**Q：后台登录无响应？**

检查服务是否运行：`systemctl status ai-daily`。若进程卡死，执行 `systemctl restart ai-daily`。

**Q：误覆盖了某天的数据怎么办？**

若数据曾提交到 Git，可通过 `git restore data/YYYY-MM-DD.json` 恢复；或从原始 HTML（如 `6_9.html`）重新导入。

## 技术说明

- 服务基于 Python 标准库 `http.server`，采用多线程处理请求
- 前台通过 `/api/daily/latest` 动态加载数据，内容与页面分离
- 后台使用 Bearer Token 鉴权，会话有效期可在 `config/admin.json` 中配置

## License

内部项目，版权归冰块团队所有。
