import { RootErrorBoundary } from "@/client/components/RootErrorBoundary";
import SplashPage from "@/pages/splash";
import {
  clearAuthCookies,
  verifyAuthenticatedRequest,
} from "@/server/shared/auth/cookies";
import type { WebServerServerSidePropsContext } from "@/server/web/context";
import { findByUID } from "@/server/web/db/users_fetch";
import { buildGlitchInstallRedirectDestination } from "@/server/web/glitch_install_redirect";
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
      ? "/pwa/manifest.json"
      : "/pwa/manifest.json";

  return (
    <Head>
      {/* Boilerplate */}
      <meta charSet="utf-8" />
      {/*
        HARTHMERE_MOBILE_VIEWPORT_FIT (2026-08-04 mobile audit, item 2).

        `viewport-fit=cover` is what makes iOS Safari report real values for
        `env(safe-area-inset-*)`. Without it those functions resolve to `0px`,
        and every phone HUD rule that relies on them silently collapses to its
        literal fallback -- e.g. `hud.css` `padding-left: max(24px,
        env(safe-area-inset-left))` gives 24px in landscape where a notched
        iPhone needs ~44px, so the movement cluster sits under the sensor
        housing. Portrait at 390x844 looks fine, which is why the smoke missed
        it.

        This only changes layout on devices that HAVE safe-area insets (phones
        and tablets); on desktop every `env(safe-area-inset-*)` is 0 either
        way, so the `max(...)` fallbacks are unchanged. Pinch zoom is
        deliberately still allowed (no `maximum-scale`/`user-scalable=no`) --
        the iOS focus-zoom problem was already solved by using 16px inputs.
      */}
      <meta
        name="viewport"
        content="width=device-width, initial-scale=1.0, viewport-fit=cover"
      />
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

function glitchInstallRedirect(ctx: any) {
  const destination = buildGlitchInstallRedirectDestination(ctx?.query ?? {});
  if (!destination) {
    return undefined;
  }

  return {
    redirect: {
      destination,
      permanent: false,
    },
  };
}

async function __biomesGetServerSideProps(
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

export async function getServerSideProps(ctx: any) {
  const glitchRedirect = glitchInstallRedirect(ctx);
  if (glitchRedirect) {
    return glitchRedirect;
  }

  return __biomesGetServerSideProps(ctx);
}
