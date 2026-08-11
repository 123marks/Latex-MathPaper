function coordinate(value, linkIndex, pointIndex) {
  if (!Number.isFinite(value)) {
    throw new TypeError(
      "EvidenceFlow link " + (linkIndex + 1) + " point " + (pointIndex + 1)
        + " requires finite coordinates",
    );
  }
  const rounded = Number(value.toFixed(3));
  return Object.is(rounded, -0) ? "0" : String(rounded);
}

function pathForLink(link, linkIndex) {
  if (!link || typeof link !== "object") {
    throw new TypeError("EvidenceFlow link " + (linkIndex + 1) + " must be an object");
  }
  if (!Array.isArray(link.points) || link.points.length < 2) {
    throw new TypeError("EvidenceFlow link " + (linkIndex + 1) + " requires at least two points");
  }

  const points = link.points.map((point, pointIndex) => {
    if (!point || typeof point !== "object") {
      throw new TypeError(
        "EvidenceFlow link " + (linkIndex + 1) + " point " + (pointIndex + 1)
          + " must be an object",
      );
    }
    return {
      x: coordinate(point.x, linkIndex, pointIndex),
      y: coordinate(point.y, linkIndex, pointIndex),
    };
  });

  return {
    id: link.id ?? linkIndex,
    d: points.map((point, pointIndex) => (
      (pointIndex === 0 ? "M " : "L ") + point.x + " " + point.y
    )).join(" "),
    first: points[0],
    last: points.at(-1),
  };
}

export default function EvidenceFlow({
  links = [],
  animated = true,
  label = "证据关联",
  viewBox = "0 0 100 100",
  showAnchors = true,
  className = "",
}) {
  if (!Array.isArray(links)) {
    throw new TypeError("EvidenceFlow links must be an array");
  }
  const paths = links.map(pathForLink);
  const semantics = label
    ? { role: "img", "aria-label": label }
    : { "aria-hidden": "true" };

  return (
    <svg
      className={["evidence-flow", className].filter(Boolean).join(" ")}
      viewBox={viewBox}
      preserveAspectRatio="none"
      focusable="false"
      {...semantics}
    >
      {label ? <title>{label}</title> : null}
      {paths.map((path) => (
        <g key={path.id}>
          <path
            className={[
              "evidence-flow__path",
              animated ? "evidence-flow__path--animated" : "",
            ].filter(Boolean).join(" ")}
            d={path.d}
            vectorEffect="non-scaling-stroke"
          />
          {showAnchors ? (
            <>
              <circle className="evidence-flow__anchor" cx={path.first.x} cy={path.first.y} r="1.6" />
              <circle className="evidence-flow__anchor" cx={path.last.x} cy={path.last.y} r="1.6" />
            </>
          ) : null}
        </g>
      ))}
    </svg>
  );
}
