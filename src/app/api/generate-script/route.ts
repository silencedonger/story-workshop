import { NextRequest, NextResponse } from "next/server";
import { LLMClient, Config, HeaderUtils } from "coze-coding-dev-sdk";

export async function POST(request: NextRequest) {
  try {
    const { genre, novelContent } = await request.json();

    if (!genre || typeof genre !== "string") {
      return NextResponse.json(
        { success: false, error: "请提供小说类型" },
        { status: 400 }
      );
    }

    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);

    const config = new Config();
    const client = new LLMClient(config, customHeaders);

    const systemPrompt = `你是一位经验丰富的漫剧编剧，擅长将小说改编为适合漫画/动画拍摄的剧本。

## 改编要求
1. 基于用户提供的小说内容，改编为漫剧剧本格式
2. 保持原作的核心情节和人物设定
3. 增加分镜描述、场景构图建议
4. 标注镜头语言（远景、近景、特写等）
5. 对话简洁有力，适合配音

## 输出格式

# 《剧本标题》

## 一、作品概述
- 类型：${genre}
- 改编自：用户提供的小说

## 二、人物设定
- 主角：（姓名、性格、外貌描述）
- 配角：（姓名、与主角关系、特点）

## 三、分集剧本

### 第1集：集名
**场景：**（时间、地点、环境描述）
**分镜：**（镜头建议、画面构图）
**对白/动作：**（角色对话和动作指示）
`;

    const userMessage = novelContent
      ? `以下是我创作的小说内容，请将其改编为漫剧剧本：\n\n${novelContent}`
      : `请根据「${genre}」类型，创作一部完整的漫剧剧本，包含标题、人物设定、故事大纲和至少3集的分镜剧本内容。`;

    const messages = [
      { role: "system", content: systemPrompt } as const,
      { role: "user" as const, content: userMessage },
    ];

    const stream = client.stream(messages, {
      model: "doubao-seed-1-8-251228",
      temperature: 0.85,
    });

    const encoder = new TextEncoder();
    const responseStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            if (chunk.content) {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ content: chunk.content.toString() })}\n\n`)
              );
            }
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (error) {
          console.error("Streaming error:", error);
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ error: "生成过程出错，请重试" })}\n\n`
            )
          );
          controller.close();
        }
      },
    });

    return new Response(responseStream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Generate script error:", error);
    return NextResponse.json(
      { success: false, error: "生成剧本时出现错误，请重试" },
      { status: 500 }
    );
  }
}