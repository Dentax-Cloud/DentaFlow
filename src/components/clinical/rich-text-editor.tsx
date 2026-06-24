"use client";

import { useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Bold, Heading3, Italic, List } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
};

export function RichTextEditor({
  value,
  onChange,
  placeholder,
  disabled,
  className,
}: Props) {
  const editorRef = useRef<HTMLDivElement>(null);

  const exec = useCallback((command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
    if (editorRef.current) onChange(editorRef.current.innerHTML);
  }, [onChange]);

  return (
    <div className={cn("rounded-md border", className)}>
      <div className="flex flex-wrap gap-1 border-b bg-muted/40 p-1">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          disabled={disabled}
          onClick={() => exec("bold")}
          aria-label="Bold"
        >
          <Bold className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          disabled={disabled}
          onClick={() => exec("italic")}
          aria-label="Italic"
        >
          <Italic className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          disabled={disabled}
          onClick={() => exec("insertUnorderedList")}
          aria-label="Bullet list"
        >
          <List className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          disabled={disabled}
          onClick={() => exec("formatBlock", "h3")}
          aria-label="Heading"
        >
          <Heading3 className="h-4 w-4" />
        </Button>
      </div>
      <div
        ref={editorRef}
        contentEditable={!disabled}
        suppressContentEditableWarning
        className="min-h-[140px] p-3 text-sm outline-none prose prose-sm max-w-none dark:prose-invert"
        data-placeholder={placeholder}
        dangerouslySetInnerHTML={{ __html: value }}
        onInput={(e) => onChange((e.target as HTMLDivElement).innerHTML)}
      />
    </div>
  );
}
