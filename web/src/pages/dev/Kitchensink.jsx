import { useRef, useState } from "react";
import {
  Badge,
  Button,
  Card,
  Chip,
  Drawer,
  IconButton,
  Meter,
  Modal,
  Segmented,
  Skeleton,
  Table,
  Tabs,
  Toast,
  Tooltip,
} from "../../components/ui/index.js";

const tableColumns = [
  { key: "resource", header: "Resource" },
  { key: "kind", header: "类型" },
  { key: "size", header: "大小", numeric: true, render: (value) => `${value} KB` },
  { key: "state", header: "状态", render: (value) => <Badge status={value} /> },
];

const tableRows = [
  { id: "main", resource: "paper/main.tex", kind: "LaTeX", size: 42.8, state: "verified" },
  { id: "notes", resource: "notes/review-notes-with-a-deliberately-long-resource-name.md", kind: "Markdown", size: 18.2, state: "offline" },
  { id: "figure", resource: "figures/result-sensitivity.png", kind: "Image", size: 884, state: "compiling" },
];

export default function Kitchensink() {
  const [tab, setTab] = useState("source");
  const [segment, setSegment] = useState("local");
  const [modalOpen, setModalOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [toastOpen, setToastOpen] = useState(false);
  const keepEditingRef = useRef(null);

  const tabItems = [
    { id: "source", label: "源码", content: <code>paper/main.tex</code> },
    { id: "preview", label: "PDF 预览", dirty: true, content: "预览等待最新 Build Artifact。" },
    { id: "evidence", label: "Evidence Links", content: "3 条已验证 Evidence Link。" },
    { id: "disabled", label: "不可用视图", disabled: true, content: null },
  ];

  return (
    <main className="kitchen" id="main-content">
      <header className="kitchen__header">
        <div>
          <p className="eyebrow">Horizon Atelier · T0.5</p>
          <h1>UI primitives</h1>
        </div>
        <Badge status="offline" label="仅开发环境" />
      </header>

      <section className="kitchen__section" aria-labelledby="kitchen-actions">
        <div className="kitchen__section-head">
          <h2 id="kitchen-actions">Actions and labels</h2>
          <span>Button · IconButton · Chip · Badge · Card</span>
        </div>
        <div className="kitchen__row">
          <Button>保存 Workspace</Button>
          <Button variant="glass">查看 Diff</Button>
          <Button variant="ghostAmber">打开 Artifact</Button>
          <Button variant="quiet">稍后处理</Button>
          <Button variant="danger">删除草稿</Button>
          <Button disabled>权限不足</Button>
          <Button loading>保存中</Button>
        </div>
        <div className="kitchen__row">
          <Button size="sm" variant="glass">Small</Button>
          <Button size="lg">Large</Button>
          <Tooltip content="搜索当前 Workspace 的 Resource">
            <IconButton icon="search" label="搜索 Resource" />
          </Tooltip>
          <Tooltip content="打开命令面板" placement="bottom">
            <IconButton icon="command" label="打开命令面板" variant="glass" />
          </Tooltip>
          <IconButton icon="close" label="禁用的关闭操作" disabled />
        </div>
        <div className="kitchen__row">
          <Chip>LaTeX</Chip>
          <Chip tone="muted">Local First</Chip>
          <Chip tone="rose">冲突</Chip>
          <Chip tone="signal">Evidence</Chip>
          <Badge status="verified" />
          <Badge status="compiling" />
          <Badge status="failed" />
          <Badge status="offline" />
        </div>
        <div className="kitchen__cards">
          <Card>
            <h3>默认 Card</h3>
            <p>用于独立、可比较的实体，不承载页面分区。</p>
          </Card>
          <Card variant="app">
            <h3>App Card</h3>
            <p>安静的深炭实底，适合 Workspace 内的有限选择。</p>
          </Card>
          <Card lift>
            <h3>Lift state</h3>
            <p>只在指针设备 hover 时表达可操作性。</p>
          </Card>
        </div>
      </section>

      <section className="kitchen__section" aria-labelledby="kitchen-selection">
        <div className="kitchen__section-head">
          <h2 id="kitchen-selection">Selection and data</h2>
          <span>Tabs · Segmented · Table</span>
        </div>
        <div className="kitchen__selection-grid">
          <div>
            <h3>Tabs</h3>
            <Tabs
              ariaLabel="编辑器视图"
              items={tabItems}
              value={tab}
              onValueChange={setTab}
            />
          </div>
          <div>
            <h3>Segmented</h3>
            <Segmented
              ariaLabel="Workspace 模式"
              value={segment}
              onValueChange={setSegment}
              options={[
                { value: "local", label: "本地" },
                { value: "pack", label: "Pack" },
                { value: "sync", label: "同步", disabled: true },
              ]}
            />
            <p className="kitchen__selection-value">当前值：<code>{segment}</code></p>
          </div>
        </div>
        <Table caption="Workspace Resources" columns={tableColumns} rows={tableRows} />
        <Table columns={tableColumns} rows={[]} emptyMessage="暂无 Resource" />
      </section>

      <section className="kitchen__section" aria-labelledby="kitchen-feedback">
        <div className="kitchen__section-head">
          <h2 id="kitchen-feedback">Feedback and overlays</h2>
          <span>Skeleton · Meter · Toast · Modal · Drawer</span>
        </div>
        <div className="kitchen__feedback-grid">
          <div className="kitchen__loading">
            <h3>Loading</h3>
            <Skeleton count={3} label="正在加载 Resource 列表" />
            <Skeleton height={72} label="正在加载预览" />
          </div>
          <div className="kitchen__meters">
            <h3>Meter</h3>
            <Meter label="本地存储" value={42} max={100} formatValue={(value) => `${value}%`} />
            <Meter label="Provider 配额" value={86} max={100} criticalAt={80} formatValue={(value) => `${value}%`} />
          </div>
        </div>
        <div className="kitchen__toast-grid">
          <Toast duration={0} title="保存完成" tone="success">修改已写入当前 Workspace。</Toast>
          <Toast duration={0} title="编译失败" tone="error">请检查 Build Job 日志中的首个错误。</Toast>
          <Toast duration={0} title="离线模式" tone="info">当前操作只使用本地 Capability。</Toast>
        </div>
        <div className="kitchen__row">
          <Button variant="glass" onClick={() => setModalOpen(true)}>打开 Modal</Button>
          <Button variant="glass" onClick={() => setDrawerOpen(true)}>打开 Drawer</Button>
          <Button variant="ghostAmber" onClick={() => setToastOpen(true)}>显示 Toast</Button>
        </div>
      </section>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="放弃未保存修改？"
        description="当前 Edit Transaction 仍有未应用的 diff。"
        initialFocusRef={keepEditingRef}
      >
        <div className="kitchen__dialog-actions">
          <Button ref={keepEditingRef} variant="glass" onClick={() => setModalOpen(false)}>继续编辑</Button>
          <Button variant="danger" onClick={() => setModalOpen(false)}>放弃修改</Button>
        </div>
      </Modal>

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Evidence Links"
        description="当前论断关联的可复查来源。"
      >
        <div className="kitchen__evidence-list">
          <Badge status="verified" label="source/report.pdf · p.14" />
          <Badge status="verified" label="scripts/sensitivity.py · result.json" />
          <Badge status="offline" label="本地 Artifact 可用" />
        </div>
      </Drawer>

      <div className="toast-stack" aria-label="通知">
        <Toast
          open={toastOpen}
          onDismiss={() => setToastOpen(false)}
          title="保存完成"
          tone="success"
        >
          修改已写入当前 Workspace。
        </Toast>
      </div>
    </main>
  );
}
