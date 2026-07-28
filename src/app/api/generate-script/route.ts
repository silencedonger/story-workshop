import { NextRequest, NextResponse } from "next/server";
import { LLMClient, Config, HeaderUtils } from "coze-coding-dev-sdk";
import type { Message } from "coze-coding-dev-sdk";

export async function POST(request: NextRequest) {
  try {
    const { genre } = await request.json();

    if (!genre || typeof genre !== "string") {
      return NextResponse.json(
        { success: false, error: "请提供小说类型" },
        { status: 400 }
      );
    }

    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const config = new Config();
    const client = new LLMClient(config, customHeaders);

    const systemPrompt = `你是一位专业的漫剧小说剧本创作者，擅长将小说改编为适合漫画/动画制作的剧本格式。你的创作风格生动、画面感强，对话精炼有力。

请根据用户指定的小说类型，创作一部完整的漫剧小说剧本。输出格式要求如下：

# 《小说标题》

## 一、作品概述
- 类型：xxx
- 主题：一句话概括核心主题
- 风格基调：描述整体氛围

## 二、人物设定

### 主角
- 姓名：
- 年龄：
- 外貌特征：
- 性格特点：
- 背景故事：
- 核心动机：

### 配角（至少2位）
（同上格式）

## 三、故事大纲

### 第一幕：xxx
（概述本幕主要事件）

### 第二幕：xxx
（概述本幕主要事件）

### 第三幕：xxx
（概述本幕主要事件）

## 四、分集剧本

### 第1集：集名

---

**场景1：场景名称**

【场景描述】
（详细描述场景环境、时间、氛围，要有画面感）

【人物】出场人物

【对话与动作】

**角色名**：（表情/动作提示）"对话内容"

*动作指示*：（描述角色的肢体动作、表情变化）

**角色名**：（表情/动作提示）"对话内容"

【分镜提示】
- 镜头1：（描述画面构图，如"特写：主角紧握拳头的手"）
- 镜头2：（描述画面构图，如"全景：城市夜景俯瞰"）
- 镜头3：（描述画面构图）

---

**场景2：场景名称**
（同上格式）

---

### 第2集：集名
（同上格式，至少包含2个场景）

### 第3集：集名
（同上格式，至少包含2个场景）

请确保：
1. 对话生动自然，符合角色性格
2. 场景描述有强烈的画面感，便于漫画分镜
3. 每集都有明确的冲突和悬念
4. 分镜提示具体、可执行
5. 内容积极向上，富有感染力`;

    const messages: Message[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: `请为我创作一部「${genre}」类型的漫剧小说剧本，要求内容完整、情节精彩、人物鲜明。` },
    ];

    const stream = client.stream(messages, {
      model: "doubao-seed-2-0-lite-260215",
      temperature: 0.9,
    });

    const encoder = new TextEncoder();
    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            if (chunk.content) {
              const data = `data: ${JSON.stringify({ content: chunk.content.toString() })}\n\n`;
              controller.enqueue(encoder.encode(data));
            }
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (streamError) {
          console.error("Stream error:", streamError);
          controller.error(streamError);
        }
      },
    });

    return new Response(readableStream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Generate script error:", error);
    return NextResponse.json(
      { success: false, error: "生成剧本失败" },
      { status: 500 }
    );
  }
}
