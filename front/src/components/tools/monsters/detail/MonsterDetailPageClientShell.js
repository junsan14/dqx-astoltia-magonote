"use client";

import { useMemo } from "react";

function getStyles() {
  return {
    page: {
      minHeight: "100vh",
      background:
        "linear-gradient(180deg, var(--page-bg) 0%, color-mix(in srgb, var(--soft-bg) 70%, var(--page-bg)) 42%, var(--page-bg) 100%)",
      color: "var(--page-text)",
      padding: "24px 16px 56px",
      width: "100%",
      maxWidth: "100%",
      minWidth: 0,
      overflowX: "hidden",
      boxSizing: "border-box",
    },
    content: {
      color: "var(--text-main)",
    },
    anchorWrap: {
      color: "var(--text-sub)",
    },
    centerBox: {
      background: "var(--panel-bg)",
      border: "1px solid var(--panel-border)",
      boxShadow:
        "0 18px 50px color-mix(in srgb, var(--page-text) 8%, transparent)",
    },
    errorText: {
      color: "var(--danger-text)",
    },
  };
}

function patchChildStyles(node, styles) {
  if (!node || typeof node !== "object") return node;
  if (!("props" in node)) return node;

  const props = node.props ?? {};
  let nextStyle = props.style;

  if (props.style) {
    if (props.style.fontSize === "13px" && props.style.fontWeight === 700) {
      nextStyle = {
        ...props.style,
        ...styles.anchorWrap,
      };
    }

    if (
      props.style.textAlign === "center" &&
      props.style.borderRadius === "18px" &&
      props.style.padding === "32px 20px"
    ) {
      nextStyle = {
        ...props.style,
        ...styles.centerBox,
      };
    }

    if (props.style.fontSize === "14px" && props.style.margin === "0 0 12px") {
      nextStyle = {
        ...props.style,
        ...styles.errorText,
      };
    }
  }

  const children = props.children;
  let nextChildren = children;

  if (Array.isArray(children)) {
    nextChildren = children.map((child) => patchChildStyles(child, styles));
  } else if (children && typeof children === "object") {
    nextChildren = patchChildStyles(children, styles);
  }

  return {
    ...node,
    props: {
      ...props,
      ...(nextStyle ? { style: nextStyle } : {}),
      ...(nextChildren !== children ? { children: nextChildren } : {}),
    },
  };
}

export default function MonsterDetailPageClientShell({ children }) {
  const styles = useMemo(() => getStyles(), []);

  const patchedChildren = useMemo(
    () =>
      Array.isArray(children)
        ? children.map((child) => patchChildStyles(child, styles))
        : patchChildStyles(children, styles),
    [children, styles]
  );

  return (
    <main style={styles.page}>
      <div style={styles.content}>{patchedChildren}</div>
    </main>
  );
}