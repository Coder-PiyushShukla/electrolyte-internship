import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';

// A searchable item-code input with a custom, height-capped, scrollable
// dropdown — replaces the native <input list> + <datalist> combo, which
// browsers render as an unstyled, unscrollable list that overflows the
// page once there are more than a handful of options.
//
// The dropdown itself is rendered via a portal directly on <body>,
// positioned with fixed coordinates computed from the input's location.
// This keeps it from ever being clipped by a scrollable/overflow table
// wrapper, no matter which row in the table it's opened from.
export default function ItemCodeCombobox({ value, onChange, options = [], placeholder = 'Search code...' }) {
    const [open, setOpen] = useState(false);
    const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });
    const wrapperRef = useRef(null);
    const inputRef = useRef(null);

    const updateCoords = () => {
        if (!inputRef.current) return;
        const rect = inputRef.current.getBoundingClientRect();
        setCoords({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    };

    useLayoutEffect(() => {
        if (open) updateCoords();
    }, [open]);

    // Close on outside click; reposition on scroll/resize while open.
    useEffect(() => {
        function handleClickOutside(e) {
            if (
                wrapperRef.current && !wrapperRef.current.contains(e.target) &&
                !e.target.closest('[data-item-code-dropdown]')
            ) {
                setOpen(false);
            }
        }
        function handleReposition() {
            if (open) updateCoords();
        }
        document.addEventListener('mousedown', handleClickOutside);
        window.addEventListener('scroll', handleReposition, true);
        window.addEventListener('resize', handleReposition);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            window.removeEventListener('scroll', handleReposition, true);
            window.removeEventListener('resize', handleReposition);
        };
    }, [open]);

    const query = String(value || '').trim().toLowerCase();
    const filtered = query
        ? options.filter((code) => String(code).toLowerCase().includes(query))
        : options;

    const handleSelect = (code) => {
        onChange(code);
        setOpen(false);
    };

    return (
        <div ref={wrapperRef} className="relative min-w-[120px]">
            <input
                ref={inputRef}
                value={value}
                onChange={(e) => { onChange(e.target.value); setOpen(true); }}
                onFocus={() => setOpen(true)}
                placeholder={placeholder}
                autoComplete="off"
                className="w-full bg-surface-800/50 border border-surface-700 text-white rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500/60 placeholder:text-surface-600 transition-all"
            />
            {open && filtered.length > 0 && createPortal(
                <div
                    data-item-code-dropdown
                    style={{ position: 'fixed', top: coords.top, left: coords.left, width: Math.max(coords.width, 160) }}
                    className="z-[100] max-h-56 overflow-y-auto bg-surface-800 border border-surface-700 rounded-lg shadow-2xl py-1"
                >
                    {filtered.map((code) => (
                        <button
                            key={code}
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => handleSelect(code)}
                            className="block w-full text-left px-3 py-1.5 text-xs text-surface-200 hover:bg-brand-500/20 hover:text-white transition-colors cursor-pointer"
                        >
                            {code}
                        </button>
                    ))}
                </div>,
                document.body
            )}
        </div>
    );
}
