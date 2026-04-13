'use client';

import { useEffect, useMemo } from 'react';
import { EditorContent, NodeViewWrapper, ReactNodeViewRenderer, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TextAlign from '@tiptap/extension-text-align';
import UnderlineExtension from '@tiptap/extension-underline';
import Highlight from '@tiptap/extension-highlight';
import Link from '@tiptap/extension-link';
import { Node, mergeAttributes } from '@tiptap/core';
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Eraser,
  FileText,
  Heading1,
  Heading2,
  Heading3,
  Highlighter,
  Italic,
  List,
  ListOrdered,
  Link2,
  Pilcrow,
  Redo2,
  SeparatorHorizontal,
  Strikethrough,
  Type,
  Underline,
  Undo2,
  Quote,
} from 'lucide-react';
import { buildStructuredHeaderBlocks, CONTRACT_PLACEHOLDERS, normalizeContractText } from '@/lib/contracts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { ContractTemplateCategory } from '@/lib/types';

type DocumentTemplateEditorProps = {
  content: string;
  onChange: (value: string) => void;
  templateName: string;
  category: ContractTemplateCategory;
};

function VariableChip({ node }: { node: { attrs: { key?: string; label?: string } } }) {
  return (
    <NodeViewWrapper as="span" className="inline-flex">
      <span
        contentEditable={false}
        className="inline-flex items-center rounded-full border border-emerald-300/30 bg-emerald-100 px-2.5 py-1 text-xs font-semibold tracking-[0.01em] text-emerald-950 shadow-sm"
      >
        {node.attrs.label || node.attrs.key}
      </span>
    </NodeViewWrapper>
  );
}

const ContractVariableNode = Node.create({
  name: 'contractVariable',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      key: {
        default: '',
      },
      label: {
        default: '',
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-contract-variable-key]',
        getAttrs: (node) => {
          if (!(node instanceof HTMLElement)) return false;
          return {
            key: node.getAttribute('data-contract-variable-key') || '',
            label: node.getAttribute('data-contract-variable-label') || node.textContent || '',
          };
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-contract-variable-key': HTMLAttributes.key,
        'data-contract-variable-label': HTMLAttributes.label,
        class: 'contract-variable-chip',
      }),
      HTMLAttributes.label || HTMLAttributes.key,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(VariableChip as never);
  },
});

type ToolbarButtonProps = {
  active?: boolean;
  onClick: () => void;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
};

function ToolbarButton({ active, onClick, title, icon: Icon }: ToolbarButtonProps) {
  return (
    <Button
      type="button"
      variant="outline"
      onClick={onClick}
      title={title}
      className={`h-10 border-white/10 px-3 ${
        active ? 'bg-emerald-400 text-black hover:bg-emerald-300' : 'bg-white/5 text-white hover:bg-white/10'
      }`}
    >
      <Icon className="h-4 w-4" />
    </Button>
  );
}

