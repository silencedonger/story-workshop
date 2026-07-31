import { NextRequest, NextResponse } from "next/server";

// 内置热门小说类型数据（零成本，无需任何 API）
const HOT_GENRES = [
  {
    title: "都市爽文",
    snippet: "底层逆袭、商业对决、强者归来，快节奏高爽点，都市背景下的热血传奇。",
    tags: ["逆袭", "商战", "强者归来"],
  },
  {
    title: "甜宠言情",
    snippet: "甜甜的恋爱、命中注定的相遇，温暖治愈的情感故事，让人心动不已。",
    tags: ["恋爱", "治愈", "日常"],
  },
  {
    title: "悬疑推理",
    snippet: "烧脑谜案、层层反转，每一个细节都暗藏玄机，真相永远在意料之外。",
    tags: ["烧脑", "反转", "破案"],
  },
  {
    title: "玄幻修仙",
    snippet: "修仙问道、逆天改命，浩瀚仙侠世界中的传奇冒险，一念成仙一念成魔。",
    tags: ["修仙", "仙侠", "冒险"],
  },
  {
    title: "穿越重生",
    snippet: "重回过去、改变命运，带着前世记忆重新活一次，这一世绝不重蹈覆辙。",
    tags: ["穿越", "重生", "逆天改命"],
  },
  {
    title: "无限流",
    snippet: "穿梭于各个副本世界，生死一线间突破极限，用智慧与勇气闯出一条生路。",
    tags: ["副本", "生存", "智斗"],
  },
  {
    title: "科幻末世",
    snippet: "末日废土、星际航行、人工智能觉醒，在绝望中寻找人类文明的希望。",
    tags: ["末日", "科幻", "机甲"],
  },
  {
    title: "古风权谋",
    snippet: "庙堂之争、江湖之远，运筹帷幄之中决胜千里之外，步步为营的权谋博弈。",
    tags: ["权谋", "宫斗", "江湖"],
  },
];

export async function POST() {
  return NextResponse.json({
    success: true,
    results: HOT_GENRES,
  });
}