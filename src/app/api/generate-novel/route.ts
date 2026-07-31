import { NextRequest, NextResponse } from "next/server";
import { LLMClient, Config, HeaderUtils, SearchClient } from "coze-coding-dev-sdk";
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

    // Step 1: 联网搜索该类型的资料
    const searchClient = new SearchClient(config, customHeaders);
    const searchQuery = `${genre}小说 热门作品 经典套路 流行元素 2025`;
    const searchResults = await searchClient.advancedSearch(searchQuery, {
      count: 5,
      needSummary: true,
      searchType: "web_summary",
      timeRange: "oneYear",
    });

    const referenceInfo = searchResults?.web_items
      ?.map((r) =>
        `【参考：${r.title || "相关资料"}】\n${r.summary || r.snippet || ""}`
      )
      .filter(Boolean)
      .join("\n\n") || "暂无搜索到相关资料。";

    // Step 2: 基于搜索到的资料，流式生成小说
    const client = new LLMClient(config, customHeaders);

    const systemPrompt = `你是一位才华横溢的小说家，擅长将真实素材融入创作。

## 你的任务
根据用户指定的「小说类型」以及你搜索到的「参考资料」，创作一篇精彩的小说。

## 参考资料（请基于以下真实素材进行创作）
${referenceInfo}

## 创作要求
1. 从参考资料中汲取灵感——可以借鉴热门作品的设定风格、流行元素、经典桥段，但必须创作全新的故事
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

    const messages: Message[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: `请参考以上资料，为我创作一篇「${genre}」类型的小说，要求情节精彩、文笔优美、画面感强，字数控制在${targetWords}字左右。` },
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
        } catch (e) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: "生成中断" })}\n\n`)
          );
        } finally {
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
    console.error("生成小说失败:", error);
    return NextResponse.json(
      { success: false, error: "生成小说失败" },
      { status: 500 }
    );
  }
}