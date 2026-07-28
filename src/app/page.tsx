"use client";

import { useState, useCallback } from "react";
import GenreCards from "@/components/GenreCards";
import ScriptDisplay from "@/components/ScriptDisplay";
import LoadingAnimation from "@/components/LoadingAnimation";

type AppState =
  | "idle"
  | "searching"
  | "choosing"
  | "generating_novel"
  | "novel_preview"
  | "generating_script"
  | "done";

interface GenreItem {
  name: string;
  description: string;
}

const FALLBACK_GENRES: GenreItem[] = [
  { name: "都市爽文", description: "现代都市背景，主角逆袭崛起" },
  { name: "甜宠言情", description: "甜蜜恋爱，高糖互动" },
  { name: "悬疑推理", description: "烧脑推理，层层揭秘" },
  { name: "玄幻修仙", description: "仙道争锋，修炼成神" },
  { name: "穿越重生", description: "重回过去，改写命运" },
  { name: "无限流", description: "副本闯关，生死博弈" },
  { name: "末日废土", description: "废墟求生，重建文明" },
  { name: "古风权谋", description: "朝堂暗涌，步步为营" },
];

export default function Home() {
  const [state, setState] = useState<AppState>("idle");
  const [genres, setGenres] = useState<GenreItem[]>([]);
  const [selectedGenre, setSelectedGenre] = useState<string>("");
  const [novelContent, setNovelContent] = useState<string>("");
  const [scriptContent, setScriptContent] = useState<string>("");
  const [copied, setCopied] = useState(false);

  const handleSearchGenres = useCallback(async () => {
    setState("searching");
    try {
      const res = await fetch("/api/search-genres", { method: "POST" });
      const data = await res.json();

      if (data.success && data.results?.length > 0) {
        const extracted = extractGenres(data.results, data.summary);
        if (extracted.length >= 4) {
          setGenres(extracted.slice(0, 8));
        } else {
          setGenres(FALLBACK_GENRES);
        }
      } else {
        setGenres(FALLBACK_GENRES);
      }
      setState("choosing");
    } catch {
      setGenres(FALLBACK_GENRES);
      setState("choosing");
    }
  }, []);

  const handleSelectGenre = useCallback(async (genre: string) => {
    setSelectedGenre(genre);
    setNovelContent("");
    setScriptContent("");
    setState("generating_novel");

    try {
      const res = await fetch("/api/generate-novel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ genre }),
      });

      if (!res.ok || !res.body) {
        throw new Error("生成请求失败");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value, { stream: true });
        const lines = text.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const payload = line.slice(6).trim();
            if (payload === "[DONE]") continue;
            try {
              const parsed = JSON.parse(payload);
              if (parsed.content) {
                accumulated += parsed.content;
                setNovelContent(accumulated);
              }
            } catch {
              // skip malformed chunks
            }
          }
        }
      }

      setState("novel_preview");
    } catch {
      setNovelContent("生成小说时出现错误，请重试。");
      setState("novel_preview");
    }
  }, []);

  const handleApproveNovel = useCallback(async () => {
    setScriptContent("");
    setState("generating_script");

    try {
      const res = await fetch("/api/generate-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ genre: selectedGenre, novelContent }),
      });

      if (!res.ok || !res.body) {
        throw new Error("生成请求失败");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value, { stream: true });
        const lines = text.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const payload = line.slice(6).trim();
            if (payload === "[DONE]") continue;
            try {
              const parsed = JSON.parse(payload);
              if (parsed.content) {
                accumulated += parsed.content;
                setScriptContent(accumulated);
              }
            } catch {
              // skip malformed chunks
            }
          }
        }
      }

      setState("done");
    } catch {
      setScriptContent("生成剧本时出现错误，请重试。");
      setState("done");
    }
  }, [selectedGenre, novelContent]);

  const handleRejectNovel = useCallback(() => {
    setNovelContent("");
    setState("choosing");
  }, []);

  const handleCopy = useCallback(async () => {
    const text = state === "done" ? scriptContent : novelContent;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [scriptContent, novelContent, state]);

  const handleReset = useCallback(() => {
    setState("idle");
    setGenres([]);
    setSelectedGenre("");
    setNovelContent("");
    setScriptContent("");
    setCopied(false);
  }, []);

  return (
    <main className="min-h-screen" style={{ backgroundColor: "#FAFAF8" }}>
      <div className="mx-auto max-w-4xl px-6 py-16 md:py-24">
        {/* Header */}
        <header className="mb-16 text-center animate-fade-in-up">
          <h1
            className="text-3xl md:text-4xl font-bold tracking-tight mb-4"
            style={{ color: "#2C2C2C", fontFamily: "'Noto Serif SC', serif" }}
          >
            漫剧剧本工坊
          </h1>
          <p
            className="text-base md:text-lg leading-relaxed max-w-lg mx-auto"
            style={{ color: "#8A8A8A" }}
          >
            从热门题材到完整剧本，一键生成适合漫画与动画改编的小说剧本
          </p>
        </header>

        {/* Idle State */}
        {state === "idle" && (
          <div className="flex flex-col items-center animate-fade-in-up">
            <button
              onClick={handleSearchGenres}
              className="group relative px-10 py-4 rounded-lg text-base font-medium transition-all duration-300 cursor-pointer"
              style={{ backgroundColor: "#2C2C2C", color: "#FAFAF8" }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "#B8977E";
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow = "0 8px 24px rgba(184,151,126,0.25)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "#2C2C2C";
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              获取热门小说类型
            </button>
            <p className="mt-6 text-sm" style={{ color: "#8A8A8A" }}>
              点击按钮，联网搜索当前最火爆的小说题材
            </p>
          </div>
        )}

        {/* Searching State */}
        {state === "searching" && (
          <div className="flex flex-col items-center py-20 animate-fade-in">
            <LoadingAnimation />
            <p className="mt-8 text-base" style={{ color: "#8A8A8A" }}>
              正在搜索当前热门小说类型...
            </p>
          </div>
        )}

        {/* Choosing State */}
        {state === "choosing" && (
          <div className="animate-fade-in-up">
            <div className="text-center mb-10">
              <h2
                className="text-xl md:text-2xl font-semibold mb-2"
                style={{ color: "#2C2C2C", fontFamily: "'Noto Serif SC', serif" }}
              >
                选择你感兴趣的类型
              </h2>
              <p className="text-sm" style={{ color: "#8A8A8A" }}>
                点击类型卡片，先生成小说预览
              </p>
            </div>
            <GenreCards genres={genres} onSelect={handleSelectGenre} />
          </div>
        )}

        {/* Generating Novel State */}
        {state === "generating_novel" && (
          <div className="animate-fade-in">
            <div className="text-center mb-8">
              <p
                className="text-lg font-medium mb-1"
                style={{ color: "#2C2C2C", fontFamily: "'Noto Serif SC', serif" }}
              >
                正在创作「{selectedGenre}」小说
              </p>
              <p className="text-sm" style={{ color: "#8A8A8A" }}>
                AI 正在构思故事、人物与情节...
              </p>
            </div>
            <ScriptDisplay content={novelContent} isStreaming={true} />
          </div>
        )}

        {/* Novel Preview State - with approve/reject buttons */}
        {state === "novel_preview" && (
          <div className="animate-fade-in">
            {/* Action Buttons */}
            <div
              className="flex items-center justify-center gap-4 mb-8 p-5 rounded-lg"
              style={{ backgroundColor: "#F5F3EF", border: "1px solid #E8E4DE" }}
            >
              <button
                onClick={handleRejectNovel}
                className="px-6 py-2.5 rounded-md text-sm font-medium transition-all duration-200 cursor-pointer"
                style={{
                  backgroundColor: "#FEE2E2",
                  color: "#DC2626",
                  border: "1px solid #FECACA",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "#DC2626";
                  e.currentTarget.style.color = "#FFFFFF";
                  e.currentTarget.style.borderColor = "#DC2626";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "#FEE2E2";
                  e.currentTarget.style.color = "#DC2626";
                  e.currentTarget.style.borderColor = "#FECACA";
                }}
              >
                不满意，换一个
              </button>
              <button
                onClick={handleApproveNovel}
                className="px-6 py-2.5 rounded-md text-sm font-medium transition-all duration-200 cursor-pointer"
                style={{
                  backgroundColor: "#DCFCE7",
                  color: "#16A34A",
                  border: "1px solid #BBF7D0",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "#16A34A";
                  e.currentTarget.style.color = "#FFFFFF";
                  e.currentTarget.style.borderColor = "#16A34A";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "#DCFCE7";
                  e.currentTarget.style.color = "#16A34A";
                  e.currentTarget.style.borderColor = "#BBF7D0";
                }}
              >
                满意，生成剧本
              </button>
            </div>

            {/* Novel Content */}
            <div className="mb-4">
              <h2
                className="text-lg font-semibold mb-1"
                style={{ color: "#2C2C2C", fontFamily: "'Noto Serif SC', serif" }}
              >
                「{selectedGenre}」小说预览
              </h2>
              <p className="text-xs mb-4" style={{ color: "#8A8A8A" }}>
                阅读上方小说内容，满意请点击绿色按钮生成剧本，不满意点击红色按钮重新生成
              </p>
            </div>
            <ScriptDisplay content={novelContent} isStreaming={false} />
          </div>
        )}

        {/* Generating Script State */}
        {state === "generating_script" && (
          <div className="animate-fade-in">
            <div className="text-center mb-8">
              <p
                className="text-lg font-medium mb-1"
                style={{ color: "#2C2C2C", fontFamily: "'Noto Serif SC', serif" }}
              >
                正在基于小说生成「{selectedGenre}」剧本
              </p>
              <p className="text-sm" style={{ color: "#8A8A8A" }}>
                AI 正在改编分镜、设计场景与对话...
              </p>
            </div>
            <ScriptDisplay content={scriptContent} isStreaming={true} />
          </div>
        )}

        {/* Done State - Script Complete */}
        {state === "done" && (
          <div className="animate-fade-in">
            <div className="flex items-center justify-between mb-6">
              <h2
                className="text-lg font-semibold"
                style={{ color: "#2C2C2C", fontFamily: "'Noto Serif SC', serif" }}
              >
                「{selectedGenre}」漫剧剧本
              </h2>
              <div className="flex gap-3">
                <button
                  onClick={handleCopy}
                  className="px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 cursor-pointer"
                  style={{
                    backgroundColor: copied ? "#B8977E" : "#F5F3EF",
                    color: copied ? "#FAFAF8" : "#2C2C2C",
                    border: "1px solid #E8E4DE",
                  }}
                >
                  {copied ? "已复制" : "复制全文"}
                </button>
                <button
                  onClick={handleReset}
                  className="px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 cursor-pointer"
                  style={{ backgroundColor: "#2C2C2C", color: "#FAFAF8" }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "#B8977E";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "#2C2C2C";
                  }}
                >
                  重新开始
                </button>
              </div>
            </div>
            <ScriptDisplay content={scriptContent} isStreaming={false} />
          </div>
        )}
      </div>
    </main>
  );
}

