"use client";

import { useState, useCallback, useEffect } from "react";
import GenreCards from "@/components/GenreCards";
import ScriptDisplay from "@/components/ScriptDisplay";
import LoadingAnimation from "@/components/LoadingAnimation";

type AppState =
  | "choosing"
  | "generating_novel"
  | "novel_preview"
  | "generating_script"
  | "done";

interface TrendingItem {
  title: string;
  author: string;
  snippet: string;
  summary: string;
  characters: string;
  whyPopular: string;
  learnFrom: string;
}

interface GenreItem {
  name: string;
  description: string;
}

export default function Home() {
  const [state, setState] = useState<AppState>("choosing");
  const [genres, setGenres] = useState<GenreItem[]>([]);
  const [selectedGenre, setSelectedGenre] = useState<string>("");
  const [novelContent, setNovelContent] = useState<string>("");
  const [scriptContent, setScriptContent] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [userIdea, setUserIdea] = useState<string>("");
  const [wordCount, setWordCount] = useState<number>(2000);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [isGeneratingMore, setIsGeneratingMore] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [trending, setTrending] = useState<TrendingItem[]>([]);
  const [selectedTrending, setSelectedTrending] = useState<TrendingItem | null>(null);

  // 字数选项
  const WORD_COUNT_OPTIONS = [
    { label: "短篇", value: 1000 },
    { label: "中篇", value: 2000 },
    { label: "长篇", value: 3000 },
    { label: "超长", value: 5000 },
    { label: "巨篇", value: 8000 },
  ];

  // 页面加载时自动获取热门类型 + 搜索热门小说
  useEffect(() => {
    fetch("/api/search-genres", { method: "POST" })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          if (data.genres?.length > 0) {
            setGenres(
              data.genres.map((item: { title: string; snippet: string }) => ({
                name: item.title,
                description: item.snippet,
              }))
            );
          }
          if (data.trending?.length > 0) {
            setTrending(data.trending);
          }
        }
      })
      .catch(() => {});
  }, []);

  const streamNovel = useCallback(
    async (page: number, previousContent: string, genreOverride?: string, ideaOverride?: string) => {
      setError("");
      try {
        const res = await fetch("/api/generate-novel", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            genre: genreOverride || selectedGenre || "自定义创作",
            userIdea: (ideaOverride ?? userIdea).trim() || undefined,
            wordCount,
            page,
            previousContent: previousContent || undefined,
          }),
        });

        if (!res.ok) {
          setError("生成失败，请重试");
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
                setError(parsed.error);
                setState("choosing");
                return;
              }
              if (parsed.content) {
                setNovelContent((prev) => prev + parsed.content);
              }
            } catch {
              // ignore
            }
          }
        }

        setState("novel_preview");
      } catch {
        setError("生成失败，请重试");
        setState("choosing");
      }
    },
    [selectedGenre, userIdea, wordCount]
  );

  // 选择类型后生成小说
  const handleSelectGenre = useCallback(
    async (genre: string) => {
      setSelectedGenre(genre);
      setNovelContent("");
      setScriptContent("");
      setCurrentPage(1);
      setIsGeneratingMore(false);
      setState("generating_novel");
      await streamNovel(1, "", genre, userIdea);
    },
    [streamNovel, userIdea]
  );

  // 直接生成（跳过选类型，用想法生成）
  const handleDirectGenerate = useCallback(async () => {
    if (!userIdea.trim()) return;
    setSelectedGenre("自定义创作");
    setNovelContent("");
    setScriptContent("");
    setCurrentPage(1);
    setIsGeneratingMore(false);
    setState("generating_novel");
    await streamNovel(1, "", "自定义创作", userIdea);
  }, [userIdea, streamNovel]);

  // 继续生成（无限续写）
  const handleContinueGenerate = useCallback(async () => {
    const nextPage = currentPage + 1;
    setCurrentPage(nextPage);
    setIsGeneratingMore(true);
    setState("generating_novel");
    await streamNovel(nextPage, novelContent, selectedGenre, userIdea);
    setIsGeneratingMore(false);
  }, [currentPage, novelContent, streamNovel, selectedGenre, userIdea]);

  // 生成剧本
  const handleGenerateScript = useCallback(async () => {
    setScriptContent("");
    setCurrentPage(1);
    setIsGeneratingMore(false);
    setState("generating_script");

    try {
      const res = await fetch("/api/generate-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          genre: selectedGenre || "自定义创作",
          novelContent: novelContent,
          page: 1,
        }),
      });

      if (!res.ok) {
        setError("剧本生成失败");
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
            if (parsed.error) {
              setError(parsed.error);
              setState("novel_preview");
              return;
            }
            if (parsed.content) {
              setScriptContent((prev) => prev + parsed.content);
            }
          } catch {
            // ignore
          }
        }
      }

      setState("done");
    } catch {
      setError("剧本生成失败");
      setState("novel_preview");
    }
  }, [selectedGenre, novelContent]);

  // 继续生成剧本
  const handleContinueScript = useCallback(async () => {
    const nextPage = currentPage + 1;
    setCurrentPage(nextPage);
    setIsGeneratingMore(true);
    setState("generating_script");

    try {
      const res = await fetch("/api/generate-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          genre: selectedGenre || "自定义创作",
          novelContent: novelContent,
          previousScript: scriptContent,
          page: nextPage,
        }),
      });

      if (!res.ok) {
        setError("剧本生成失败");
        setState("done");
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
              setError(parsed.error);
              setState("done");
              return;
            }
            if (parsed.content) {
              setScriptContent((prev) => prev + parsed.content);
            }
          } catch {
            // ignore
          }
        }
      }

      setState("done");
      setIsGeneratingMore(false);
    } catch {
      setState("done");
      setIsGeneratingMore(false);
    }
  }, [selectedGenre, novelContent, scriptContent, currentPage]);

  // 复制到剪贴板
  const handleCopy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, []);

  // 重新开始
  const handleReset = useCallback(() => {
    setNovelContent("");
    setScriptContent("");
    setSelectedGenre("");
    setCurrentPage(1);
    setCopied(false);
    setError("");
    setState("choosing");
  }, []);

  return (
    <div className="min-h-screen bg-[#FAFAF8]">
      <div className="max-w-4xl mx-auto px-4 py-12 sm:py-16">
        {/* 标题 */}
        <header className="text-center mb-12">
          <h1 className="font-serif text-3xl sm:text-4xl text-[#2C2C2C] tracking-wide">
            漫剧剧本工坊
          </h1>
          <p className="mt-3 text-[#8A8A8A] text-sm tracking-wider">
            选择类型或写下想法，AI 帮你创作
          </p>
        </header>

        {/* 错误提示 */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* ===== 选择状态 ===== */}
        {state === "choosing" && (
          <div className="flex flex-col lg:flex-row gap-8">
            {/* 左侧主区域 */}
            <div className="flex-1 space-y-8 min-w-0">
              {/* 想法输入框 */}
              <div className="bg-[#F5F3EF] rounded-xl p-5 border border-[#E8E4DE]">
                <label className="block text-sm text-[#8A8A8A] mb-3">
                  你的想法（可选）
                </label>
                <textarea
                  value={userIdea}
                  onChange={(e) => setUserIdea(e.target.value)}
                  placeholder="写下你的想法，比如：主角是一个失忆的杀手，穿越到古代发现自己是预言中的救世主... 不填则 AI 自由创作"
                  className="w-full min-h-[100px] bg-white border border-[#E8E4DE] rounded-lg p-4 text-sm text-[#2C2C2C] placeholder:text-[#B8B8B8] focus:outline-none focus:border-[#B8977E] transition-colors resize-y"
                />
                <button
                  onClick={handleDirectGenerate}
                  disabled={!userIdea.trim()}
                  className="mt-3 px-6 py-2.5 bg-[#B8977E] text-white rounded-lg text-sm hover:bg-[#A8846A] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  直接生成
                </button>
              </div>

              {/* 分隔线 */}
              <div className="flex items-center gap-4">
                <div className="flex-1 h-px bg-[#E8E4DE]" />
                <span className="text-xs text-[#B8B8B8]">或选择类型</span>
                <div className="flex-1 h-px bg-[#E8E4DE]" />
              </div>

              {/* 字数选择 */}
              <div>
                <label className="block text-sm text-[#8A8A8A] mb-3">
                  每页字数
                </label>
                <div className="flex flex-wrap gap-2">
                  {[2000, 5000, 8000, 15000, 20000].map((count) => (
                    <button
                      key={count}
                      onClick={() => setWordCount(count)}
                      className={`px-4 py-2 rounded-lg text-sm transition-all ${
                        wordCount === count
                          ? "bg-[#B8977E] text-white"
                          : "bg-[#F5F3EF] text-[#2C2C2C] hover:bg-[#E8E4DE] border border-[#E8E4DE]"
                      }`}
                    >
                      {count >= 10000 ? `${count / 10000}万` : `${count / 1000}千`}字
                    </button>
                  ))}
                </div>
                <p className="text-xs text-[#B8B8B8] mt-2">
                  生成完后可点击「继续生成」无限续写
                </p>
              </div>

              {/* 类型卡片 */}
              <GenreCards
                genres={genres}
                onSelect={handleSelectGenre}
              />
            </div>

            {/* 右侧热门趋势侧边栏 */}
            {trending && trending.length > 0 && (
              <div className="w-full lg:w-80 shrink-0">
                <div className="bg-[#F5F3EF] rounded-xl p-5 border border-[#E8E4DE] sticky top-6">
                  <h3 className="text-sm font-medium text-[#2C2C2C] mb-4 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#B8977E] animate-pulse" />
                    当前热门趋势
                  </h3>
                  <div className="space-y-3">
                    {trending.map((item: TrendingItem, idx: number) => (
                      <button
                        key={idx}
                        onClick={() => setSelectedTrending(item)}
                        className="w-full text-left bg-white rounded-lg p-3 border border-[#E8E4DE] hover:border-[#B8977E] hover:shadow-sm transition-all cursor-pointer"
                      >
                        <div className="flex items-start gap-2">
                          <span className="text-xs text-[#B8977E] font-medium mt-0.5 shrink-0">
                            #{idx + 1}
                          </span>
                          <div className="min-w-0">
                            <p className="text-sm text-[#2C2C2C] font-medium line-clamp-2">
                              {item.title}
                            </p>
                            {item.author && (
                              <p className="text-xs text-[#B8977E] mt-0.5">
                                {item.author}
                              </p>
                            )}
                            <p className="text-xs text-[#8A8A8A] mt-1 line-clamp-2">
                              {item.snippet}
                            </p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-[#8A8A8A] mt-3 text-center">
                    点击查看详情
                  </p>
                </div>
              </div>
            )}

            {/* 热门小说详情弹窗 */}
            {selectedTrending && (
              <div
                className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4"
                onClick={() => setSelectedTrending(null)}
              >
                <div
                  className="bg-white rounded-2xl max-w-lg w-full max-h-[80vh] overflow-y-auto p-6 shadow-xl"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-medium text-[#2C2C2C]">
                        {selectedTrending.title}
                      </h3>
                      {selectedTrending.author && (
                        <p className="text-sm text-[#B8977E] mt-1">
                          作者：{selectedTrending.author}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => setSelectedTrending(null)}
                      className="text-[#8A8A8A] hover:text-[#2C2C2C] text-xl leading-none p-1"
                    >
                      ✕
                    </button>
                  </div>

                  {selectedTrending.snippet && (
                    <div className="mb-4">
                      <h4 className="text-xs font-medium text-[#8A8A8A] uppercase tracking-wider mb-1">
                        小说简介
                      </h4>
                      <p className="text-sm text-[#2C2C2C] leading-relaxed">
                        {selectedTrending.snippet}
                      </p>
                    </div>
                  )}

                  {selectedTrending.characters && (
                    <div className="mb-4">
                      <h4 className="text-xs font-medium text-[#8A8A8A] uppercase tracking-wider mb-1">
                        人物人设
                      </h4>
                      <p className="text-sm text-[#2C2C2C] leading-relaxed whitespace-pre-line">
                        {selectedTrending.characters}
                      </p>
                    </div>
                  )}

                  {selectedTrending.whyPopular && (
                    <div className="mb-4">
                      <h4 className="text-xs font-medium text-[#8A8A8A] uppercase tracking-wider mb-1">
                        爆火原因
                      </h4>
                      <p className="text-sm text-[#2C2C2C] leading-relaxed">
                        {selectedTrending.whyPopular}
                      </p>
                    </div>
                  )}

                  {selectedTrending.learnFrom && (
                    <div>
                      <h4 className="text-xs font-medium text-[#8A8A8A] uppercase tracking-wider mb-1">
                        可借鉴的点
                      </h4>
                      <p className="text-sm text-[#2C2C2C] leading-relaxed">
                        {selectedTrending.learnFrom}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ===== 生成中 ===== */}
        {state === "generating_novel" && (
          <div className="text-center py-20">
            <LoadingAnimation />
            <p className="mt-4 text-[#8A8A8A] text-sm">
              {isGeneratingMore
                ? `正在续写第 ${currentPage} 页...`
                : "正在构思小说..."}
            </p>
          </div>
        )}

        {/* ===== 小说预览 ===== */}
        {state === "novel_preview" && novelContent && (
          <div className="space-y-6">
            {/* 操作按钮 */}
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={handleContinueGenerate}
                className="px-6 py-2.5 bg-[#B8977E] text-white rounded-lg text-sm hover:bg-[#A8846A] transition-all"
              >
                继续生成（第 {currentPage + 1} 页）
              </button>
              <button
                onClick={handleGenerateScript}
                className="px-6 py-2.5 bg-[#5B8C5A] text-white rounded-lg text-sm hover:bg-[#4A7A49] transition-all"
              >
                满意，生成剧本
              </button>
              <button
                onClick={handleReset}
                className="px-6 py-2.5 bg-white text-[#8A8A8A] border border-[#E8E4DE] rounded-lg text-sm hover:bg-[#F5F3EF] transition-all"
              >
                不满意，重新选
              </button>
            </div>

            {/* 小说内容 */}
            <div className="bg-white border border-[#E8E4DE] rounded-xl p-6 sm:p-8">
              <ScriptDisplay content={novelContent} isStreaming={false} />
            </div>
          </div>
        )}

        {/* ===== 生成剧本中 ===== */}
        {state === "generating_script" && (
          <div className="text-center py-20">
            <LoadingAnimation />
            <p className="mt-4 text-[#8A8A8A] text-sm">
              {isGeneratingMore
                ? `正在续写剧本第 ${currentPage} 页...`
                : "正在改编剧本..."}
            </p>
          </div>
        )}

        {/* ===== 完成 ===== */}
        {state === "done" && scriptContent && (
          <div className="space-y-6">
            {/* 操作按钮 */}
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={handleContinueScript}
                className="px-6 py-2.5 bg-[#B8977E] text-white rounded-lg text-sm hover:bg-[#A8846A] transition-all"
              >
                继续生成剧本（第 {currentPage + 1} 页）
              </button>
              <button
                onClick={() => handleCopy(scriptContent)}
                className="px-6 py-2.5 bg-white text-[#2C2C2C] border border-[#E8E4DE] rounded-lg text-sm hover:bg-[#F5F3EF] transition-all"
              >
                {copied ? "已复制 ✓" : "复制全文"}
              </button>
              <button
                onClick={handleReset}
                className="px-6 py-2.5 bg-white text-[#8A8A8A] border border-[#E8E4DE] rounded-lg text-sm hover:bg-[#F5F3EF] transition-all"
              >
                重新开始
              </button>
            </div>

            {/* 剧本内容 */}
            <div className="bg-white border border-[#E8E4DE] rounded-xl p-6 sm:p-8">
              <ScriptDisplay content={scriptContent} isStreaming={false} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}