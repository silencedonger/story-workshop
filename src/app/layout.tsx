import type { Metadata } from 'next';
import { Inspector } from 'react-dev-inspector';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: '漫剧剧本工坊',
    template: '%s | 漫剧剧本工坊',
  },
  description:
    '从热门题材到完整剧本，一键生成适合漫画与动画改编的小说剧本。支持都市爽文、甜宠言情、悬疑推理等多种类型。',
  keywords: [
    '漫剧',
    '小说剧本',
    '剧本生成',
    '漫画改编',
    '动画剧本',
    'AI创作',
    '小说类型',
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const isDev = process.env.COZE_PROJECT_ENV === 'DEV';

  return (
    <html lang="zh-CN">
      <body className="antialiased">
        {isDev && <Inspector />}
        {children}
      </body>
    </html>
  );
}
