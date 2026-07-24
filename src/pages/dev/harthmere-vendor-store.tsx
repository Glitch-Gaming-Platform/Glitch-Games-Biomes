import {
  HarthmereVendorTradePanel,
  openHarthmereVendorTrade,
} from "@/client/components/challenges/LocalDevHarthmereInventorySystem";
import { HARTHMERE_VENDOR_CATALOG } from "@/shared/harthmere/harthmere_vendor_catalog";
import type { GetServerSideProps, NextPage } from "next";
import React, { useEffect } from "react";

interface HarthmereVendorStorePreviewProps {
  offset: number;
}

const HarthmereVendorStorePreview: NextPage<
  HarthmereVendorStorePreviewProps
> = ({ offset }) => {
  useEffect(() => {
    openHarthmereVendorTrade(offset, "buy");
  }, [offset]);

  return (
    <main
      aria-label="Harthmere vendor store visual test"
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at 30% 20%, #274963, #0a1324 42%, #030711)",
      }}
    >
      <HarthmereVendorTradePanel />
    </main>
  );
};

export const getServerSideProps: GetServerSideProps<
  HarthmereVendorStorePreviewProps
> = async ({ query }) => {
  if (
    process.env.NODE_ENV === "production" &&
    process.env.HARTHMERE_VISUAL_TEST_AUTH !== "1"
  ) {
    return { notFound: true };
  }

  const rawOffset = Array.isArray(query.offset)
    ? query.offset[0]
    : query.offset;
  const requestedOffset = Number(rawOffset ?? 63);
  const offset = HARTHMERE_VENDOR_CATALOG[requestedOffset]
    ? requestedOffset
    : 63;

  return { props: { offset } };
};

export default HarthmereVendorStorePreview;
