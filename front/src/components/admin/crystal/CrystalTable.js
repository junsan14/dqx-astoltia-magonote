function MobileField({ label, children }) {
  return (
    <div style={mobileFieldStyle}>
      <div style={mobileLabelStyle}>{label}</div>
      <div>{children}</div>
    </div>
  );
}

function InlineInput({ value, onChange }) {
  return (
    <input
      type="number"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={inlineInputStyle}
    />
  );
}

function TableCell({ children, isEditing = false }) {
  return (
    <td
      style={{
        padding: "12px 10px",
        borderBottom: "1px solid var(--card-border)",
        color: "var(--page-text)",
        whiteSpace: "nowrap",
        background: isEditing ? "var(--soft-bg)" : "transparent",
        verticalAlign: "middle",
      }}
    >
      {children}
    </td>
  );
}

function DesktopTable({
  rules,
  editingId,
  editForm,
  isPending,
  onEditStart,
  onEditChange,
  onEditCancel,
  onEditSave,
  onDelete,
}) {
  return (
    <div style={tableWrapStyle}>
      <table style={tableStyle}>
        <thead>
          <tr>
            {["ID", "最小", "最大", "plus0", "plus1", "plus2", "plus3", "操作"].map(
              (label) => (
                <th key={label} style={thStyle}>
                  {label}
                </th>
              )
            )}
          </tr>
        </thead>

        <tbody>
          {rules.map((rule) => {
            const isEditing = editingId === rule.id;

            return (
              <tr key={rule.id}>
                <TableCell isEditing={isEditing}>{rule.id}</TableCell>

                <TableCell isEditing={isEditing}>
                  {isEditing ? (
                    <InlineInput
                      value={editForm.min_level}
                      onChange={(value) => onEditChange("min_level", value)}
                    />
                  ) : (
                    rule.min_level
                  )}
                </TableCell>

                <TableCell isEditing={isEditing}>
                  {isEditing ? (
                    <InlineInput
                      value={editForm.max_level}
                      onChange={(value) => onEditChange("max_level", value)}
                    />
                  ) : (
                    rule.max_level
                  )}
                </TableCell>

                <TableCell isEditing={isEditing}>
                  {isEditing ? (
                    <InlineInput
                      value={editForm.plus0}
                      onChange={(value) => onEditChange("plus0", value)}
                    />
                  ) : (
                    rule.plus0
                  )}
                </TableCell>

                <TableCell isEditing={isEditing}>
                  {isEditing ? (
                    <InlineInput
                      value={editForm.plus1}
                      onChange={(value) => onEditChange("plus1", value)}
                    />
                  ) : (
                    rule.plus1
                  )}
                </TableCell>

                <TableCell isEditing={isEditing}>
                  {isEditing ? (
                    <InlineInput
                      value={editForm.plus2}
                      onChange={(value) => onEditChange("plus2", value)}
                    />
                  ) : (
                    rule.plus2
                  )}
                </TableCell>

                <TableCell isEditing={isEditing}>
                  {isEditing ? (
                    <InlineInput
                      value={editForm.plus3}
                      onChange={(value) => onEditChange("plus3", value)}
                    />
                  ) : (
                    rule.plus3
                  )}
                </TableCell>

                <td
                  style={{
                    padding: "12px 10px",
                    borderBottom: "1px solid var(--card-border)",
                    whiteSpace: "nowrap",
                    background: isEditing ? "var(--soft-bg)" : "transparent",
                    verticalAlign: "middle",
                  }}
                >
                  {isEditing ? (
                    <div style={actionRowStyle}>
                      <button
                        type="button"
                        onClick={onEditSave}
                        disabled={isPending}
                        style={{
                          ...primaryBtnStyle(false),
                          opacity: isPending ? 0.7 : 1,
                          cursor: isPending ? "wait" : "pointer",
                        }}
                      >
                        保存
                      </button>

                      <button
                        type="button"
                        onClick={onEditCancel}
                        disabled={isPending}
                        style={{
                          ...secondaryBtnStyle(false),
                          opacity: isPending ? 0.7 : 1,
                          cursor: isPending ? "wait" : "pointer",
                        }}
                      >
                        キャンセル
                      </button>
                    </div>
                  ) : (
                    <div style={actionRowStyle}>
                      <button
                        type="button"
                        onClick={() => onEditStart(rule)}
                        disabled={isPending}
                        style={{
                          ...secondaryBtnStyle(false),
                          opacity: isPending ? 0.7 : 1,
                          cursor: isPending ? "wait" : "pointer",
                        }}
                      >
                        編集
                      </button>

                      <button
                        type="button"
                        onClick={() => onDelete(rule.id)}
                        disabled={isPending}
                        style={{
                          ...dangerBtnStyle(false),
                          opacity: isPending ? 0.7 : 1,
                          cursor: isPending ? "wait" : "pointer",
                        }}
                      >
                        削除
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function MobileCards({
  rules,
  editingId,
  editForm,
  isPending,
  onEditStart,
  onEditChange,
  onEditCancel,
  onEditSave,
  onDelete,
}) {
  if (!rules.length) {
    return <div style={emptyStyle}>データがない</div>;
  }

  return (
    <div style={mobileListStyle}>
      {rules.map((rule) => {
        const isEditing = editingId === rule.id;

        return (
          <article key={rule.id} style={mobileCardStyle}>
            <div style={mobileCardHeaderStyle}>
              <div style={mobileCardTitleStyle}>ID: {rule.id}</div>
            </div>

            <div style={mobileGridStyle}>
              <MobileField label="最小">
                {isEditing ? (
                  <InlineInput
                    value={editForm.min_level}
                    onChange={(value) => onEditChange("min_level", value)}
                  />
                ) : (
                  <div style={mobileValueStyle}>{rule.min_level}</div>
                )}
              </MobileField>

              <MobileField label="最大">
                {isEditing ? (
                  <InlineInput
                    value={editForm.max_level}
                    onChange={(value) => onEditChange("max_level", value)}
                  />
                ) : (
                  <div style={mobileValueStyle}>{rule.max_level}</div>
                )}
              </MobileField>

              <MobileField label="plus0">
                {isEditing ? (
                  <InlineInput
                    value={editForm.plus0}
                    onChange={(value) => onEditChange("plus0", value)}
                  />
                ) : (
                  <div style={mobileValueStyle}>{rule.plus0}</div>
                )}
              </MobileField>

              <MobileField label="plus1">
                {isEditing ? (
                  <InlineInput
                    value={editForm.plus1}
                    onChange={(value) => onEditChange("plus1", value)}
                  />
                ) : (
                  <div style={mobileValueStyle}>{rule.plus1}</div>
                )}
              </MobileField>

              <MobileField label="plus2">
                {isEditing ? (
                  <InlineInput
                    value={editForm.plus2}
                    onChange={(value) => onEditChange("plus2", value)}
                  />
                ) : (
                  <div style={mobileValueStyle}>{rule.plus2}</div>
                )}
              </MobileField>

              <MobileField label="plus3">
                {isEditing ? (
                  <InlineInput
                    value={editForm.plus3}
                    onChange={(value) => onEditChange("plus3", value)}
                  />
                ) : (
                  <div style={mobileValueStyle}>{rule.plus3}</div>
                )}
              </MobileField>
            </div>

            <div style={mobileActionRowStyle}>
              {isEditing ? (
                <>
                  <button
                    type="button"
                    onClick={onEditSave}
                    disabled={isPending}
                    style={{
                      ...primaryBtnStyle(true),
                      opacity: isPending ? 0.7 : 1,
                      cursor: isPending ? "wait" : "pointer",
                    }}
                  >
                    保存
                  </button>

                  <button
                    type="button"
                    onClick={onEditCancel}
                    disabled={isPending}
                    style={{
                      ...secondaryBtnStyle(true),
                      opacity: isPending ? 0.7 : 1,
                      cursor: isPending ? "wait" : "pointer",
                    }}
                  >
                    キャンセル
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => onEditStart(rule)}
                    disabled={isPending}
                    style={{
                      ...secondaryBtnStyle(true),
                      opacity: isPending ? 0.7 : 1,
                      cursor: isPending ? "wait" : "pointer",
                    }}
                  >
                    編集
                  </button>

                  <button
                    type="button"
                    onClick={() => onDelete(rule.id)}
                    disabled={isPending}
                    style={{
                      ...dangerBtnStyle(true),
                      opacity: isPending ? 0.7 : 1,
                      cursor: isPending ? "wait" : "pointer",
                    }}
                  >
                    削除
                  </button>
                </>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}

export default function CrystalTable({
  rules,
  editingId,
  editForm,
  isPending,
  onEditStart,
  onEditChange,
  onEditCancel,
  onEditSave,
  onDelete,
  isMobile = false,
}) {
  return (
    <section style={panelStyle(isMobile)}>
      <div style={headerStyle}>
        <h2 style={titleStyle(isMobile)}>登録済みルール</h2>
        <span style={badgeStyle}>{rules.length} 件</span>
      </div>

      {isMobile ? (
        <MobileCards
          rules={rules}
          editingId={editingId}
          editForm={editForm}
          isPending={isPending}
          onEditStart={onEditStart}
          onEditChange={onEditChange}
          onEditCancel={onEditCancel}
          onEditSave={onEditSave}
          onDelete={onDelete}
        />
      ) : (
        <DesktopTable
          rules={rules}
          editingId={editingId}
          editForm={editForm}
          isPending={isPending}
          onEditStart={onEditStart}
          onEditChange={onEditChange}
          onEditCancel={onEditCancel}
          onEditSave={onEditSave}
          onDelete={onDelete}
        />
      )}
    </section>
  );
}

const panelStyle = (isMobile) => ({
  background: "var(--panel-bg)",
  border: "1px solid var(--panel-border)",
  borderRadius: 16,
  padding: isMobile ? 16 : 24,
  boxSizing: "border-box",
});

const headerStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  marginBottom: 16,
  flexWrap: "wrap",
};

const titleStyle = (isMobile) => ({
  margin: 0,
  fontSize: isMobile ? 18 : 22,
  color: "var(--text-title)",
});

const badgeStyle = {
  background: "var(--soft-bg)",
  color: "var(--text-main)",
  border: "1px solid var(--soft-border)",
  borderRadius: 9999,
  padding: "6px 12px",
  fontSize: 13,
  fontWeight: 700,
};

const tableWrapStyle = {
  width: "100%",
  overflowX: "auto",
};

const tableStyle = {
  width: "100%",
  minWidth: 920,
  borderCollapse: "collapse",
};

const thStyle = {
  textAlign: "left",
  padding: "12px 10px",
  borderBottom: "1px solid var(--soft-border)",
  color: "var(--text-sub)",
  fontSize: 13,
  whiteSpace: "nowrap",
};

const inlineInputStyle = {
  width: "100%",
  minWidth: 0,
  boxSizing: "border-box",
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid var(--input-border)",
  background: "var(--input-bg)",
  color: "var(--input-text)",
  outline: "none",
  fontSize: 14,
};

const actionRowStyle = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

const primaryBtnStyle = (isMobile) => ({
  width: isMobile ? "100%" : "auto",
  border: "1px solid var(--primary-border)",
  borderRadius: 10,
  padding: "10px 12px",
  fontWeight: 700,
  background: "var(--primary-bg)",
  color: "var(--primary-text)",
  whiteSpace: "nowrap",
});

const secondaryBtnStyle = (isMobile) => ({
  width: isMobile ? "100%" : "auto",
  borderRadius: 10,
  padding: "10px 12px",
  fontWeight: 700,
  background: "var(--secondary-bg)",
  color: "var(--secondary-text)",
  border: "1px solid var(--secondary-border)",
  whiteSpace: "nowrap",
});

const dangerBtnStyle = (isMobile) => ({
  width: isMobile ? "100%" : "auto",
  borderRadius: 10,
  padding: "10px 12px",
  fontWeight: 700,
  background: "var(--danger-bg)",
  color: "var(--danger-text)",
  border: "1px solid var(--danger-border)",
  whiteSpace: "nowrap",
});

const mobileListStyle = {
  display: "grid",
  gap: 12,
};

const mobileCardStyle = {
  border: "1px solid var(--card-border)",
  background: "var(--card-bg)",
  borderRadius: 14,
  padding: 14,
  display: "grid",
  gap: 14,
};

const mobileCardHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 8,
};

const mobileCardTitleStyle = {
  fontWeight: 800,
  color: "var(--text-title)",
};

const mobileGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 12,
};

const mobileFieldStyle = {
  display: "grid",
  gap: 6,
  minWidth: 0,
};

const mobileLabelStyle = {
  fontSize: 12,
  fontWeight: 700,
  color: "var(--text-sub)",
};

const mobileValueStyle = {
  color: "var(--text-main)",
  fontWeight: 600,
  minHeight: 20,
  display: "flex",
  alignItems: "center",
};

const mobileActionRowStyle = {
  display: "grid",
  gap: 10,
};

const emptyStyle = {
  padding: "12px 0",
  color: "var(--text-muted)",
};