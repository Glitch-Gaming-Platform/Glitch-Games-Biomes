import { RootErrorBoundary } from "@/client/components/RootErrorBoundary";
import SplashPage from "@/pages/splash";
import {
  clearAuthCookies,
  verifyAuthenticatedRequest,
} from "@/server/shared/auth/cookies";
import type { WebServerServerSidePropsContext } from "@/server/web/context";
import { findByUID } from "@/server/web/db/users_fetch";
import Head from "next/head";
import homeBg from "/public/splash/home-bg.png";

export interface BiomesHeadTagProps {
  refinedTitle?: string;
  description?: string;
  embedImage?: string;
  cardMode?: "summary" | "summary_large_image";
}

export const BiomesHeadTag: React.FunctionComponent<BiomesHeadTagProps> = (
  props
) => {
  const desc =
    props.description ??
    "Biomes is an open source sandbox MMORPG built for the web using web technologies.";

  const title = props.refinedTitle
    ? `${props.refinedTitle} | Biomes`
    : "Biomes";

  const embedImage = props.embedImage ?? homeBg.src;
  const imageAlt = props.embedImage
    ? "Overhead view of a Biomes world"
    : "People and animals standing on a hill in a Biomes world";
  const cardMode: BiomesHeadTagProps["cardMode"] =
    props.cardMode ?? "summary_large_image";

  const manifestHref =
    process.env.NODE_ENV === "production"
      ? "https://static.biomes.gg/pwa/manifest.json"
      : "/pwa/manifest.json";

  return (
    <Head>
      {/* Boilerplate */}
      <meta charSet="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <link rel="manifest" href={manifestHref} />
      {/* General */}
      <title>{title}</title>
      <meta name="description" content={desc} />
      {/* Open Graph / Facebook */}
      <meta property="og:title" content={title} />
      <meta name="og:description" content={desc} />
      <meta name="og:image" content={embedImage} />
      <meta name="og:image:secure_url" content={embedImage} />
      <meta name="og:image:type" content="image/x-png" />
      <meta name="og:image:alt" content={imageAlt} />
      <meta name="twitter:card" content={cardMode} />
      {/* Theming */}
      <meta name="theme-color" content="#42A0C3"></meta>
    </Head>
  );
};

export default function Index() {
  return (
    <RootErrorBoundary>
      <BiomesHeadTag />
      <SplashPage
        onLogin={() => {
          window.location.href = "/at";
        }}
      />
    </RootErrorBoundary>
  );
}

export async function getServerSideProps(
  context: WebServerServerSidePropsContext
) {
  const token = await verifyAuthenticatedRequest(
    context.req.context.sessionStore,
    context.req
  );

  if (!token.error && token.auth.userId) {
    const user = await findByUID(context.req.context.db, token.auth.userId);
    if (user) {
      return {
        redirect: {
          permanent: false,
          destination: "/at",
        },
      };
    }

    // The session cookie can be valid while the local sparse DB no longer has
    // the user. Treat it as logged out instead of sending the browser into /at
    // with a userId that sync cannot create.
    if (process.env.NODE_ENV !== "production") {
      clearAuthCookies(context.res);
    }
  }

  return {
    props: {},
  };
}