function extractGenres(
  results: Array<{ title: string; snippet: string; summary?: string }>,
  summary: string
): GenreItem[] {
  const combined = summary + " " + results.map((r) => r.title + " " + r.snippet).join(" ");

  const genrePatterns: Array<{ name: string; description: string; keywords: string[] }> = [
    { name: "都市爽文", description: "现代都市背景，主角逆袭崛起", keywords: ["都市", "爽文", "逆袭", "重生都市", "都市修真"] },
    { name: "甜宠言情", description: "甜蜜恋爱，高糖互动", keywords: ["甜宠", "言情", "恋爱", "总裁", "校园恋爱", "高甜"] },
    { name: "悬疑推理", description: "烧脑推理，层层揭秘", keywords: ["悬疑", "推理", "侦探", "破案", "烧脑"] },
    { name: "玄幻修仙", description: "仙道争锋，修炼成神", keywords: ["玄幻", "修仙", "仙侠", "修真", "斗气"] },
    { name: "穿越重生", description: "重回过去，改写命运", keywords: ["穿越", "重生", "重生文", "回到过去", "穿书"] },
    { name: "无限流", description: "副本闯关，生死博弈", keywords: ["无限流", "副本", "闯关", "任务", "生存游戏"] },
    { name: "末日废土", description: "废墟求生，重建文明", keywords: ["末日", "废土", "丧尸", "求生", "末世"] },
    { name: "古风权谋", description: "朝堂暗涌，步步为营", keywords: ["古风", "权谋", "宫斗", "宅斗", "朝堂", "古代"] },
    { name: "科幻星际", description: "星际探索，未来科技", keywords: ["科幻", "星际", "未来", "机甲", "赛博"] },
    { name: "灵异惊悚", description: "诡异事件，心跳加速", keywords: ["灵异", "惊悚", "恐怖", "鬼怪", "诡异"] },
    { name: "游戏竞技", description: "电竞热血，荣耀征途", keywords: ["游戏", "电竞", "网游", "竞技", "荣耀"] },
    { name: "历史架空", description: "架空朝代，风云变幻", keywords: ["历史", "架空", "三国", "争霸", "乱世"] },
  ];

  const matched: GenreItem[] = [];
  for (const pattern of genrePatterns) {
    const found = pattern.keywords.some((kw) => combined.includes(kw));
    if (found) {
      matched.push({ name: pattern.name, description: pattern.description });
    }
  }

  return matched;
}
