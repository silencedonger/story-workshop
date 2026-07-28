import { NextRequest, NextResponse } from "next/server";
import { LLMClient, Config, HeaderUtils } from "coze-coding-dev-sdk";
import type { Message } from "coze-coding-dev-sdk";

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

    const systemPrompt = `你是一位才华横溢的小说家，擅长创作引人入胜的小说。你的文笔优美，情节紧凑，人物鲜活。

请根据用户指定的小说类型，创作一篇精彩的小说。要求：

1. 有吸引人的标题
2. 开篇即入戏，迅速抓住读者注意力
3. 人物形象鲜明，对话生动自然
4. 情节有起伏，有转折，有悬念
5. 结尾有余韵，令人回味
6. **字数要求：约${targetWords}字**（请严格控制篇幅，不要过短或过长）
7. 适合后续改编为漫画/动画（画面感强）

请直接输出小说内容，格式如下：

# 《小说标题》

（正文内容，适当分段，保持阅读节奏）

---

*（完）*`;

    const messages: Message[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: `请为我创作一篇「${genre}」类型的小说，要求情节精彩、文笔优美、画面感强，字数控制在${targetWords}字左右。` },
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
          if (!controller.desiredSize) return;
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
    console.error("Generate novel error:", error);
    return NextResponse.json(
      { success: false, error: "生成小说失败" },
      { status: 500 }
    );
  }
}
