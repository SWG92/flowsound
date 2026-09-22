import { SearchClient } from "@/components/search/search-client";

/**
 * 搜索页（服务端组件）。
 *
 * 说明：这里从服务端读取 searchParams 再传给客户端组件，而不是在客户端用
 * `useSearchParams()`。后者会把整棵子树变成需要 Suspense 包裹的客户端边界，
 * 而该边界在直接访问/刷新 /search?q=xxx 时不会解析，页面会永久卡在
 * fallback（"加载中..."）。服务端读取参数没有这个问题，同时也让首屏 HTML 直接可用。
 */
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const raw = params.q;
  const initialQuery = (Array.isArray(raw) ? raw[0] : raw) ?? "";

  return <SearchClient initialQuery={initialQuery} />;
}
