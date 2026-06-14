"use client";

import { DailyRecommend } from "@/components/player/daily-recommend";

export default function DailyPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          <span className="gradient-text">每日推荐</span>
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          每天为你推荐不一样的好歌
        </p>
      </div>
      <DailyRecommend />
    </div>
  );
}
