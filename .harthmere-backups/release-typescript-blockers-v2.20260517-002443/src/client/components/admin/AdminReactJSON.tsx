import styles from "@/client/styles/admin.module.css";
import { makeJsonSafe } from "@/shared/json";
import dynamic from "next/dynamic";
import React from "react";
export interface AdminReactJSONProps {
  src: unknown;
  theme?: unknown;
  collapsed?: boolean | number;
  onEdit?: (field: any) => boolean | void;
  onDelete?: (field: any) => boolean | void;
  sortKeys?: boolean;
  [key: string]: unknown;
}

const DynamicReactJson = dynamic(() => import("react18-json-view"), { ssr: false });

export const AdminReactJSON: React.FunctionComponent<AdminReactJSONProps> = (
  props
) => {
  return (
    <div className={styles["admin-react-json"]}>
      <DynamicReactJson
        theme="google"
        {...props}
        src={makeJsonSafe(props.src)}
      />
    </div>
  );
};
