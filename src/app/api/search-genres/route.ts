import { NextRequest, NextResponse } from "next/server";
import { Config, SearchClient, LLMClient, HeaderUtils } from "coze-coding-dev-sdk";

// 内置的热门小说类型（始终显示在中间）
const BUILTIN_GENRES = [
  { title: "都市爽文", snippet: "底层逆袭、商业对决、强者归来，快节奏高爽点，都市背景下的热血传奇。", tags: ["逆袭", "商战", "强者归来"] },
  { title: "甜宠言情", snippet: "甜甜的恋爱、命中注定的相遇，温暖治愈的情感故事，让人心动不已。", tags: ["恋爱", "治愈", "日常"] },
  { title: "悬疑推理", snippet: "烧脑谜案、层层反转，每一个细节都暗藏玄机，真相永远在意料之外。", tags: ["烧脑", "反转", "破案"] },
  { title: "玄幻修仙", snippet: "修仙问道、逆天改命，浩瀚仙侠世界中的传奇冒险，一念成仙一念成魔。", tags: ["修仙", "仙侠", "冒险"] },
  { title: "穿越重生", snippet: "重回过去、改变命运，带着前世记忆重新活一次，这一世绝不重蹈覆辙。", tags: ["穿越", "重生", "逆天改命"] },
  { title: "无限流", snippet: "穿梭于各个副本世界，完成任务获取积分，在生死边缘突破极限。", tags: ["副本", "生存", "升级"] },
  { title: "科幻末世", snippet: "末日降临、文明崩塌，在废墟中寻找希望，人类最后的挣扎与觉醒。", tags: ["末日", "生存", "进化"] },
  { title: "古风权谋", snippet: "朝堂暗涌、步步为营，在权力漩涡中运筹帷幄，一统天下。", tags: ["权谋", "宫斗", "天下"] },
];

export async function POST(request: NextRequest) {
  try {
    const config = new Config();
    const forwardHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const searchClient = new SearchClient(config, forwardHeaders);

    // 联网搜索当前最火爆的小说
    const searchResult = await searchClient.advancedSearch(
      "2025年最火爆最热门的网络小说排行榜 爆款小说推荐 起点 番茄小说 晋江 连载 完结",
      {
        searchType: "web",
        count: 12,
        needSummary: true,
        timeRange: "oneYear",
      }
    );

    let trendingNovels: any[] = [];
    const webItems = searchResult.web_items || [];
    const rawSnippets = webItems.slice(0, 10).map((item: { title: string; snippet: string }) => 
      `标题: ${item.title}\n简介: ${item.snippet}`
    ).join("\n\n---\n\n");

    if (rawSnippets) {
      // 用 LLM 分析搜索结果，提取结构化信息
      const llmClient = new LLMClient(config, forwardHeaders);
      const analysisPrompt = `你是一个网文分析师。以下是当前网络上的热门小说搜索结果，请分析并提取出最值得关注的 6-8 部热门小说信息。

对每部小说，提取以下信息（JSON格式）：
{
  "title": "小说名称",
  "author": "作者名",
  "summary": "小说简介（50字以内）",
  "characters": "主角和主要人物设定（30字以内）",
  "whyPopular": "爆火原因分析（30字以内）",
  "learnFrom": "可借鉴的创作点（20字以内）"
}

要求：
1. 只选取真正火爆、有热度的作品
2. 已完结和连载中的都可以
3. 信息必须来自搜索结果，不要编造
4. 返回一个 JSON 数组，不要加多余文字

搜索结果：
${rawSnippets}`;

      const analysisResult = await llmClient.invoke(
        [{ role: "user", content: analysisPrompt }],
        { model: "doubao-seed-1-8-251228", temperature: 0.3 }
      );

      try {
        const content = String(analysisResult.content || '');
        // 尝试从返回内容中提取 JSON
        const jsonMatch = content.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          trendingNovels = JSON.parse(jsonMatch[0]);
        }
      } catch (parseErr) {
        console.warn("Failed to parse LLM analysis:", parseErr);
      }
    }

    // 如果 LLM 分析失败，降级为原始搜索结果
    if (trendingNovels.length === 0) {
      trendingNovels = webItems.slice(0, 8).map((item: { title: string; snippet: string }) => ({
        title: item.title,
        author: "未知",
        summary: item.snippet.slice(0, 80),
        characters: "未知",
        whyPopular: "热门搜索推荐",
        learnFrom: "关注其写作风格和叙事节奏",
      }));
    }

    return NextResponse.json({
      success: true,
      genres: BUILTIN_GENRES,           // 中间展示的8个类型
      trending: trendingNovels,          // 侧边栏展示的热门小说（含详细信息）
      summary: searchResult.summary || "",
      searchContext: trendingNovels.map((n: any) => 
        `${n.title}(作者:${n.author}): ${n.summary} | 爆火原因:${n.whyPopular} | 可借鉴:${n.learnFrom}`
      ).join("\n"),
    });
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json({
      success: true,
      genres: BUILTIN_GENRES,
      trending: [],
      summary: "",
      searchContext: "",
      fallback: true,
    });
  }
}