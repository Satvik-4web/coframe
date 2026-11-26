import React from 'react';

interface ChatMessageMarkdownProps {
  content: string;
}

export const ChatMessageMarkdown: React.FC<ChatMessageMarkdownProps> = ({ content }) => {
  if (!content) return null;

  // Split text by code blocks first
  const parts = content.split(/(```[\s\S]*?```)/g);

  return (
    <div className="space-y-2 text-xs leading-relaxed break-words">
      {parts.map((part, index) => {
        if (part.startsWith('```') && part.endsWith('```')) {
          // Code block
          const lines = part.slice(3, -3).split('\n');
          const firstLine = lines[0].trim();
          const language = /^[a-zA-Z0-9_-]+$/.test(firstLine) ? firstLine : '';
          const codeBody = language ? lines.slice(1).join('\n') : lines.join('\n');

          return (
            <div key={index} className="my-2 rounded-xl bg-slate-900 text-slate-100 p-3 font-mono text-[11px] overflow-x-auto shadow-inner">
              {language && (
                <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mb-1.5 pb-1 border-b border-slate-800">
                  {language}
                </div>
              )}
              <pre className="whitespace-pre">{codeBody}</pre>
            </div>
          );
        }

        // Render normal markdown blocks (paragraphs, headers, lists)
        const lines = part.split('\n');
        return (
          <div key={index} className="space-y-1.5">
            {lines.map((line, lIdx) => {
              const trimmed = line.trim();

              if (!trimmed) {
                return <div key={lIdx} className="h-1" />;
              }

              // Headers
              if (trimmed.startsWith('### ')) {
                return (
                  <h4 key={lIdx} className="text-xs font-bold text-[#172033] mt-2 mb-1">
                    {renderInline(trimmed.slice(4))}
                  </h4>
                );
              }
              if (trimmed.startsWith('## ')) {
                return (
                  <h3 key={lIdx} className="text-sm font-bold text-[#172033] mt-2.5 mb-1">
                    {renderInline(trimmed.slice(3))}
                  </h3>
                );
              }
              if (trimmed.startsWith('# ')) {
                return (
                  <h2 key={lIdx} className="text-sm font-extrabold text-[#172033] mt-3 mb-1">
                    {renderInline(trimmed.slice(2))}
                  </h2>
                );
              }

              // Bullet lists
              if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
                return (
                  <div key={lIdx} className="flex items-start gap-2 pl-2">
                    <span className="text-teal-600 font-bold select-none">•</span>
                    <span>{renderInline(trimmed.slice(2))}</span>
                  </div>
                );
              }

              // Blockquotes
              if (trimmed.startsWith('> ')) {
                return (
                  <blockquote
                    key={lIdx}
                    className="border-l-2 border-teal-500 pl-3 italic text-[#475569] my-1"
                  >
                    {renderInline(trimmed.slice(2))}
                  </blockquote>
                );
              }

              // Numbered list
              const numMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
              if (numMatch) {
                return (
                  <div key={lIdx} className="flex items-start gap-2 pl-2">
                    <span className="text-slate-500 font-semibold text-[11px] select-none min-w-[14px]">
                      {numMatch[1]}.
                    </span>
                    <span>{renderInline(numMatch[2])}</span>
                  </div>
                );
              }

              return (
                <p key={lIdx} className="text-[#334155]">
                  {renderInline(line)}
                </p>
              );
            })}
          </div>
        );
      })}
    </div>
  );
};

// Inline parser for bold, italic, code
function renderInline(text: string): React.ReactNode {
  // Regex to match bold, italic, and inline code
  const tokens = text.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g);

  return tokens.map((token, i) => {
    if (token.startsWith('`') && token.endsWith('`') && token.length >= 2) {
      return (
        <code
          key={i}
          className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-800 font-mono text-[11px] border border-slate-200"
        >
          {token.slice(1, -1)}
        </code>
      );
    }
    if (token.startsWith('**') && token.endsWith('**') && token.length >= 4) {
      return (
        <strong key={i} className="font-bold text-[#0F172A]">
          {token.slice(2, -2)}
        </strong>
      );
    }
    if (token.startsWith('*') && token.endsWith('*') && token.length >= 2) {
      return (
        <em key={i} className="italic text-[#334155]">
          {token.slice(1, -1)}
        </em>
      );
    }
    return token;
  });
}
