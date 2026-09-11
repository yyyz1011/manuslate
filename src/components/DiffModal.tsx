import { AlertTriangle, Check, X } from "lucide-react";
import { diffLines } from "diff";

interface DiffModalProps {
  path: string;
  before: string;
  after: string;
  saving: boolean;
  error: string;
  onCancel: () => void;
  onConfirm: () => void;
}

export function DiffModal({
  path,
  before,
  after,
  saving,
  error,
  onCancel,
  onConfirm,
}: DiffModalProps) {
  const changes = diffLines(before, after);
  const added = changes.filter((change) => change.added).reduce((sum, change) => sum + change.count!, 0);
  const removed = changes.filter((change) => change.removed).reduce((sum, change) => sum + change.count!, 0);

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onCancel}>
      <section
        className="diff-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="diff-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="diff-header">
          <div>
            <span className="eyebrow">写入前检查</span>
            <h2 id="diff-title">确认修改</h2>
            <p>{path}</p>
          </div>
          <button className="icon-button" onClick={onCancel} aria-label="关闭差异窗口">
            <X size={18} />
          </button>
        </header>

        <div className="diff-summary">
          <span className="diff-add">+{added} 行</span>
          <span className="diff-remove">−{removed} 行</span>
          <span>只会写入这一份文件</span>
        </div>

        {error && (
          <div className="error-banner">
            <AlertTriangle size={17} />
            <span>{error}</span>
          </div>
        )}

        <div className="diff-body" aria-label="修改差异">
          {changes.map((change, index) => (
            <pre
              key={`${change.value.slice(0, 24)}-${index}`}
              className={change.added ? "added" : change.removed ? "removed" : "unchanged"}
            >
              <span className="diff-marker">{change.added ? "+" : change.removed ? "−" : " "}</span>
              {change.value}
            </pre>
          ))}
        </div>

        <footer className="diff-footer">
          <p>若磁盘文件已被其他程序改动，保存会自动中止。</p>
          <div>
            <button className="button secondary" onClick={onCancel} disabled={saving}>取消</button>
            <button className="button primary" onClick={onConfirm} disabled={saving}>
              <Check size={16} />
              {saving ? "正在写入…" : "确认写入"}
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}
