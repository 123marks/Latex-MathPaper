// Honest download CTAs: a platform is downloadable only when the release
// manifest marks the artifact available on disk. Missing files stay as
// "not packaged" — never a GitHub releases link that looks like a download.

const PLATFORM_LABELS = {
  windows: "Windows",
  macos: "macOS",
  linux: "Linux",
};

export function platformLabel(os) {
  return PLATFORM_LABELS[os] || os || "未知平台";
}

export function describeReleaseAsset(asset = {}) {
  const os = String(asset.os || "");
  const href = asset.url || (os ? `/api/download/${os}` : "");
  const ready = asset.available === true && Boolean(href);

  if (ready) {
    return {
      os,
      ready: true,
      action: "download",
      href,
      buttonLabel: `下载 ${platformLabel(os)} 版`,
      statusLabel: "已打包",
      hint: asset.minimum || "",
    };
  }

  return {
    os,
    ready: false,
    action: "unavailable",
    href: "",
    buttonLabel: "尚未打包",
    statusLabel: "产物未就绪",
    hint: "本机发布目录没有该文件。下载接口会返回 ASSET_NOT_READY，不是可安装包。",
  };
}

export function fallbackReleaseNotes() {
  return "只有磁盘上存在对应文件时才会出现下载按钮。本页按发布清单的 available 字段显示，不把规划中的安装包写成可下载。";
}
