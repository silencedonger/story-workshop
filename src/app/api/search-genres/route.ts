import { NextRequest, NextResponse } from "next/server";
import { Config, SearchClient, HeaderUtils } from "coze-coding-dev-sdk";

// 内置的热门小说类型（降级方案）
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
      "2025年最火爆最热门的网络小说排行榜 爆款小说推荐 起点 番茄小说 晋江",
      {
        searchType: "web",
        count: 10,
        needSummary: true,
        timeRange: "oneYear",
      }
    );

    // 提取搜索结果中的小说信息
    const webItems = searchResult.web_items || [];
    const searchContext = webItems
      .map((item: { title: string; snippet: string }) => `${item.title}: ${item.snippet}`)
      .join("\n");

    // 返回搜索结果和摘要，前端展示
    const results = webItems.slice(0, 8).map((item: { title: string; snippet: string }) => ({
      title: item.title,
      snippet: item.snippet.slice(0, 120),
    }));

    return NextResponse.json({
      success: true,
      summary: searchResult.summary || "",
      results,
      searchContext,
    });
  } catch (error) {
    // 搜索失败时返回内置数据
    console.error("Search error, using fallback:", error);
    return NextResponse.json({
      success: true,
      summary: "",
      results: BUILTIN_GENRES,
      searchContext: "",
      fallback: true,
    });
  }
}
