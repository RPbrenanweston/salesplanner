/**
 * @crumb
 * @id frontend-component-rich-text-editor
 * @area UI/Editor
 * @intent Rich text editor — Tiptap-based WYSIWYG editor with bold, italic, ordered/unordered list, undo/redo toolbar for composing formatted content
 * @responsibilities Render Tiptap editor with StarterKit + Placeholder extension, expose toolbar buttons for formatting actions, call onChange with HTML string on every content update
 * @contracts RichTextEditor({ content, onChange, placeholder? }) → JSX; uses useEditor from @tiptap/react with StarterKit + Placeholder; calls onChange(editor.getHTML()) on update
 * @in content (string — initial HTML), onChange callback (receives HTML string), placeholder (optional string)
 * @out Formatted HTML string on every keystroke via onChange; rendered editable WYSIWYG area
 * @err Tiptap extension load failure (rare — editor renders blank); onChange called with empty string if editor content is empty paragraph (consumers must handle "<p></p>" as empty)
 * @hazard onChange is called with raw HTML — if the HTML is later rendered unsanitized (e.g. with dangerouslySetInnerHTML), XSS vulnerabilities are possible if user-authored content contains script tags or event handlers
 * @hazard Tiptap StarterKit does not restrict HTML tags — a user could paste rich content with arbitrary inline styles or spans that bypass the editor's visual formatting model, producing unexpected HTML in stored content
 * @shared-edges @tiptap/react→USED as editor engine; ComposeEmailModal→RENDERS this component for email body; ScriptModal→MAY RENDER for script content
 * @trail rich-text#1 | Parent renders RichTextEditor with initial content → user types/formats → Tiptap fires onUpdate → onChange(editor.getHTML()) called → parent stores HTML
 * @prompt Sanitize HTML output before storing (DOMPurify or server-side). Add image paste support. Consider output format: HTML vs markdown vs Tiptap JSON for storage.
 */
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { Bold, Italic, List, ListOrdered, Undo, Redo } from 'lucide-react';

interface RichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
}

export function RichTextEditor({ content, onChange, placeholder = 'Start typing your script...' }: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder,
      }),
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  if (!editor) {
    return null;
  }

  return (
    <div className="border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-1 p-2 border-b border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 ${
            editor.isActive('bold') ? 'bg-gray-300 dark:bg-gray-600' : ''
          }`}
          title="Bold"
        >
          <Bold className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 ${
            editor.isActive('italic') ? 'bg-gray-300 dark:bg-gray-600' : ''
          }`}
          title="Italic"
        >
          <Italic className="w-4 h-4" />
        </button>
        <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1"></div>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 ${
            editor.isActive('bulletList') ? 'bg-gray-300 dark:bg-gray-600' : ''
          }`}
          title="Bullet List"
        >
          <List className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 ${
            editor.isActive('orderedList') ? 'bg-gray-300 dark:bg-gray-600' : ''
          }`}
          title="Numbered List"
        >
          <ListOrdered className="w-4 h-4" />
        </button>
        <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1"></div>
        <button
          type="button"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          title="Undo"
        >
          <Undo className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          title="Redo"
        >
          <Redo className="w-4 h-4" />
        </button>
      </div>

      {/* Editor */}
      <EditorContent
        editor={editor}
        className="prose dark:prose-invert max-w-none p-4 min-h-[200px] focus:outline-none"
      />
    </div>
  );
}