export function DocumentTemplateEditor({
  content,
  onChange,
  templateName,
  category,
}: DocumentTemplateEditorProps) {
  const groupedPlaceholders = useMemo(() => {
    const groups = new Map<string, Array<{ key: string; label: string }>>();

    CONTRACT_PLACEHOLDERS.filter((entry) => entry.key !== 'manual').forEach((entry) => {
      const [group] = entry.key.split('.');
      const labelGroup = group === 'buyer'
        ? 'Cumparator'
        : group === 'owner'
          ? 'Proprietar'
          : group === 'property'
            ? 'Proprietate'
            : group === 'agency'
              ? 'Agentie'
              : group === 'agent'
                ? 'Agent'
                : 'General';

      if (!groups.has(labelGroup)) {
        groups.set(labelGroup, []);
      }

      groups.get(labelGroup)?.push({
        key: entry.key,
        label: entry.label,
      });
    });

    return Array.from(groups.entries());
  }, []);

  const placeholderPreviewValues = useMemo(() => {
    const values: Record<string, string> = {};
    CONTRACT_PLACEHOLDERS.filter((entry) => entry.key !== 'manual').forEach((entry) => {
      values[entry.key.replace(/\./g, '_')] = entry.label;
    });
    return values;
  }, []);

  const headerBlocks = useMemo(
    () => buildStructuredHeaderBlocks(category, placeholderPreviewValues),
    [category, placeholderPreviewValues]
  );

  const previewTitle = templateName.trim() || 'Contract';
  const previewContractNumber = normalizeContractText(placeholderPreviewValues.contract_number || 'Numar contract');
  const previewCurrentDate = normalizeContractText(placeholderPreviewValues.currentDate || 'Data curenta');
  const previewAgencyDisplayName = normalizeContractText(
    placeholderPreviewValues.agency_legalCompanyName || placeholderPreviewValues.agency_name || 'Agentie imobiliara'
  );
  const previewAgencyPhone = normalizeContractText(placeholderPreviewValues.agency_phone || '');
  const previewAgencyEmail = normalizeContractText(placeholderPreviewValues.agency_email || '');
  const previewHeaderLine = [previewAgencyDisplayName, previewAgencyPhone, previewAgencyEmail].filter(Boolean).join('   •   ');
  const previewChipEntries = useMemo(
    () =>
      Object.values(placeholderPreviewValues)
        .filter(Boolean)
        .sort((left, right) => right.length - left.length),
    [placeholderPreviewValues]
  );

  function renderPreviewTextWithChips(text: string) {
    if (!text) return text;

    const parts: Array<{ type: 'text' | 'chip'; value: string }> = [];
    let cursor = 0;

    while (cursor < text.length) {
      let matchedLabel = '';
      let matchedIndex = -1;

      for (const label of previewChipEntries) {
        const index = text.indexOf(label, cursor);
        if (index === -1) continue;
        if (matchedIndex === -1 || index < matchedIndex) {
          matchedIndex = index;
          matchedLabel = label;
        }
        if (matchedIndex === cursor) break;
      }

      if (matchedIndex === -1) {
        parts.push({ type: 'text', value: text.slice(cursor) });
        break;
      }

      if (matchedIndex > cursor) {
        parts.push({ type: 'text', value: text.slice(cursor, matchedIndex) });
      }

      parts.push({ type: 'chip', value: matchedLabel });
      cursor = matchedIndex + matchedLabel.length;
    }

    return parts.map((part, index) =>
      part.type === 'chip' ? (
        <span
          key={`chip-${index}-${part.value}`}
          className="inline-flex rounded-full border border-emerald-300/50 bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-950 align-middle"
        >
          {part.value}
        </span>
      ) : (
        <span key={`text-${index}`}>{part.value}</span>
      )
    );
  }

  function ensureNamedParagraphSeparator(text: string) {
    return text.trimStart().startsWith(',') ? text : `, ${text.trimStart()}`;
  }

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      UnderlineExtension,
      Highlight,
      Link.configure({
        openOnClick: false,
        autolink: true,
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      ContractVariableNode,
    ],
    content,
    editorProps: {
      attributes: {
        class:
          'min-h-[520px] outline-none [&_.ProseMirror-selectednode]:ring-2 [&_.ProseMirror-selectednode]:ring-emerald-400 [&>h1]:mb-6 [&>h1]:mt-2 [&>h1]:text-center [&>h1]:text-[28px] [&>h1]:font-semibold [&>h2]:mb-4 [&>h2]:mt-6 [&>h2]:text-[22px] [&>h2]:font-semibold [&>h3]:mb-4 [&>h3]:mt-6 [&>h3]:text-[18px] [&>h3]:font-semibold [&>ol]:my-4 [&>ol]:pl-6 [&>p]:my-4 [&>p]:text-[16px] [&>p]:leading-8 [&>ul]:my-4 [&>ul]:list-disc [&>ul]:pl-6',
        style: 'font-family: Georgia, Times New Roman, serif;',
      },
    },
    onUpdate({ editor: nextEditor }) {
      onChange(nextEditor.getHTML());
    },
  });

  useEffect(() => {
    if (!editor) return;

    const currentHtml = editor.getHTML();
    if (content && currentHtml !== content) {
      editor.commands.setContent(content, { emitUpdate: false });
      return;
    }

    if (!content && currentHtml !== '<p></p>') {
      editor.commands.clearContent(true);
    }
  }, [content, editor]);

  if (!editor) return null;

  const handleSetLink = () => {
    const previousUrl = editor.getAttributes('link').href as string | undefined;
    const url = window.prompt('Introdu URL-ul linkului', previousUrl || 'https://');

    if (url === null) return;
    if (url.trim() === '') {
      editor.chain().focus().unsetLink().run();
      return;
    }

    editor.chain().focus().setLink({ href: url.trim() }).run();
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_260px] 2xl:grid-cols-[minmax(0,1fr)_280px] xl:items-start">
      <Card className="rounded-[32px] border-none bg-[#152A47] text-white shadow-2xl">
        <CardHeader>
          <CardTitle>Corp contract</CardTitle>
          <CardDescription className="text-white/70">
            Antetul este standardizat automat cu tagurile necesare. In editorul de mai jos agentia completeaza doar clauzele si continutul variabil al contractului.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="sticky top-[72px] z-30 rounded-[26px] border border-white/10 bg-[#0d1d31]/95 p-3 shadow-[0_12px_40px_rgba(0,0,0,0.28)] backdrop-blur xl:top-[76px]">
            <div className="flex flex-wrap gap-2 rounded-2xl border border-white/10 bg-[#11243b] p-3">
              <ToolbarButton title="Undo" icon={Undo2} onClick={() => editor.chain().focus().undo().run()} />
              <ToolbarButton title="Redo" icon={Redo2} onClick={() => editor.chain().focus().redo().run()} />
              <ToolbarButton
                title="Bold"
                icon={Bold}
                active={editor.isActive('bold')}
                onClick={() => editor.chain().focus().toggleBold().run()}
              />
              <ToolbarButton
                title="Italic"
                icon={Italic}
                active={editor.isActive('italic')}
                onClick={() => editor.chain().focus().toggleItalic().run()}
              />
              <ToolbarButton
                title="Underline"
                icon={Underline}
                active={editor.isActive('underline')}
                onClick={() => editor.chain().focus().toggleUnderline().run()}
              />
              <ToolbarButton
                title="Titlu 1"
                icon={Heading1}
                active={editor.isActive('heading', { level: 1 })}
                onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
              />
              <ToolbarButton
                title="Titlu 2"
                icon={Heading2}
                active={editor.isActive('heading', { level: 2 })}
                onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
              />
              <ToolbarButton
                title="Titlu 3"
                icon={Heading3}
                active={editor.isActive('heading', { level: 3 })}
                onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
              />
              <ToolbarButton
                title="Paragraf"
                icon={Pilcrow}
                active={editor.isActive('paragraph')}
                onClick={() => editor.chain().focus().setParagraph().run()}
              />
              <ToolbarButton
                title="Strike"
                icon={Strikethrough}
                active={editor.isActive('strike')}
                onClick={() => editor.chain().focus().toggleStrike().run()}
              />
              <ToolbarButton
                title="Highlight"
                icon={Highlighter}
                active={editor.isActive('highlight')}
                onClick={() => editor.chain().focus().toggleHighlight().run()}
              />
              <ToolbarButton
                title="Quote"
                icon={Quote}
                active={editor.isActive('blockquote')}
                onClick={() => editor.chain().focus().toggleBlockquote().run()}
              />
              <ToolbarButton
                title="Linie separatoare"
                icon={SeparatorHorizontal}
                onClick={() => editor.chain().focus().setHorizontalRule().run()}
              />
              <ToolbarButton
                title="Link"
                icon={Link2}
                active={editor.isActive('link')}
                onClick={handleSetLink}
              />
              <ToolbarButton title="Align left" icon={AlignLeft} onClick={() => editor.chain().focus().setTextAlign('left').run()} />
              <ToolbarButton title="Align center" icon={AlignCenter} onClick={() => editor.chain().focus().setTextAlign('center').run()} />
              <ToolbarButton title="Align right" icon={AlignRight} onClick={() => editor.chain().focus().setTextAlign('right').run()} />
              <ToolbarButton title="Justify" icon={AlignJustify} onClick={() => editor.chain().focus().setTextAlign('justify').run()} />
              <ToolbarButton
                title="Bullet list"
                icon={List}
                active={editor.isActive('bulletList')}
                onClick={() => editor.chain().focus().toggleBulletList().run()}
              />
              <ToolbarButton
                title="Numbered list"
                icon={ListOrdered}
                active={editor.isActive('orderedList')}
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
              />
              <ToolbarButton
                title="Curata formatarea"
                icon={Eraser}
                onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
              />
            </div>
          </div>

          <div className="h-[calc(100vh-220px)] overflow-y-auto overflow-x-hidden rounded-[30px] bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.25),rgba(255,255,255,0.04)_40%,rgba(10,18,30,0.2)_100%)] px-3 py-5 sm:p-6 lg:px-5 lg:py-6">
            <div className="mx-auto min-h-[980px] w-full max-w-[1080px] rounded-[8px] bg-white px-[56px] py-[72px] text-[#1b1f23] shadow-[0_30px_90px_rgba(0,0,0,0.35)] lg:px-[72px] lg:py-[82px] 2xl:max-w-[1180px]">
              <div className="mb-8 rounded-[18px] border border-slate-200 bg-slate-50/85 p-6 text-[12px] leading-7 text-slate-900">
                <div className="border-b border-slate-200 pb-3 text-center text-[12px] font-medium text-slate-600">
                  {previewHeaderLine}
                </div>
                <div className="mt-5 text-center">
                  <div className="mx-auto h-[2px] w-[220px] bg-[#2f6fde]" />
                  <div className="py-3 text-[30px] font-bold tracking-[-0.03em] text-[#071326]">{previewAgencyDisplayName}</div>
                  <div className="mx-auto h-[2px] w-[220px] bg-[#2f6fde]" />
                </div>
                <div className="mt-8 text-center">
                  <h1 className="whitespace-nowrap text-[30px] font-semibold tracking-[0.005em] text-[#bb1f2a]">{previewTitle}</h1>
                  <div className="mt-1 text-[18px] text-[#2f6fde]">
                    {[previewContractNumber ? `Contract nr. ${previewContractNumber}` : '', previewCurrentDate ? `Data ${previewCurrentDate}` : '']
                      .filter(Boolean)
                      .join(' | ')}
                  </div>
                </div>
                <div className="mt-8 space-y-4 text-[12px] leading-8 text-slate-900">
                  {headerBlocks.map((block, index) => {
                    if (block.kind === 'intro') {
                      return (
                        <p key={`intro-${index}`} className="inline-block bg-slate-200/80 px-3 py-1.5 text-[12px] leading-7 text-slate-800">
                          {renderPreviewTextWithChips(block.text)}
                        </p>
                      );
                    }

                    if (block.kind === 'connector') {
                      return (
                        <p key={`connector-${index}`} className="text-[12px] leading-7 text-slate-700">
                          {renderPreviewTextWithChips(block.text)}
                        </p>
                      );
                    }

                    if (block.kind === 'emphasis') {
                      return (
                        <p key={`emphasis-${index}`} className="text-[12px] font-semibold leading-8 text-slate-900">
                          {renderPreviewTextWithChips(block.text)}
                        </p>
                      );
                    }

                    if (block.kind === 'namedParagraph') {
                      return (
                        <p key={`named-${index}`} className="text-[12px] leading-8 text-slate-900">
                          <span className="font-semibold">{renderPreviewTextWithChips(block.boldText)}</span>
                          {renderPreviewTextWithChips(ensureNamedParagraphSeparator(block.text))}
                        </p>
                      );
                    }

                    return (
                      <p key={`paragraph-${index}`} className="text-[12px] leading-8 text-slate-900">
                        {renderPreviewTextWithChips(block.kind === 'party' ? `${block.index}. ${block.text}` : block.text)}
                      </p>
                    );
                  })}
                </div>
              </div>
              <div className="mb-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-600">
                Corpul contractului incepe de aici. Antetul de mai sus se completeaza automat la generare din CRM sau manual.
              </div>
              <EditorContent editor={editor} />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-5 xl:sticky xl:top-4 xl:self-start xl:h-[calc(100vh-32px)] xl:overflow-y-auto xl:pr-1">
        <Card className="rounded-[32px] border-none bg-[#152A47] text-white shadow-2xl">
          <CardHeader>
            <CardTitle>Campuri dinamice</CardTitle>
            <CardDescription className="text-white/70">
              Inserate in document ca etichete vizuale, nu ca text tehnic.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {groupedPlaceholders.map(([group, items]) => (
              <div key={group} className="space-y-3">
                <div className="text-xs uppercase tracking-[0.18em] text-white/45">{group}</div>
                <div className="flex flex-wrap gap-2">
                  {items.map((item) => (
                    <Button
                      key={item.key}
                      type="button"
                      variant="outline"
                      onClick={() =>
                        editor
                          .chain()
                          .focus()
                          .insertContent({
                            type: 'contractVariable',
                            attrs: {
                              key: item.key,
                              label: item.label,
                            },
                          })
                          .run()
                      }
                      className="justify-start border-white/10 bg-white/5 text-left text-white hover:bg-white/10 xl:w-full"
                      title={item.label}
                    >
                      {item.label}
                    </Button>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="rounded-[32px] border-none bg-[#152A47] text-white shadow-2xl">
          <CardHeader>
            <CardTitle>Comportament</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-7 text-white/75">
            <div className="rounded-2xl border border-white/10 bg-[#0d1d31] p-4">
              <div className="mb-3 inline-flex items-center rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs uppercase tracking-[0.16em] text-emerald-200">
                <FileText className="mr-2 h-3.5 w-3.5" />
                Word-like editor
              </div>
              <p>Agentia lucreaza vizual cu documentul, iar campurile dinamice apar ca etichete usor de recunoscut in text.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
