"use client";

interface GenreItem {
  name: string;
  description: string;
}

interface GenreCardsProps {
  genres: GenreItem[];
  onSelect: (genre: string) => void;
}

export default function GenreCards({ genres, onSelect }: GenreCardsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {genres.map((genre, index) => (
        <button
          key={genre.name}
          onClick={() => onSelect(genre.name)}
          className="group text-left p-6 rounded-lg transition-all duration-300 cursor-pointer"
          style={{
            backgroundColor: "#F5F3EF",
            border: "1px solid #E8E4DE",
            animationDelay: `${index * 80}ms`,
            opacity: 0,
            animation: `fade-in-up 0.4s ease-out ${index * 80}ms forwards`,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "#EDE9E3";
            e.currentTarget.style.borderColor = "#B8977E";
            e.currentTarget.style.transform = "translateY(-3px)";
            e.currentTarget.style.boxShadow = "0 6px 20px rgba(184,151,126,0.12)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "#F5F3EF";
            e.currentTarget.style.borderColor = "#E8E4DE";
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.boxShadow = "none";
          }}
        >
          <h3
            className="text-base font-semibold mb-1.5 transition-colors duration-200"
            style={{ color: "#2C2C2C" }}
          >
            {genre.name}
          </h3>
          <p className="text-sm leading-relaxed" style={{ color: "#8A8A8A" }}>
            {genre.description}
          </p>
          <div
            className="mt-3 text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-200"
            style={{ color: "#B8977E" }}
          >
            点击生成剧本 →
          </div>
        </button>
      ))}
    </div>
  );
}
