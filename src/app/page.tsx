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

const WORD_COUNT_OPTIONS = [
  { label: "短篇", value: 1000, desc: "约1000字" },
  { label: "中篇", value: 2000, desc: "约2000字" },
  { label: "长篇", value: 3000, desc: "约3000字" },
  { label: "超长", value: 5000, desc: "约5000字" },
  { label: "巨篇", value: 8000, desc: "约8000字" },
  { label: "史诗", value: 12000, desc: "约12000字" },
  { label: "自定义", value: 0, desc: "自定义字数" },
];

export default function Home() {
  const [state, setState] = useState<AppState>("idle");
  const [genres, setGenres] = useState<GenreItem[]>([]);
  const [selectedGenre, setSelectedGenre] = useState<string>("");
  const [wordCount, setWordCount] = useState<number>(2000);
  const [customWordCount, setCustomWordCount] = useState<string>("");
  const [generatedContent, setGeneratedContent] = useState<string>("");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [isGeneratingMore, setIsGeneratingMore] = useState<boolean>(false);
  const [isCustomWordCount, setIsCustomWordCount] = useState(false);
  const [novelContent, setNovelContent] = useState<string>("");
  const [scriptContent, setScriptContent] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [userIdea, setUserIdea] = useState<string>("");

  const handleSearchGenres = useCallback(async () => {
    setState("searching");
    try {
      const res = await fetch("/api/search-genres", { method: "POST" });
      const data = await res.json();

      if (data.success && data.results?.length > 0) {
        const mapped = data.results.map((item: { title: string; snippet: string }) => ({
          name: item.title,
          description: item.snippet,
        }));
        setGenres(mapped.slice(0, 8));
      } else {
        setGenres([]);
      }
      setState("choosing");
    } catch {
      setGenres([]);
      setState("choosing");
    }
  }, []);

  const handleDirectGenerate = useCallback(async () => {
    if (!userIdea.trim() || state !== "choosing") return;
    setSelectedGenre(userIdea.trim().slice(0, 50));
    setState("generating_novel");
    setNovelContent("");
    setCurrentPage(1);
    setIsGeneratingMore(false);

    try {
      const res = await fetch("/api/generate-novel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          genre: "自定义创作",
          wordCount: wordCount,
          userIdea: userIdea.trim(),
          page: 1,
        }),
      });

      if (!res.ok) {
        setState("choosing");
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) return;

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") continue;

          try {
            const parsed = JSON.parse(data);
            if (parsed.error) {
              throw new Error(parsed.error);
            }
            if (parsed.content) {
              setNovelContent((prev) => prev + parsed.content);
            }
          } catch {
            // ignore parse errors
          }
        }
      }

      setState("novel_preview");
    } catch {
      setState("choosing");
    }
  }, [userIdea, state, wordCount]);

  const handleContinueGenerate = useCallback(async () => {
    const nextPage = currentPage + 1;
    setCurrentPage(nextPage);
    setIsGeneratingMore(true);
    setState("generating_novel");

    try {
      const res = await fetch("/api/generate-novel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          genre: selectedGenre || "自定义创作",
          wordCount: wordCount,
          userIdea: userIdea,
          page: nextPage,
          previousContent: novelContent,
        }),
      });

      if (!res.ok) {
        setState("novel_preview");
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) return;

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") continue;

          try {
            const parsed = JSON.parse(data);
            if (parsed.error) throw new Error(parsed.error);
            if (parsed.content) {
              setNovelContent((prev) => prev + parsed.content);
            }
          } catch {
            // ignore
          }
        }
      }

      setState("novel_preview");
      setIsGeneratingMore(false);
    } catch {
      setState("novel_preview");
      setIsGeneratingMore(false);
    }
  }, [selectedGenre, wordCount, userIdea, currentPage, novelContent]);

  const handleSelectGenre = useCallback(async (genre: string) => {
    setSelectedGenre(genre);
    setNovelContent("");
    setScriptContent("");
    setState("generating_novel");

    const finalWordCount = isCustomWordCount ? (parseInt(customWordCount, 10) || 2000) : wordCount;

    try {
      const res = await fetch("/api/generate-novel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ genre, wordCount: finalWordCount, userIdea }),
      });

      if (!res.ok || !res.body) {
        throw new Error("生成请求失败");
      }

      setState("generating_novel");

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
    setWordCount(2000);
    setCustomWordCount("");
    setIsCustomWordCount(false);
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
                先设置小说字数，再点击类型卡片生成
              </p>
            </div>

            {/* Word Count Selector */}
            <div className="mb-8">
              <p
                className="text-sm font-medium mb-3 text-center"
                style={{ color: "#2C2C2C" }}
              >
                小说字数
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                {WORD_COUNT_OPTIONS.map((option) => {
                  const isSelected = option.value === 0
                    ? isCustomWordCount
                    : !isCustomWordCount && wordCount === option.value;

                  return (
                    <button
                      key={option.label}
                      onClick={() => {
                        if (option.value === 0) {
                          setIsCustomWordCount(true);
                        } else {
                          setIsCustomWordCount(false);
                          setWordCount(option.value);
                        }
                      }}
                      className="px-5 py-2.5 rounded-md text-sm transition-all duration-200 cursor-pointer"
                      style={{
                        backgroundColor: isSelected ? "#2C2C2C" : "#F5F3EF",
                        color: isSelected ? "#FAFAF8" : "#2C2C2C",
                        border: `1px solid ${isSelected ? "#2C2C2C" : "#E8E4DE"}`,
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.borderColor = "#B8977E";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.borderColor = "#E8E4DE";
                        }
                      }}
                    >
                      <span className="font-medium">{option.label}</span>
                      <span
                        className="ml-1.5 text-xs"
                        style={{
                          color: isSelected ? "#B8B8B8" : "#8A8A8A",
                        }}
                      >
                        {option.desc}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Custom Word Count Input */}
              {isCustomWordCount && (
                <div className="mt-4 flex justify-center animate-fade-in">
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={customWordCount}
                      onChange={(e) => setCustomWordCount(e.target.value)}
                      placeholder="输入字数"
                      min="500"
                      max="20000"
                      className="w-32 px-4 py-2 rounded-md text-sm text-center outline-none transition-all duration-200"
                      style={{
                        backgroundColor: "#F5F3EF",
                        border: "1px solid #E8E4DE",
                        color: "#2C2C2C",
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = "#B8977E";
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = "#E8E4DE";
                      }}
                    />
                    <span className="text-sm" style={{ color: "#8A8A8A" }}>
                      字（500-20000）
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* User Idea Input */}
            <div className="mb-8 max-w-2xl mx-auto">
              <p
                className="text-sm font-medium mb-3 text-center"
                style={{ color: "#2C2C2C" }}
              >
                你的创意想法（选填）
              </p>
              <textarea
                value={userIdea}
                onChange={(e) => setUserIdea(e.target.value)}
                placeholder="写下你的想法，比如：主角是一个失忆的杀手，穿越到古代发现自己是预言中的救世主... 不填则 AI 自由创作"
                rows={4}
                className="w-full px-4 py-3 rounded-md text-sm resize-none outline-none transition-all duration-200"
                style={{
                  backgroundColor: "#F5F3EF",
                  border: "1px solid #E8E4DE",
                  color: "#2C2C2C",
                  lineHeight: "1.6",
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "#B8977E";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "#E8E4DE";
                }}
              />
              <div className="flex items-center justify-between mt-3">
                <p className="text-xs" style={{ color: "#8A8A8A" }}>
                  {userIdea.length} 字，不限字数
                </p>
                <button
                  onClick={handleDirectGenerate}
                  disabled={!userIdea.trim()}
                  className="px-5 py-2 rounded-md text-sm font-medium transition-all duration-200 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{
                    backgroundColor: "#B8977E",
                    color: "#FAFAF8",
                    border: "none",
                  }}
                  onMouseEnter={(e) => {
                    if (userIdea.trim()) {
                      e.currentTarget.style.backgroundColor = "#A6826A";
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "#B8977E";
                  }}
                >
                  直接生成
                </button>
              </div>
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
                正在联网搜索爆火小说，解析核心要素...
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
              {/* 继续生成按钮 */}
              <button
                onClick={handleContinueGenerate}
                className="px-6 py-2.5 rounded-md text-sm font-medium transition-all duration-200 cursor-pointer"
                style={{
                  backgroundColor: "#FEF3C7",
                  color: "#D97706",
                  border: "1px solid #FDE68A",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "#D97706";
                  e.currentTarget.style.color = "#FFFFFF";
                  e.currentTarget.style.borderColor = "#D97706";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "#FEF3C7";
                  e.currentTarget.style.color = "#D97706";
                  e.currentTarget.style.borderColor = "#FDE68A";
                }}
              >
                继续生成（第{currentPage}页）
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
                  onClick={handleContinueGenerate}
                  className="px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 cursor-pointer"
                  style={{
                    backgroundColor: "#FEF3C7",
                    color: "#D97706",
                    border: "1px solid #FDE68A",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "#D97706";
                    e.currentTarget.style.color = "#FFFFFF";
                    e.currentTarget.style.borderColor = "#D97706";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "#FEF3C7";
                    e.currentTarget.style.color = "#D97706";
                    e.currentTarget.style.borderColor = "#FDE68A";
                  }}
                >
                  继续生成剧本（第{currentPage}页）
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


