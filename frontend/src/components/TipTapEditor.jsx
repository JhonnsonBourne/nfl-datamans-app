import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import { Paper, Group, Button, Tooltip } from '@mantine/core';

export default function TipTapEditor({ content = '', onChange, placeholder = 'Start writing your article...' }) {
    const editor = useEditor({
        extensions: [
            StarterKit,
            Image.configure({
                inline: true,
                allowBase64: true,
            }),
            Link.configure({
                openOnClick: false,
            }),
        ],
        content,
        onUpdate: ({ editor }) => {
            if (onChange) {
                onChange(editor.getHTML());
            }
        },
        editorProps: {
            attributes: {
                class: 'prose prose-sm sm:prose lg:prose-lg xl:prose-2xl mx-auto focus:outline-none min-h-[300px] p-4',
                placeholder: placeholder,
            },
        },
    });

    if (!editor) {
        return null;
    }

    return (
        <Paper shadow="sm" p="md" withBorder>
            {/* Toolbar */}
            <Group gap="xs" mb="md" wrap="wrap">
                <Tooltip label="Bold">
                    <Button
                        variant={editor.isActive('bold') ? 'filled' : 'subtle'}
                        size="xs"
                        onClick={() => editor.chain().focus().toggleBold().run()}
                    >
                        <strong>B</strong>
                    </Button>
                </Tooltip>
                <Tooltip label="Italic">
                    <Button
                        variant={editor.isActive('italic') ? 'filled' : 'subtle'}
                        size="xs"
                        onClick={() => editor.chain().focus().toggleItalic().run()}
                    >
                        <em>I</em>
                    </Button>
                </Tooltip>
                <Tooltip label="Code">
                    <Button
                        variant={editor.isActive('code') ? 'filled' : 'subtle'}
                        size="xs"
                        onClick={() => editor.chain().focus().toggleCode().run()}
                    >
                        {'</>'}
                    </Button>
                </Tooltip>
                <Tooltip label="Heading 1">
                    <Button
                        variant={editor.isActive('heading', { level: 1 }) ? 'filled' : 'subtle'}
                        size="xs"
                        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                    >
                        H1
                    </Button>
                </Tooltip>
                <Tooltip label="Heading 2">
                    <Button
                        variant={editor.isActive('heading', { level: 2 }) ? 'filled' : 'subtle'}
                        size="xs"
                        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                    >
                        H2
                    </Button>
                </Tooltip>
                <Tooltip label="Heading 3">
                    <Button
                        variant={editor.isActive('heading', { level: 3 }) ? 'filled' : 'subtle'}
                        size="xs"
                        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                    >
                        H3
                    </Button>
                </Tooltip>
                <Tooltip label="Bullet List">
                    <Button
                        variant={editor.isActive('bulletList') ? 'filled' : 'subtle'}
                        size="xs"
                        onClick={() => editor.chain().focus().toggleBulletList().run()}
                    >
                        •
                    </Button>
                </Tooltip>
                <Tooltip label="Add Link">
                    <Button
                        variant={editor.isActive('link') ? 'filled' : 'subtle'}
                        size="xs"
                        onClick={() => {
                            const url = window.prompt('Enter URL:');
                            if (url) {
                                editor.chain().focus().setLink({ href: url }).run();
                            }
                        }}
                    >
                        🔗
                    </Button>
                </Tooltip>
                <Tooltip label="Add Image">
                    <Button
                        variant="subtle"
                        size="xs"
                        onClick={() => {
                            const url = window.prompt('Enter image URL:');
                            if (url) {
                                editor.chain().focus().setImage({ src: url }).run();
                            }
                        }}
                    >
                        🖼️
                    </Button>
                </Tooltip>
            </Group>

            {/* Editor */}
            <EditorContent editor={editor} />
        </Paper>
    );
}

