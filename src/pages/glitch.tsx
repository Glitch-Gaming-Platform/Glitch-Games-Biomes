import { buildGlitchInstallRedirectDestination } from "@/server/web/glitch_install_redirect";
import type { GetServerSideProps } from "next";

export const getServerSideProps: GetServerSideProps = async ({ query }) => {
  const destination = buildGlitchInstallRedirectDestination(query);

  if (!destination) {
    return {
      redirect: {
        destination: "/?glitch_error=missing_install_id",
        permanent: false,
      },
    };
  }

  return {
    redirect: {
      destination,
      permanent: false,
    },
  };
};

export default function GlitchInstallEntry() {
  return null;
}
