import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Users, Save, Download, Upload, Type, Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, Undo, Redo, Eye, EyeOff } from 'lucide-react';

const CollaborativeEditor = () => {
  const [document, setDocument] = useState({
    title: 'Untitled Document',
    content: '',
    lastModified: new Date().toISOString(),
    version: 1
  });
  
  const [users, setUsers] = useState([
    { id: 1, name: 'You', color: '#3B82F6', cursor: 0, active: true },
    { id: 2, name: 'Alice', color: '#EF4444', cursor: 15, active: true },
    { id: 3, name: 'Bob', color: '#10B981', cursor: 32, active: false }
  ]);
  
  const [isTyping, setIsTyping] = useState(false);
  const [showUsers, setShowUsers] = useState(true);
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [selectedText, setSelectedText] = useState('');
  const [formatting, setFormatting] = useState({
    bold: false,
    italic: false,
    underline: false,
    align: 'left'
  });
  
  const editorRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // Simulate real-time updates from other users
  useEffect(() => {
    const interval = setInterval(() => {
      if (Math.random() > 0.7) {
        const activeUsers = users.filter(u => u.active && u.id !== 1);
        if (activeUsers.length > 0) {
          const randomUser = activeUsers[Math.floor(Math.random() * activeUsers.length)];
          const randomPosition = Math.floor(Math.random() * document.content.length);
          
          setUsers(prev => prev.map(user => 
            user.id === randomUser.id 
              ? { ...user, cursor: randomPosition }
              : user
          ));
        }
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [users, document.content]);

  const saveToHistory = useCallback((content) => {
    setHistory(prev => {
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push(content);
      return newHistory.slice(-50); // Keep last 50 versions
    });
    setHistoryIndex(prev => prev + 1);
  }, [historyIndex]);

  const handleContentChange = (e) => {
    const newContent = e.target.value;
    const cursorPosition = e.target.selectionStart;
    
    setDocument(prev => ({
      ...prev,
      content: newContent,
      lastModified: new Date().toISOString(),
      version: prev.version + 1
    }));

    // Update user cursor position
    setUsers(prev => prev.map(user => 
      user.id === 1 ? { ...user, cursor: cursorPosition } : user
    ));

    // Handle typing indicator
    setIsTyping(true);
    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      saveToHistory(newContent);
    }, 1000);
  };

  const handleTitleChange = (e) => {
    setDocument(prev => ({
      ...prev,
      title: e.target.value
    }));
  };

  const handleTextSelection = () => {
    if (editorRef.current) {
      const start = editorRef.current.selectionStart;
      const end = editorRef.current.selectionEnd;
      const selected = document.content.substring(start, end);
      setSelectedText(selected);
    }
  };

  const applyFormatting = (format) => {
    if (!selectedText) return;
    
    const textarea = editorRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const beforeText = document.content.substring(0, start);
    const afterText = document.content.substring(end);
    
    let formattedText = selectedText;
    
    switch (format) {
      case 'bold':
        formattedText = `**${selectedText}**`;
        break;
      case 'italic':
        formattedText = `*${selectedText}*`;
        break;
      case 'underline':
        formattedText = `__${selectedText}__`;
        break;
    }
    
    const newContent = beforeText + formattedText + afterText;
    setDocument(prev => ({ ...prev, content: newContent }));
    setFormatting(prev => ({ ...prev, [format]: !prev[format] }));
  };

  const undo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(prev => prev - 1);
      setDocument(prev => ({ ...prev, content: history[historyIndex - 1] }));
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(prev => prev + 1);
      setDocument(prev => ({ ...prev, content: history[historyIndex + 1] }));
    }
  };

  const exportDocument = () => {
    const blob = new Blob([document.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${document.title}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importDocument = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target.result;
        setDocument(prev => ({
          ...prev,
          content,
          title: file.name.replace(/\.[^/.]+$/, ""),
          version: prev.version + 1
        }));
        saveToHistory(content);
      };
      reader.readAsText(file);
    }
  };

  const getCursorPosition = (position, content) => {
    const lines = content.substring(0, position).split('\n');
    return {
      line: lines.length,
      column: lines[lines.length - 1].length + 1
    };
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <input
              type="text"
              value={document.title}
              onChange={handleTitleChange}
              className="text-xl font-semibold bg-transparent border-none outline-none focus:bg-gray-50 px-2 py-1 rounded"
            />
            <span className="text-sm text-gray-500">
              v{document.version} • Last saved {new Date(document.lastModified).toLocaleTimeString()}
            </span>
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowUsers(!showUsers)}
              className="flex items-center space-x-2 px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
            >
              {showUsers ? <EyeOff size={16} /> : <Eye size={16} />}
              <Users size={16} />
              <span>{users.filter(u => u.active).length}</span>
            </button>
          </div>
        </div>
      </div>

      <div className="flex">
        {/* Sidebar - Active Users */}
        {showUsers && (
          <div className="w-64 bg-white border-r border-gray-200 p-4">
            <h3 className="font-medium text-gray-900 mb-3">Active Users</h3>
            <div className="space-y-2">
              {users.filter(u => u.active).map(user => {
                const cursorPos = getCursorPosition(user.cursor, document.content);
                return (
                  <div key={user.id} className="flex items-center space-x-3">
                    <div 
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: user.color }}
                    />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-900">{user.name}</div>
                      <div className="text-xs text-gray-500">
                        Line {cursorPos.line}, Col {cursorPos.column}
                      </div>
                    </div>
                    {user.id === 1 && isTyping && (
                      <div className="text-xs text-green-600">Typing...</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Main Editor */}
        <div className="flex-1 flex flex-col">
          {/* Toolbar */}
          <div className="bg-white border-b border-gray-200 p-2">
            <div className="flex items-center space-x-1">
              <button
                onClick={undo}
                disabled={historyIndex <= 0}
                className="p-2 hover:bg-gray-100 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                title="Undo"
              >
                <Undo size={16} />
              </button>
              <button
                onClick={redo}
                disabled={historyIndex >= history.length - 1}
                className="p-2 hover:bg-gray-100 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                title="Redo"
              >
                <Redo size={16} />
              </button>
              
              <div className="w-px h-6 bg-gray-300 mx-2" />
              
              <button
                onClick={() => applyFormatting('bold')}
                className={`p-2 hover:bg-gray-100 rounded ${formatting.bold ? 'bg-blue-100 text-blue-600' : ''}`}
                title="Bold"
              >
                <Bold size={16} />
              </button>
              <button
                onClick={() => applyFormatting('italic')}
                className={`p-2 hover:bg-gray-100 rounded ${formatting.italic ? 'bg-blue-100 text-blue-600' : ''}`}
                title="Italic"
              >
                <Italic size={16} />
              </button>
              <button
                onClick={() => applyFormatting('underline')}
                className={`p-2 hover:bg-gray-100 rounded ${formatting.underline ? 'bg-blue-100 text-blue-600' : ''}`}
                title="Underline"
              >
                <Underline size={16} />
              </button>
              
              <div className="w-px h-6 bg-gray-300 mx-2" />
              
              <button
                onClick={() => setFormatting(prev => ({ ...prev, align: 'left' }))}
                className={`p-2 hover:bg-gray-100 rounded ${formatting.align === 'left' ? 'bg-blue-100 text-blue-600' : ''}`}
                title="Align Left"
              >
                <AlignLeft size={16} />
              </button>
              <button
                onClick={() => setFormatting(prev => ({ ...prev, align: 'center' }))}
                className={`p-2 hover:bg-gray-100 rounded ${formatting.align === 'center' ? 'bg-blue-100 text-blue-600' : ''}`}
                title="Align Center"
              >
                <AlignCenter size={16} />
              </button>
              <button
                onClick={() => setFormatting(prev => ({ ...prev, align: 'right' }))}
                className={`p-2 hover:bg-gray-100 rounded ${formatting.align === 'right' ? 'bg-blue-100 text-blue-600' : ''}`}
                title="Align Right"
              >
                <AlignRight size={16} />
              </button>
              
              <div className="w-px h-6 bg-gray-300 mx-2" />
              
              <button
                onClick={exportDocument}
                className="p-2 hover:bg-gray-100 rounded"
                title="Download"
              >
                <Download size={16} />
              </button>
              <label className="p-2 hover:bg-gray-100 rounded cursor-pointer" title="Upload">
                <Upload size={16} />
                <input
                  type="file"
                  accept=".txt,.md"
                  onChange={importDocument}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* Editor Area */}
          <div className="flex-1 p-6">
            <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="p-8">
                <textarea
                  ref={editorRef}
                  value={document.content}
                  onChange={handleContentChange}
                  onSelect={handleTextSelection}
                  placeholder="Start typing your document here... Other users can see your changes in real-time!"
                  className="w-full h-96 resize-none border-none outline-none text-gray-900 leading-relaxed"
                  style={{ 
                    textAlign: formatting.align,
                    fontSize: '16px',
                    lineHeight: '1.6'
                  }}
                />
              </div>
            </div>
          </div>

          {/* Status Bar */}
          <div className="bg-gray-100 border-t border-gray-200 px-6 py-2">
            <div className="flex items-center justify-between text-sm text-gray-600">
              <div className="flex items-center space-x-4">
                <span>Words: {document.content.split(/\s+/).filter(word => word.length > 0).length}</span>
                <span>Characters: {document.content.length}</span>
                <span>Lines: {document.content.split('\n').length}</span>
              </div>
              <div className="flex items-center space-x-2">
                {selectedText && (
                  <span>Selected: {selectedText.length} chars</span>
                )}
                <span>Ready</span>
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CollaborativeEditor;