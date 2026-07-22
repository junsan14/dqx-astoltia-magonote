"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { MdKeyboardArrowDown } from "react-icons/md";
import styles from "./SearchControl.module.css";

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

function defaultGetValue(option) {
  return option?.value ?? option?.id ?? "";
}

function defaultGetLabel(option) {
  return option?.label ?? option?.name ?? "";
}

export default function DropdownSelect({
  value = "",
  onChange,
  options = [],
  disabled = false,
  getOptionValue = defaultGetValue,
  getOptionLabel = defaultGetLabel,
  placeholder = "",
  className = "",
  ariaLabel,
}) {
  const rootRef = useRef(null);
  const listboxId = useId();
  const [open, setOpen] = useState(false);

  const selectedOption = useMemo(
    () =>
      options.find(
        (option) => String(getOptionValue(option)) === String(value)
      ) ?? null,
    [getOptionValue, options, value]
  );

  useEffect(() => {
    function handleClickOutside(event) {
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  function handleSelect(option) {
    onChange?.(String(getOptionValue(option)), option);
    setOpen(false);
  }

  return (
    <div ref={rootRef} className={cn(styles.root, className)}>
      <button
        type="button"
        className={cn(styles.trigger, open && styles.triggerOpen)}
        onClick={() => {
          if (!disabled) setOpen((current) => !current);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") setOpen(false);
        }}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-controls={open ? listboxId : undefined}
        aria-expanded={open}
      >
        <span className={styles.triggerLabel}>
          {selectedOption ? getOptionLabel(selectedOption) : placeholder}
        </span>
        <MdKeyboardArrowDown
          aria-hidden="true"
          className={cn(
            styles.triggerIcon,
            open && styles.triggerIconOpen
          )}
        />
      </button>

      {open ? (
        <div id={listboxId} className={styles.dropdown} role="listbox">
          {options.map((option) => {
            const optionValue = String(getOptionValue(option));
            const active = optionValue === String(value);

            return (
              <button
                key={optionValue}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => handleSelect(option)}
                className={cn(
                  styles.option,
                  active && styles.optionActive
                )}
              >
                <span>{getOptionLabel(option)}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
