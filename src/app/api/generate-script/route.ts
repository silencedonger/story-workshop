import { NextRequest, NextResponse } from "next/server";

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
    const { genre, novelContent } = await request.json();

    if (!genre || typeof genre !== "string") {
      return NextResponse.json(
        { success: false, error: "请提供小说类型" },
        { status: 400 }
      );
    }

    const systemPrompt = `你是一位经验丰富的漫剧编剧，擅长将小说改编为适合漫画/动画拍摄的剧本。

## 改编要求
1. 基于用户提供的小说内容，改编为漫剧剧本格式
2. 保持原作的核心情节和人物设定
3. 增加分镜描述、场景构图建议
4. 标注镜头语言（远景、近景、特写等）
5. 对话简洁有力，适合配音

## 输出格式

# 《剧本标题》

## 一、作品概述
- 类型：${genre}
- 改编自：用户提供的小说

## 二、人物设定
- 主角：（姓名、性格、外貌描述）
- 配角：（姓名、与主角关系、特点）

## 三、分集剧本

### 第1集：集名
**场景：**（时间、地点、环境描述）
**分镜：**（镜头建议、画面构图）
**对白/动作：**（角色对话和动作指示）
`;

    // 如果提供了小说内容，组装用户消息
    const userMessage = novelContent
      ? `以下是我创作的小说内容，请将其改编为漫剧剧本：\n\n${novelContent}`
      : `请根据「${genre}」类型，创作一部完整的漫剧剧本，包含标题、人物设定、故事大纲和至少3集的分镜剧本内容。`;

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
              { role: "user", content: userMessage },
            ],
            stream: true,
            temperature: 0.85,
            max_tokens: 8192,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(
            `${provider.name} API error: ${response.status} ${errorText}`
          );
          continue;
        }

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
        continue;
      }
    }

    return NextResponse.json(
      {
        success: false,
        error:
          "所有 AI 生成服务均不可用，请检查 API Key 是否有效或余额是否充足",
      },
      { status: 502 }
    );
  } catch (error) {
    console.error("Generate script error:", error);
    return NextResponse.json(
      { success: false, error: "生成剧本时出现错误，请重试" },
      { status: 500 }
    );
  }
}