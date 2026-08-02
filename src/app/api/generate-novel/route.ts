import { NextRequest, NextResponse } from "next/server";

// 支持的 AI 平台配置
const AI_PROVIDERS = [
  {
    name: "通义千问",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    model: "qwen-max",
    apiKey: process.env.QWEN_API_KEY || "",
  },
  {
    name: "DeepSeek",
    baseUrl: "https://api.deepseek.com/v1",
    model: "deepseek-chat",
    apiKey: process.env.DEEPSEEK_API_KEY || "",
  },
  {
    name: "智谱清言",
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    model: "glm-4-flash",
    apiKey: process.env.ZHIPU_API_KEY || "",
  },
];

function getAvailableProviders() {
  return AI_PROVIDERS.filter((p) => p.apiKey);
}

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

    const providers = getAvailableProviders();
    if (providers.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "未配置 API Key，请先注册任意平台的免费 API Key",
        },
        { status: 400 }
      );
    }

    // 逐个尝试可用的平台
    for (const provider of providers) {
      try {
        const response = await fetch(`${provider.baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${provider.apiKey}`,
          },
          body: JSON.stringify({
            model: provider.model,
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
          const errorText = await response.text();
          console.error(
            `${provider.name} API error: ${response.status} ${errorText}`
          );
          continue; // 尝试下一个平台
        }

        // 成功！返回流式响应
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          async start(controller) {
            const reader = response.body?.getReader();
            if (!reader) {
              controller.close();
              return;
            }
            try {
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                controller.enqueue(value);
              }
            } catch (e) {
              console.error("Stream error:", e);
            } finally {
              reader.releaseLock();
              controller.close();
            }
          },
        });

        return new Response(stream, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
            "X-AI-Provider": provider.name,
          },
        });
      } catch (e) {
        console.error(`${provider.name} 请求失败:`, e);
        continue; // 尝试下一个平台
      }
    }

    // 所有平台都失败了
    return NextResponse.json(
      {
        success: false,
        error:
          "所有 AI 生成服务均不可用，请检查 API Key 是否有效或余额是否充足",
      },
      { status: 502 }
    );
  } catch (error) {
    console.error("Generate novel error:", error);
    return NextResponse.json(
      { success: false, error: "生成小说时出现错误，请重试" },
      { status: 500 }
    );
  }
}