import { NextRequest, NextResponse } from "next/server";

const QWEN_API_KEY = process.env.QWEN_API_KEY || "";
const QWEN_BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1";

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

    const response = await fetch(`${QWEN_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${QWEN_API_KEY}`,
      },
      body: JSON.stringify({
        model: "qwen-max",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `请为我创作一篇「${genre}」类型的小说，要求情节精彩、文笔优美、画面感强，字数控制在${targetWords}字左右。`,
          },
        ],
        stream: true,
        temperature: 0.9,
        max_tokens: targetWords * 3,
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
    console.error("Generate novel error:", error);
    return NextResponse.json(
      { success: false, error: "生成小说失败" },
      { status: 500 }
    );
  }
}