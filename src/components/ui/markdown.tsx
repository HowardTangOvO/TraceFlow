import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

/** Markdown 渲染（服务端/客户端均可，带本项目排版样式） */
export function Markdown({ content, className }: { content: string; className?: string }) {
  return (
    <div className={cn("prose-poc", className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}
