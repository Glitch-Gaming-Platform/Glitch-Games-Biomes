import { App } from "@/galois/editor/view/components/App";
import "@/galois/editor/view/styles.css";
import React from "react";
import { createRoot } from "react-dom/client";

const Index: React.FunctionComponent<{}> = ({}) => {
  return <App />;
};

createRoot(document.getElementById("app")!).render(<Index />);
