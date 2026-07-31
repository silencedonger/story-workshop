import { NextRequest, NextResponse } from "next/server";

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || "";
const DEEPSEEK_BASE_URL = "https://api.deepseek.com/v1";

export async function POST(request: NextRequest) {
  try {
    const { genre, novelContent } = await request.json();

    if (!genre || typeof genre !== "string") {
      return NextResponse.json(
        { success: false, error: "请提供小说类型" },
        { status: 400 }
      );
    }

    const systemPrompt = `你是一位专业的漫剧小说剧本创作者，擅长将小说改编为适合漫画/动画制作的剧本格式。你的创作风格生动、画面感强，对话精炼有力。

## 你的任务
根据用户提供的小说内容，将其改编为完整的漫剧小说剧本。保留原作的人物、情节和风格，但转换为适合漫画/动画的剧本格式。

## 输出格式要求
# 《小说标题》

## 一、作品概述
- 类型：${genre}
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

【分镜提示】
- 镜头1：（描述画面构图，如"特写：主角紧握拳头的手"）
- 镜头2：（描述画面构图，如"全景：城市夜景俯瞰"）
- 镜头3：（描述画面构图）

### 第2集：集名
（同上格式）

### 第3集：集名
（同上格式）`;

    const userMessage = novelContent
      ? `以下是我创作的小说，请将其改编为漫剧剧本：\n\n${novelContent}`
      : `请直接创作一篇「${genre}」类型小说的漫剧剧本（包含完整的人物设定、故事大纲和分集剧本）。`;

    const response = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        stream: true,
        temperature: 0.8,
        max_tokens: 8192,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("DeepSeek API error:", response.status, error);
      return NextResponse.json(
        { success: false, error: "AI 生成服务暂时不可用" },
        { status: 502 }
      );
    }

    const encoder = new TextEncoder();
    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          const reader = response.body!.getReader();
          const decoder = new TextDecoder();
          let buffer = "";

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed || !trimmed.startsWith("data: ")) continue;
              const data = trimmed.slice(6);
              if (data === "[DONE]") continue;

              try {
                const parsed = JSON.parse(data);
                const content = parsed.choices?.[0]?.delta?.content || "";
                if (content) {
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ content })}\n\n`)
                  );
                }
              } catch {
                // skip malformed JSON
              }
            }
          }
        } catch (err) {
          console.error("Stream error:", err);
        } finally {
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
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