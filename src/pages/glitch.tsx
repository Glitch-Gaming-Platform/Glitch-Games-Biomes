import { GetServerSideProps } from "next";

export const getServerSideProps: GetServerSideProps = async ({ query }) => {
  const installId =
    typeof query.install_id === "string"
      ? query.install_id
      : typeof query.glitch_install_id === "string"
      ? query.glitch_install_id
      : typeof query.installId === "string"
      ? query.installId
      : "";

  if (!installId) {
    return {
      redirect: {
        destination: "/?glitch_error=missing_install_id",
        permanent: false,
      },
    };
  }

  const params = new URLSearchParams({
    install_id: installId,
    glitch_install_id: installId,
    game_install_id: installId,
    glitch_auto_play: "1",
  });

  return {
    redirect: {
      destination: `/at?${params.toString()}`,
      permanent: false,
    },
  };
};

export default function GlitchInstallEntry() {
  return null;
}
