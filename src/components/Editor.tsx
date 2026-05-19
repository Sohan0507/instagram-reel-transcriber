'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { 
  Bold, 
  Italic, 
  List, 
  ListOrdered, 
  Quote, 
  Undo, 
  Redo, 
  Heading1, 
  Heading2, 
  Trash2,
  Sparkles
} from 'lucide-react';
import { useEffect } from 'react';

interface EditorProps {
  content: string;
  onChange: (html: string) => void;
}

export default function Editor({ content, onChange }: EditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2],
        },
      }),
    ],
    content: content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'focus:outline-none min-h-[250px] max-h-[500px] overflow-y-auto px-6 py-4 text-zinc-100 placeholder-zinc-500 selection:bg-purple-500/30 rounded-b-xl',
      },
    },
  });

  // Synchronize external content changes (e.g. when new transcript is generated)
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  if (!editor) {
    return (
      <div className="w-full min-h-[300px] flex items-center justify-center bg-zinc-900/50 border border-zinc-800 rounded-xl animate-pulse">
        <span className="text-zinc-500 flex items-center gap-2">
          <Sparkles className="w-5 h-5 animate-spin text-purple-500" />
          Loading document editor...
        </span>
      </div>
    );
  }

  const toggleBold = () => editor.chain().focus().toggleBold().run();
  const toggleItalic = () => editor.chain().focus().toggleItalic().run();
  const toggleH1 = () => editor.chain().focus().toggleHeading({ level: 1 }).run();
  const toggleH2 = () => editor.chain().focus().toggleHeading({ level: 2 }).run();
  const toggleBulletList = () => editor.chain().focus().toggleBulletList().run();
  const toggleOrderedList = () => editor.chain().focus().toggleOrderedList().run();
  const toggleBlockquote = () => editor.chain().focus().toggleBlockquote().run();
  const undo = () => editor.chain().focus().undo().run();
  const redo = () => editor.chain().focus().redo().run();
  const clearContent = () => {
    if (confirm('Are you sure you want to clear the editor?')) {
      editor.commands.clearContent(true);
    }
  };

  return (
    <div className="w-full flex flex-col bg-zinc-950/80 backdrop-blur-xl border border-zinc-800/80 rounded-2xl shadow-2xl overflow-hidden focus-within:border-purple-500/50 transition-all duration-300">
      
      {/* Editor Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-1.5 p-3 border-b border-zinc-800/80 bg-zinc-900/30">
        <div className="flex flex-wrap items-center gap-1">
          {/* Text Formats */}
          <button
            onClick={toggleBold}
            type="button"
            className={`p-2 rounded-lg transition-all duration-200 hover:bg-zinc-800 ${
              editor.isActive('bold') ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 'text-zinc-400 hover:text-zinc-200 border border-transparent'
            }`}
            title="Bold"
          >
            <Bold className="w-4 h-4" />
          </button>
          
          <button
            onClick={toggleItalic}
            type="button"
            className={`p-2 rounded-lg transition-all duration-200 hover:bg-zinc-800 ${
              editor.isActive('italic') ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 'text-zinc-400 hover:text-zinc-200 border border-transparent'
            }`}
            title="Italic"
          >
            <Italic className="w-4 h-4" />
          </button>

          <div className="w-px h-5 bg-zinc-800 mx-1" />

          {/* Headings */}
          <button
            onClick={toggleH1}
            type="button"
            className={`p-2 rounded-lg transition-all duration-200 hover:bg-zinc-800 ${
              editor.isActive('heading', { level: 1 }) ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 'text-zinc-400 hover:text-zinc-200 border border-transparent'
            }`}
            title="Heading 1"
          >
            <Heading1 className="w-4 h-4" />
          </button>

          <button
            onClick={toggleH2}
            type="button"
            className={`p-2 rounded-lg transition-all duration-200 hover:bg-zinc-800 ${
              editor.isActive('heading', { level: 2 }) ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 'text-zinc-400 hover:text-zinc-200 border border-transparent'
            }`}
            title="Heading 2"
          >
            <Heading2 className="w-4 h-4" />
          </button>

          <div className="w-px h-5 bg-zinc-800 mx-1" />

          {/* Lists */}
          <button
            onClick={toggleBulletList}
            type="button"
            className={`p-2 rounded-lg transition-all duration-200 hover:bg-zinc-800 ${
              editor.isActive('bulletList') ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 'text-zinc-400 hover:text-zinc-200 border border-transparent'
            }`}
            title="Bullet List"
          >
            <List className="w-4 h-4" />
          </button>

          <button
            onClick={toggleOrderedList}
            type="button"
            className={`p-2 rounded-lg transition-all duration-200 hover:bg-zinc-800 ${
              editor.isActive('orderedList') ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 'text-zinc-400 hover:text-zinc-200 border border-transparent'
            }`}
            title="Numbered List"
          >
            <ListOrdered className="w-4 h-4" />
          </button>

          {/* Quote */}
          <button
            onClick={toggleBlockquote}
            type="button"
            className={`p-2 rounded-lg transition-all duration-200 hover:bg-zinc-800 ${
              editor.isActive('blockquote') ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 'text-zinc-400 hover:text-zinc-200 border border-transparent'
            }`}
            title="Blockquote"
          >
            <Quote className="w-4 h-4" />
          </button>
        </div>

        {/* Undo, Redo, Clear */}
        <div className="flex items-center gap-1">
          <button
            onClick={undo}
            disabled={!editor.can().undo()}
            type="button"
            className="p-2 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 disabled:opacity-40 disabled:hover:bg-transparent transition-all duration-200"
            title="Undo"
          >
            <Undo className="w-4 h-4" />
          </button>

          <button
            onClick={redo}
            disabled={!editor.can().redo()}
            type="button"
            className="p-2 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 disabled:opacity-40 disabled:hover:bg-transparent transition-all duration-200"
            title="Redo"
          >
            <Redo className="w-4 h-4" />
          </button>

          <div className="w-px h-5 bg-zinc-800 mx-1" />

          <button
            onClick={clearContent}
            type="button"
            className="p-2 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200"
            title="Clear Document"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Editor Content */}
      <div className="relative bg-zinc-950/20 tiptap-editor-content">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
