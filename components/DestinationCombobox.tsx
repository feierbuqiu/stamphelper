"use client";

import {
  AlertCircle,
  Check,
  ChevronDown,
  Globe2,
  Hash,
  MapPin,
  Search,
  X,
} from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  searchDestinationOptions,
  type DestinationOption,
  type DestinationSelection,
} from "@/lib/destination-search";

function sameSelection(left: DestinationSelection, right: DestinationSelection): boolean {
  if (left.kind !== right.kind) return false;
  if (left.kind === "country" && right.kind === "country") return left.code === right.code;
  if (left.kind === "parcel" && right.kind === "parcel") {
    return left.routeId === right.routeId && left.mode === right.mode;
  }
  if (left.kind === "zone" && right.kind === "zone") {
    return left.value === right.value && left.surfaceDiscount === right.surfaceDiscount;
  }
  return false;
}

export function DestinationCombobox({
  options,
  selection,
  selectedLabel,
  selectedBadge,
  selectedFlag,
  onSelect,
}: {
  options: DestinationOption[];
  selection: DestinationSelection;
  selectedLabel: string;
  selectedBadge: string;
  selectedFlag?: string;
  onSelect: (selection: DestinationSelection) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxId = `${useId()}-international-destination-results`;
  const results = useMemo(() => searchDestinationOptions(options, query), [options, query]);
  const safeActiveIndex = Math.min(activeIndex, Math.max(0, results.length - 1));

  useEffect(() => {
    if (!open) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, [open]);

  useEffect(() => {
    if (!open || !window.matchMedia("(max-width: 760px)").matches) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open || !results[safeActiveIndex]) return;
    document.getElementById(`${listboxId}-${safeActiveIndex}`)?.scrollIntoView({ block: "nearest" });
  }, [listboxId, open, results, safeActiveIndex]);

  const choose = (option: DestinationOption) => {
    if (option.disabled) return;
    onSelect(option.selection);
    setOpen(false);
    setQuery("");
    setActiveIndex(0);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  };

  const openPicker = () => {
    setOpen((current) => !current);
    setQuery("");
    setActiveIndex(0);
  };

  const closePicker = () => {
    setOpen(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => Math.min(results.length - 1, index + 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => Math.max(0, index - 1));
    } else if (event.key === "Enter" && results[safeActiveIndex]) {
      event.preventDefault();
      choose(results[safeActiveIndex]);
    } else if (event.key === "Escape") {
      event.preventDefault();
      closePicker();
    }
  };

  const applySearchExample = (value: string) => {
    setQuery(value);
    setActiveIndex(0);
    inputRef.current?.focus();
  };

  return (
    <div className="destination-combobox" ref={rootRef}>
      <span className="field-label">寄达国家或地区</span>
      <button
        ref={triggerRef}
        type="button"
        className={`destination-trigger ${open ? "open" : ""}`}
        aria-label={`寄达国家或地区：${selectedLabel}，${selectedBadge}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        onClick={openPicker}
      >
        <span className="destination-trigger-flag" aria-hidden="true">
          {selectedFlag || <Globe2 size={20} />}
        </span>
        <span className="destination-trigger-copy">
          <strong>{selectedLabel}</strong>
          <small>{selectedBadge}</small>
        </span>
        <ChevronDown size={18} aria-hidden="true" />
      </button>

      {open && (
        <div className="destination-popover" role="dialog" aria-label="选择寄达国家、地区或价区">
          <div className="destination-search-wrap">
            <Search size={18} aria-hidden="true" />
            <input
              ref={inputRef}
              autoFocus
              role="combobox"
              aria-label="搜索国家、地区或价区"
              aria-autocomplete="list"
              aria-expanded="true"
              aria-controls={listboxId}
              aria-activedescendant={results[safeActiveIndex] ? `${listboxId}-${safeActiveIndex}` : undefined}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setActiveIndex(0);
              }}
              onKeyDown={handleKeyDown}
              placeholder="国家、区号、代码、英文、拼音或价区"
            />
            <button type="button" className="destination-close-button" onClick={closePicker} aria-label="关闭目的地搜索" title="关闭">
              <X size={17} />
            </button>
          </div>
          <p className="destination-search-hint">
            试试：<button type="button" onClick={() => applySearchExample("61")}>61</button>
            <button type="button" onClick={() => applySearchExample("AU")}>AU</button>
            <button type="button" onClick={() => applySearchExample("United States")}>United States</button>
            <button type="button" onClick={() => applySearchExample("riben")}>riben</button>
            <button type="button" onClick={() => applySearchExample("三区")}>三区</button>
          </p>

          <div className="destination-results" id={listboxId} role="listbox" aria-label="国家、地区与价区结果">
            {!results.length && (
              <div className="destination-empty">
                <Search size={22} />
                <strong>没有找到匹配项</strong>
                <span>可尝试中文、英文、ISO 代码、国际区号、全拼或简拼。</span>
              </div>
            )}
            {results.map((option, index) => {
              const selected = sameSelection(selection, option.selection);
              const isZone = option.kind === "zone";
              const showGroupHeading = index === 0 || results[index - 1].kind !== option.kind;
              return (
                <div key={option.id}>
                  {showGroupHeading && !query && (
                    <p className="destination-result-group">
                      {isZone ? "直接按价区选择" : option.kind === "parcel" ? "常用包裹路向" : "常用国家和地区"}
                    </p>
                  )}
                  <button
                    id={`${listboxId}-${index}`}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    aria-disabled={option.disabled}
                    className={`destination-option ${index === safeActiveIndex ? "active" : ""} ${option.disabled ? "disabled" : ""}`}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => choose(option)}
                  >
                    <span className={`destination-option-icon ${isZone ? "zone-icon" : ""}`} aria-hidden="true">
                      {isZone ? <Hash size={18} /> : option.flag || <MapPin size={18} />}
                    </span>
                    <span className="destination-option-copy">
                      <strong>{option.primary}</strong>
                      <small>{option.disabledReason || option.secondary}</small>
                    </span>
                    <span className={`destination-option-badge ${option.disabled ? "unavailable" : ""}`}>
                      {option.disabled && <AlertCircle size={12} />}{option.badge}
                    </span>
                    {selected && !option.disabled && <Check className="destination-selected-check" size={16} />}
                  </button>
                </div>
              );
            })}
          </div>
          <div className="destination-popover-footer">
            <span><kbd>↑</kbd><kbd>↓</kbd> 移动</span>
            <span><kbd>Enter</kbd> 选择</span>
            <span>输入“第 3 区”也可以</span>
          </div>
        </div>
      )}
    </div>
  );
}
