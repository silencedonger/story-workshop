import { NextRequest, NextResponse } from "next/server";
import { SearchClient, Config, HeaderUtils } from "coze-coding-dev-sdk";

export async function POST(request: NextRequest) {
  try {
    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const config = new Config();
    const client = new SearchClient(config, customHeaders);

    const response = await client.webSearch(
      "2024 2025 最火爆热门小说类型 题材 排行榜 网文 流行趋势",
      10,
      true
    );

    const searchResults = response.web_items?.map((item) => ({
      title: item.title,
      snippet: item.snippet,
      summary: item.summary,
    })) || [];

    return NextResponse.json({
      success: true,
      summary: response.summary || "",
      results: searchResults,
    });
  } catch (error) {
    console.error("Search genres error:", error);
    return NextResponse.json(
      { success: false, error: "搜索热门小说类型失败" },
      { status: 500 }
    );
  }
}
