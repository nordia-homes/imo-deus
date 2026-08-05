'use client';

import { useEffect, useRef, useState } from 'react';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Italic,
  Link2,
  List,
  ListOrdered,
  Palette,
  Redo2,
  RemoveFormatting,
  SmilePlus,
  Strikethrough,
  Underline,
  Undo2,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { emailHtmlToPlainText, sanitizeEmailHtml } from '@/lib/email-compose';
import { cn } from '@/lib/utils';

const EMOJIS = ['😀', '😊', '🙂', '😉', '😍', '🤝', '👍', '👏', '🙏', '✅', '📌', '📅', '🏠', '🔑', '📄', '✍️', '📞', '📧', '🎉', '✨', '❤️', '🚀', '⚠️', 'ℹ️'];

type EditorValue = { html: string; text: string };

type Props = {
  value: string;
  onChange: (value: EditorValue) => void;
  placeholder?: string;
  className?: string;
  minHeight?: number;
  variables?: string[];
};

function ToolbarButton({
  label,
  children,
  onClick,
}: {
  label: string;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={label}
      title={label}
      className="h-8 w-8 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-950"
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

export function GmailRichTextEditor({
  value,
  onChange,
  placeholder = 'Scrie mesajul…',
  className,
  minHeight = 320,
  variables = [],
}: Props) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [empty, setEmpty] = useState(!emailHtmlToPlainText(value));
  const [emojiOpen, setEmojiOpen] = useState(false);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || document.activeElement === editor || editor.innerHTML === value) return;
    editor.innerHTML = sanitizeEmailHtml(value);
    setEmpty(!emailHtmlToPlainText(value));
  }, [value]);

  const sync = () => {
    const editor = editorRef.current;
    if (!editor) return;
    const html = editor.innerHTML === '<br>' ? '' : sanitizeEmailHtml(editor.innerHTML);
    const text = (editor.innerText || editor.textContent || '').trim();
    setEmpty(!text);
    onChange({ html, text });
  };

  const command = (name: string, commandValue?: string) => {
    editorRef.current?.focus();
    document.execCommand(name, false, commandValue);
    sync();
  };

  const insertText = (text: string) => {
    editorRef.current?.focus();
    document.execCommand('insertText', false, text);
    sync();
  };

  return (
    <div className={cn('overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-[0_18px_55px_-42px_rgba(15,23,42,.55)]', className)}>
      <div className="relative">
        {empty ? <span className="pointer-events-none absolute left-5 top-5 text-[15px] text-slate-400">{placeholder}</span> : null}
        <div
          ref={editorRef}
          role="textbox"
          aria-multiline="true"
          contentEditable
          suppressContentEditableWarning
          onInput={sync}
          onBlur={sync}
          className="gmail-rich-editor max-w-none overflow-y-auto px-5 py-5 text-[15px] leading-7 text-slate-800 outline-none [&_a]:text-blue-600 [&_a]:underline [&_blockquote]:border-l-4 [&_blockquote]:border-slate-200 [&_blockquote]:pl-4 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-0 [&_p+p]:mt-3 [&_ul]:list-disc [&_ul]:pl-6"
          style={{ minHeight, maxHeight: Math.max(minHeight, 520) }}
        />
      </div>

      {variables.length ? (
        <div className="flex gap-1.5 overflow-x-auto border-t border-slate-100 px-3 py-2">
          <span className="shrink-0 px-1 py-1 text-[10px] font-semibold uppercase tracking-[.14em] text-slate-400">Inserează</span>
          {variables.map((variable) => (
            <button key={variable} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => insertText(variable)} className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600 transition hover:bg-emerald-50 hover:text-emerald-700">
              {variable}
            </button>
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-0.5 border-t border-slate-200 bg-slate-50/80 px-3 py-2">
        <ToolbarButton label="Anulează" onClick={() => command('undo')}><Undo2 className="h-4 w-4" /></ToolbarButton>
        <ToolbarButton label="Repetă" onClick={() => command('redo')}><Redo2 className="h-4 w-4" /></ToolbarButton>
        <span className="mx-1 h-5 w-px bg-slate-200" />

        <Select defaultValue="Arial" onValueChange={(font) => command('fontName', font)}>
          <SelectTrigger className="h-8 w-[104px] border-0 bg-transparent px-2 text-xs text-slate-700 shadow-none focus:ring-0"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="Arial">Arial</SelectItem>
            <SelectItem value="Georgia">Georgia</SelectItem>
            <SelectItem value="Verdana">Verdana</SelectItem>
            <SelectItem value="Tahoma">Tahoma</SelectItem>
          </SelectContent>
        </Select>

        <Select defaultValue="3" onValueChange={(size) => command('fontSize', size)}>
          <SelectTrigger className="h-8 w-[86px] border-0 bg-transparent px-2 text-xs text-slate-700 shadow-none focus:ring-0"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="2">Mic</SelectItem>
            <SelectItem value="3">Normal</SelectItem>
            <SelectItem value="4">Mare</SelectItem>
            <SelectItem value="5">Foarte mare</SelectItem>
          </SelectContent>
        </Select>

        <ToolbarButton label="Aldin" onClick={() => command('bold')}><Bold className="h-4 w-4" /></ToolbarButton>
        <ToolbarButton label="Cursiv" onClick={() => command('italic')}><Italic className="h-4 w-4" /></ToolbarButton>
        <ToolbarButton label="Subliniat" onClick={() => command('underline')}><Underline className="h-4 w-4" /></ToolbarButton>
        <ToolbarButton label="Tăiat" onClick={() => command('strikeThrough')}><Strikethrough className="h-4 w-4" /></ToolbarButton>

        <label className="relative grid h-8 w-8 cursor-pointer place-items-center rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-950" title="Culoare text">
          <Palette className="h-4 w-4" />
          <input type="color" className="absolute inset-0 cursor-pointer opacity-0" onInput={(event) => command('foreColor', (event.target as HTMLInputElement).value)} />
        </label>

        <span className="mx-1 h-5 w-px bg-slate-200" />
        <ToolbarButton label="Aliniază la stânga" onClick={() => command('justifyLeft')}><AlignLeft className="h-4 w-4" /></ToolbarButton>
        <ToolbarButton label="Centrează" onClick={() => command('justifyCenter')}><AlignCenter className="h-4 w-4" /></ToolbarButton>
        <ToolbarButton label="Aliniază la dreapta" onClick={() => command('justifyRight')}><AlignRight className="h-4 w-4" /></ToolbarButton>
        <ToolbarButton label="Listă" onClick={() => command('insertUnorderedList')}><List className="h-4 w-4" /></ToolbarButton>
        <ToolbarButton label="Listă numerotată" onClick={() => command('insertOrderedList')}><ListOrdered className="h-4 w-4" /></ToolbarButton>
        <ToolbarButton label="Adaugă link" onClick={() => {
          const url = window.prompt('Introdu adresa linkului');
          if (url) command('createLink', url);
        }}><Link2 className="h-4 w-4" /></ToolbarButton>

        <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
          <PopoverTrigger asChild>
            <Button type="button" variant="ghost" size="icon" aria-label="Inserează emoji" title="Inserează emoji" className="h-8 w-8 rounded-lg text-slate-600 hover:bg-slate-100">
              <SmilePlus className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-[248px] rounded-2xl p-3">
            <p className="mb-2 text-xs font-medium text-slate-500">Emoji</p>
            <div className="grid grid-cols-6 gap-1">
              {EMOJIS.map((emoji) => (
                <button key={emoji} type="button" className="grid h-8 w-8 place-items-center rounded-lg text-lg transition hover:bg-slate-100" onClick={() => { insertText(emoji); setEmojiOpen(false); }}>
                  {emoji}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        <ToolbarButton label="Șterge formatarea" onClick={() => command('removeFormat')}><RemoveFormatting className="h-4 w-4" /></ToolbarButton>
      </div>
    </div>
  );
}
