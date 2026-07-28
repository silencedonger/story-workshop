# AGENTS.md

## 项目概览
漫剧剧本工坊 - 一个漫剧小说剧本生成器 Web 应用。用户可联网搜索热门小说类型，选择后由 AI 流式生成完整漫剧剧本。

## 技术栈
- **Framework**: Next.js 16 (App Router)
- **Core**: React 19
- **Language**: TypeScript 5
- **UI**: shadcn/ui + Tailwind CSS 4
- **Styling**: 自定义设计系统（见 DESIGN.md）

## 目录结构
```
src/
├── app/
│   ├── api/
│   │   ├── search-genres/route.ts   # POST - 联网搜索热门小说类型
│   │   └── generate-script/route.ts # POST - SSE流式生成剧本
│   ├── layout.tsx
│   ├── page.tsx                     # 主页面（状态机驱动）
│   └── globals.css                  # 全局样式 + 设计令牌
├── components/
│   ├── GenreCards.tsx               # 类型选择卡片组件
│   ├── LoadingAnimation.tsx         # 墨点扩散加载动画
│   └── ScriptDisplay.tsx            # 剧本展示 + Markdown渲染
└── lib/utils.ts
```

## 核心功能
1. **搜索热门类型** - 使用 coze-coding-dev-sdk 的 SearchClient 联网搜索
2. **流式生成剧本** - 使用 coze-coding-dev-sdk 的 LLMClient 流式输出
3. **Markdown渲染** - 自定义轻量解析器，支持标题/粗体/斜体/列表/分隔线

## 构建命令
- 开发：`pnpm run dev`
- 构建：`pnpm run build`
- 启动：`pnpm run start`
- 类型检查：`pnpm ts-check`
- 代码检查：`pnpm lint`

## 设计规范
- 色彩：象牙白背景 #FAFAF8、淡墨色文字 #2C2C2C、淡赭石点缀 #B8977E
- 字体：Noto Serif SC（标题）、系统默认（正文）
- 风格：极简、大量留白、水墨晕染动效
- 详见 DESIGN.md
