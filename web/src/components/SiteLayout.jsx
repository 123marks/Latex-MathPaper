import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import SiteHeader from "./SiteHeader.jsx";
import SiteFooter from "./SiteFooter.jsx";
import { api } from "../lib/api.js";

export default function SiteLayout() {
  const [content, setContent] = useState(null);

  useEffect(() => {
    api.get("/api/content").then(setContent).catch(() => setContent(null));
  }, []);

  const announce = content?.announcement;

  return (
    <>
      {announce?.enabled && announce.text ? (
        <div className="announce">{announce.text}</div>
      ) : null}
      <SiteHeader />
      <main className="page">
        <Outlet context={{ content }} />
      </main>
      <SiteFooter />
    </>
  );
}
