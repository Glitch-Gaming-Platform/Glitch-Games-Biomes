import { useInterval } from "@/client/util/intervals";
import {
  AccumulatorContext,
  collectAllAsHumanReadable,
  defaultCvalDatabase,
} from "@/shared/util/cvals";
import dynamic from "next/dynamic";
import { useMemo, useState } from "react";

// The `react18-json-view` component references `window` during module load, so
// we can't do any server side rendering with it.
const ReactJson = dynamic(() => import("react18-json-view"), { ssr: false });

export function CvalHUD() {
  const accumulatorContext = useMemo(() => new AccumulatorContext(), []);
  const updateCvalJson = () =>
    collectAllAsHumanReadable(
      defaultCvalDatabase(),
      accumulatorContext,
      performance.now() / 1000
    );
  const [cvalsJson, setCvalsJson] = useState(updateCvalJson());

  // Re-render with traffic statistics every second.
  useInterval(() => {
    setCvalsJson(updateCvalJson());
  }, 500);

  return (
    <div>
      <div className="cval-hud">
        <ReactJson
          src={cvalsJson}
          name="cvals"
          theme="vscode"
          iconStyle="square"
          collapsed={true}
          style={{
            background: "transparent",
          }}
          enableClipboard={false}
          indentWidth={1}
          displayDataTypes={false}
          displayObjectSize={false}
          quotesOnKeys={false}
        />
      </div>
    </div>
  );
}
