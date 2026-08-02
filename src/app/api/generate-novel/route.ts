import { NextRequest, NextResponse } from "next/server";
import { LLMClient, Config, HeaderUtils } from "coze-coding-dev-sdk";

export async function POST(request: NextRequest) {
  try {
    const { genre, wordCount } = await request.json();

    if (!genre || typeof genre !== "string") {
      return NextResponse.json(
        { success: false, error: "请提供小说类型" },
        { status: 400 }
      );
    }

    const targetWords = typeof wordCount === "number" ? wordCount : 2000;
    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);

    const config = new Config();
    const client = new LLMClient(config, customHeaders);

    const systemPrompt = `你是一位才华横溢的小说家，擅长创作各类题材的精彩小说。

## 创作要求
1. 创作一篇全新的「${genre}」类型小说
2. 有吸引人的标题
3. 开篇即入戏，迅速抓住读者注意力
4. 人物形象鲜明，对话生动自然
5. 情节有起伏，有转折，有悬念
6. **字数要求：约${targetWords}字**（请严格控制篇幅）
7. 画面感强，适合后续改编为漫画/动画

## 输出格式
# 《小说标题》

（正文内容，适当分段，保持阅读节奏）

---

*（完）*`;

    const messages = [
      { role: "system", content: systemPrompt } as const,
      {
        role: "user" as const,
        content: `请为我创作一篇「${genre}」类型的小说，要求情节精彩、文笔优美、画面感强，字数控制在${targetWords}字左右。`,
      },
    ];

    const stream = client.stream(messages, {
      model: "doubao-seed-1-8-251228",
      temperature: 0.9,
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
    console.error("Generate novel error:", error);
    return NextResponse.json(
      { success: false, error: "生成小说时出现错误，请重试" },
      { status: 500 }
    );
  }
}