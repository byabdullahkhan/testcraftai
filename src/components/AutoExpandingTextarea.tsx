import React, { useRef, useEffect } from 'react';

interface AutoExpandingTextareaProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  minRows?: number;
  className?: string;
}

export const AutoExpandingTextarea: React.FC<AutoExpandingTextareaProps> = ({
  id,
  value,
  onChange,
  placeholder = 'Write your response here...',
  disabled = false,
  minRows = 3,
  className = '',
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      // Expand smoothly based on scrollHeight
      textarea.style.height = `${Math.max(textarea.scrollHeight, minRows * 28)}px`;
    }
  };

  useEffect(() => {
    adjustHeight();
  }, [value]);

  return (
    <div className="relative w-full">
      <textarea
        id={id}
        ref={textareaRef}
        rows={minRows}
        disabled={disabled}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          adjustHeight();
        }}
        placeholder={placeholder}
        className={`w-full p-3.5 sm:p-4 rounded-xl text-slate-800 bg-white border border-slate-300 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100 outline-none transition-all resize-none text-base leading-relaxed placeholder:text-slate-400 disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed ${className}`}
      />
      <div className="flex items-center justify-between text-xs text-slate-500 mt-1.5 px-1">
        <span>Dynamic expansion active • No line limit</span>
        <span>
          {value.trim() ? value.trim().split(/\s+/).length : 0} words • {value.length} chars
        </span>
      </div>
    </div>
  );
};
