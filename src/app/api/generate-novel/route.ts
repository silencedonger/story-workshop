import { NextRequest, NextResponse } from "next/server";
import { LLMClient, SearchClient, Config, HeaderUtils } from "coze-coding-dev-sdk";

export async function POST(request: NextRequest) {
  try {
    const { genre, userIdea, page, previousContent, wordCount } = await request.json();

    const currentPage = typeof page === "number" && page > 0 ? page : 1;
    const isContinued = currentPage > 1 && previousContent;

    if (!genre && !userIdea) {
      return NextResponse.json(
        { success: false, error: "请提供小说类型或输入想法" },
        { status: 400 }
      );
    }

    // 支持自定义字数，默认 2000 字/页
    const targetWords = typeof wordCount === "number" && wordCount > 0 ? wordCount : 2000;
    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const config = new Config();

    // Step 1: 联网搜索该类型的爆火小说
    const searchClient = new SearchClient(config, customHeaders);
    let searchContext = "";
    try {
      const searchResult = await searchClient.advancedSearch(
        `2025年最火爆的${genre}类型网络小说 排行榜 爆款 经典作品 核心看点 读者最爱`,
        {
          searchType: "web",
          count: 8,
          needSummary: true,
          timeRange: "oneYear",
        }
      );
      const webItems = searchResult.web_items || [];
      searchContext = webItems
        .map((item: { title: string; snippet: string }) => `${item.title}: ${item.snippet}`)
        .join("\n");
      if (searchResult.summary) {
        searchContext = `【AI搜索摘要】${searchResult.summary}\n\n【具体作品信息】\n${searchContext}`;
      }
    } catch (searchErr) {
      console.warn("Search failed, proceeding without search context:", searchErr);
    }

    // Step 2: 构建 prompt，结合搜索结果和用户想法
    const ideaSection = userIdea && userIdea.trim()
      ? `\n## 用户的创意想法\n用户有以下想法，请融入创作中：\n${userIdea.trim()}\n`
      : "";

    const searchSection = searchContext
      ? `\n## 当前该类型爆火小说参考\n以下是当前网上最火的${genre || "热门"}类型小说信息，请分析它们的核心吸引力（爽点、套路、人设、世界观等），融入你的创作中：\n${searchContext}\n`
      : "";

    const continueSection = isContinued
      ? `\n## 续写任务\n以下是你已经创作了的内容，请继续往下写，保持风格和情节一致，不要重复已有内容：\n\n${previousContent}\n\n请从断点处继续写下去，添加新的情节发展。\n`
      : "";

    const genreLabel = genre || "热门";

    const systemPrompt = `你是一位才华横溢的小说家，擅长创作各类题材的精彩小说。

## 创作流程
1. 先分析当前爆火的${genreLabel}类型小说的核心要素（爽点、套路、人设、世界观、节奏等）
2. 结合这些核心要素，创作一篇全新的小说${userIdea ? "，同时融入用户的创意想法" : ""}
3. 确保作品既有当下爆款的吸引力，又有独特的创新

## 创作要求
1. 创作一篇全新的「${genreLabel}」类型小说
2. 有吸引人的标题${isContinued ? "（标题已在前文给出，不要重复）" : ""}
3. 开篇即入戏，迅速抓住读者注意力
4. 人物形象鲜明，对话生动自然
5. 情节有起伏，有转折，有悬念
6. **字数要求：约${targetWords}字**（请严格控制篇幅）
7. 画面感强，适合后续改编为漫画/动画
${searchSection}${ideaSection}${continueSection}
## 输出格式
${isContinued ? "（直接续写正文，无需标题和开头，从断点处继续）" : "# 《小说标题》\n\n（正文内容，适当分段，保持阅读节奏）\n\n---\n\n*（完）*"}`;

    // Step 3: 流式生成小说
    const client = new LLMClient(config, customHeaders);
    const messages = [
      { role: "system", content: systemPrompt } as const,
      {
        role: "user" as const,
        content: `请为我创作一篇「${genre}」类型的小说。要求：
1. 分析当前爆火作品的核心吸引力，融入创作中，写出既有爆款潜质又有创新的作品
2. 字数控制在${targetWords}字左右
3. **非常重要：故事必须有完整的起承转合和结局，不能仓促结尾。即使字数较少，也要有完整的故事弧线，开头→发展→高潮→结局，每个环节都要有**
4. 如果是分页续写（第${currentPage}页），请在上一页的基础上继续推进故事，并在本页结尾处留出悬念或阶段性结论
${userIdea ? `5. 我的想法是：${userIdea}` : ""}`,
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
      { success: false, error: "AI 生成服务暂时不可用" },
      { status: 500 }
    );
  }
}
