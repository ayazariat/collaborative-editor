import { Editor } from '@tiptap/react'

interface ToolbarProps {
  editor: Editor | null
  onSummarize: () => void
  onTaskExtract: () => void
  onAddComment: () => void
  readOnly: boolean
}

interface ToolbarButtonProps {
  active?: boolean
  title: string
  onClick: () => void
  shortcut?: string
  disabled?: boolean
  children: React.ReactNode
}

function ToolbarButton({ active, title, onClick, shortcut, disabled, children }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={`${title}${shortcut ? ` (${shortcut})` : ''}`}
      className={`h-9 px-3 rounded-lg text-sm font-medium transition-all duration-150 border ${
        active
          ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
      } ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
    >
      {children}
    </button>
  )
}

export default function Toolbar({ editor, onSummarize, onTaskExtract, onAddComment, readOnly }: ToolbarProps) {
  if (!editor) return null

  const canDo = !readOnly

  const action = (cmd: () => boolean) => () => {
    if (readOnly) return
    cmd()
  }

  return (
    <div className="flex flex-wrap gap-2 p-3 bg-white/80 backdrop-blur border-b border-slate-200">
      <ToolbarButton active={editor.isActive('bold')} onClick={action(() => editor.chain().focus().toggleBold().run())} title="Bold" shortcut="Ctrl+B" disabled={!canDo}>
        B
      </ToolbarButton>
      <ToolbarButton active={editor.isActive('italic')} onClick={action(() => editor.chain().focus().toggleItalic().run())} title="Italic" shortcut="Ctrl+I" disabled={!canDo}>
        I
      </ToolbarButton>
      <ToolbarButton active={editor.isActive('strike')} onClick={action(() => editor.chain().focus().toggleStrike().run())} title="Strikethrough" shortcut="Ctrl+Shift+S" disabled={!canDo}>
        S
      </ToolbarButton>
      <ToolbarButton active={editor.isActive('heading', { level: 1 })} onClick={action(() => editor.chain().focus().toggleHeading({ level: 1 }).run())} title="H1" disabled={!canDo}>
        H1
      </ToolbarButton>
      <ToolbarButton active={editor.isActive('heading', { level: 2 })} onClick={action(() => editor.chain().focus().toggleHeading({ level: 2 }).run())} title="H2" disabled={!canDo}>
        H2
      </ToolbarButton>
      <ToolbarButton active={editor.isActive('bulletList')} onClick={action(() => editor.chain().focus().toggleBulletList().run())} title="Bullet list" disabled={!canDo}>
        •
      </ToolbarButton>
      <ToolbarButton active={editor.isActive('orderedList')} onClick={action(() => editor.chain().focus().toggleOrderedList().run())} title="Numbered list" disabled={!canDo}>
        1.
      </ToolbarButton>
      <ToolbarButton active={editor.isActive('taskList')} onClick={action(() => editor.chain().focus().toggleTaskList().run())} title="Task list" disabled={!canDo}>
        ☑
      </ToolbarButton>
      <ToolbarButton onClick={action(() => editor.chain().focus().toggleBlockquote().run())} title="Blockquote" disabled={!canDo}>
        “
      </ToolbarButton>
      <ToolbarButton onClick={action(() => editor.chain().focus().toggleCodeBlock().run())} title="Code block" disabled={!canDo}>
        {'</>'}
      </ToolbarButton>
      <div className="mx-1 border-r border-gray-300" />
      <ToolbarButton onClick={onSummarize} title="AI summarize" disabled={false}>
        Summarize
      </ToolbarButton>
      <ToolbarButton onClick={onTaskExtract} title="Extract tasks" disabled={!canDo}>
        Task extract
      </ToolbarButton>
      <ToolbarButton onClick={onAddComment} title="Smart comment" disabled={!canDo || editor.isEmpty}>
        Comment
      </ToolbarButton>
    </div>
  )
}
