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

    // 并行搜索多个维度的热门小说
    const [hotResult, risingResult, newHitResult] = await Promise.allSettled([
      searchClient.advancedSearch(
        "2025年最火爆最热门的网络小说排行榜 爆款小说推荐 起点 番茄小说 晋江",
        { searchType: "web", count: 8, needSummary: true, timeRange: "oneYear" }
      ),
      searchClient.advancedSearch(
        "2025年上升最快 黑马 新锐网络小说 读者增长最快 口碑爆棚 小说推荐",
        { searchType: "web", count: 6, needSummary: true, timeRange: "threeMonths" }
      ),
      searchClient.advancedSearch(
        "2025年新书 刚发布就爆火 热门新作 新晋热门小说 起点 番茄 晋江新书榜",
        { searchType: "web", count: 6, needSummary: true, timeRange: "oneMonth" }
      ),
    ]);

    // 合并搜索结果
    const allSnippets: string[] = [];
    const addItems = (result: any) => {
      if (result.status === "fulfilled" && result.value?.web_items) {
        result.value.web_items.forEach((item: any) => {
          allSnippets.push(`标题: ${item.title}\n简介: ${item.snippet || ''}`);
        });
      }
    };
    addItems(hotResult);
    addItems(risingResult);
    addItems(newHitResult);

    // 去重
    const uniqueSnippets = [...new Set(allSnippets)];

    let trendingNovels: any[] = [];

    if (uniqueSnippets.length > 0) {
      // 用 LLM 生成详细分析
      const llmClient = new LLMClient(config, forwardHeaders);
      const analysisPrompt = `你是一个专业的网文分析师。以下是当前网络上多个维度搜索到的热门小说信息（包含热门榜、上升榜、新书榜）。

请从这些信息中精选出 6-8 部最值得关注的小说，覆盖以下类型：
- 长期霸榜的经典热门
- 近期飞速上升的黑马
- 刚发布就爆火的新作

对每部小说，写一篇 **800字以上的详细分析报告**，包含以下所有维度：

{
  "title": "小说名称",
  "author": "作者名",
  "category": "所属分类（如：火爆经典/上升黑马/新晋爆款）",
  "summary": "完整小说简介（200-300字）",
  "characters": "主角及重要人物设定（200-300字，包括性格、背景、成长弧线）",
  "whyPopular": "爆火原因深度分析（300-500字，包括剧情亮点、读者共鸣点、创新之处）",
  "learnFrom": "创作者可借鉴的写作技巧（300-500字，包括叙事结构、人物塑造、节奏把控等）",
  "detail": "综合深度分析报告（800字以上，包含：作品背景、剧情亮点、人物魅力、市场反响、创作启示等全方位分析。用流畅的段落文字写，不要只是列点。语言生动有洞察力，读起来像一篇专业的文学评论。）"
}

要求：
1. 信息必须基于搜索结果，合理分析，不要编造不存在的小说
2. 覆盖热门、上升、新作三个维度
3. 每篇 detail 必须 800 字以上，语言流畅有深度
4. 返回一个 JSON 数组，不要加多余文字

搜索结果：
${uniqueSnippets.slice(0, 18).join("\n\n---\n\n")}`;

      const analysisResult = await llmClient.invoke(
        [{ role: "user", content: analysisPrompt }],
        { model: "doubao-seed-1-8-251228", temperature: 0.3 }
      );

      try {
        const content = String(analysisResult.content || '');
        const jsonMatch = content.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          trendingNovels = JSON.parse(jsonMatch[0]);
        }
      } catch (parseErr) {
        console.warn("Failed to parse LLM analysis:", parseErr);
      }
    }

    // 降级方案
    if (trendingNovels.length === 0) {
      trendingNovels = [
        { title: "宿命之环", author: "爱潜水的乌贼", category: "火爆经典",
          summary: "《诡秘之主》正统续作，延续了乌贼一贯的宏大世界观和深刻哲学思辨。",
          characters: "主角团队：各具特色的角色群像，每个人物都有独立的成长线和命运轨迹。",
          whyPopular: "乌贼的体系化世界观构建堪称网文标杆，哲学深度与娱乐性完美平衡。",
          learnFrom: "层层递进的世界观揭秘手法，让读者始终保持探索欲。",
          detail: "这是一篇关于《宿命之环》的深度分析报告。\n\n（此处省略800字详细分析...）"},
      ];
    }

    return NextResponse.json({
      success: true,
      genres: BUILTIN_GENRES,
      trending: trendingNovels,
      summary: "",
      searchContext: trendingNovels.map((n: any) =>
        `${n.title}(作者:${n.author}): ${(n.summary || '').slice(0, 100)}`
      ).join("\n"),
    });
  } catch (error) {
    console.warn("Search failed, using fallback data:", error);
    return NextResponse.json({
      success: true,
      genres: BUILTIN_GENRES,
      trending: [],
      searchContext: "",
    });
  }
}